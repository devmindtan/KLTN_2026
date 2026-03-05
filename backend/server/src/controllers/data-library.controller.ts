import { Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import archiver from "archiver";
import { createGunzip, gzipSync } from "zlib";
import { randomUUID } from "crypto";
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import pool from "../config/database";
import { Readable } from "stream";

// ============================================================
// MINIO CLIENT
// ============================================================

function createS3Client() {
  return new S3Client({
    endpoint: process.env.MINIO_ENDPOINT_URL,
    region: "us-east-1",
    credentials: {
      accessKeyId:     process.env.MINIO_ACCESS_KEY     ?? "",
      secretAccessKey: process.env.MINIO_SECRET_KEY     ?? "",
    },
    forcePathStyle: true,
  });
}

const DATA_LIBRARY_BUCKET = process.env.DATA_LIBRARY_BUCKET ?? "data-library";

// ============================================================
// MULTER CONFIG – memory storage, chỉ nhận csv/json
// ============================================================

export const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["text/csv", "application/json", "application/octet-stream"];
    const extOk   = /\.(csv|json)$/i.test(file.originalname);
    if (allowed.includes(file.mimetype) || extOk) cb(null, true);
    else cb(new Error("Chỉ chấp nhận file .csv hoặc .json"));
  },
});

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

const createCollectionSchema = z.object({
  title:       z.string().min(1).max(255),
  data_type:   z.string().min(1).max(50),
  description: z.string().optional(),
  tags:        z.array(z.string()).optional(),
});

const importEntrySchema = z.object({
  collection_id: z.string().min(1),
  snapshot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  new_title:     z.string().min(1).max(255).optional(),
  data_type:     z.string().min(1).max(50).optional(),
  description:   z.string().optional(),
});

// ============================================================
// COLLECTION HANDLERS
// ============================================================

/**
 * Lấy danh sách collections, hỗ trợ filter theo source/type và pagination
 * GET /api/data-library/collections
 */
export const getCollections = async (req: Request, res: Response) => {
  const { source, type, page = "1", limit = "20" } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  const conditions: string[] = [];
  const params: unknown[]    = [];
  let paramIdx = 1;

  if (source) { conditions.push(`source = $${paramIdx++}`); params.push(source); }
  if (type)   { conditions.push(`data_type = $${paramIdx++}`); params.push(type); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countSql = `SELECT COUNT(*) FROM data_library_collections ${where}`;
  const dataSql  = `
    SELECT
      c.id, c.source, c.title, c.description, c.data_type, c.tags,
      c.created_at, c.updated_at,
      COUNT(e.id)::int     AS entry_count,
      MAX(e.snapshot_date) AS last_snapshot_date
    FROM data_library_collections c
    LEFT JOIN data_library_entries e ON e.collection_id = c.id
    ${where}
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  const [countResult, dataResult] = await Promise.all([
    pool.query(countSql, params),
    pool.query(dataSql, [...params, parseInt(limit as string), offset]),
  ]);

  res.json({
    success: true,
    data:    dataResult.rows,
    total:   parseInt(countResult.rows[0].count),
    page:    parseInt(page as string),
    limit:   parseInt(limit as string),
  });
};

/**
 * Lấy chi tiết 1 collection + danh sách entries (sorted by snapshot_date DESC)
 * GET /api/data-library/collections/:id
 */
export const getCollectionById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const colResult = await pool.query(
    "SELECT * FROM data_library_collections WHERE id = $1",
    [id]
  );
  if (!colResult.rows.length) {
    return res.status(404).json({ success: false, message: "Collection không tồn tại" });
  }

  const entriesResult = await pool.query(
    `SELECT id, snapshot_date, minio_keys, file_sizes, record_count, uploaded_by, created_at
     FROM data_library_entries
     WHERE collection_id = $1
     ORDER BY snapshot_date DESC`,
    [id]
  );

  res.json({
    success: true,
    data: {
      ...colResult.rows[0],
      entries: entriesResult.rows,
    },
  });
};

/**
 * Tạo collection mới (chỉ dành cho external data)
 * POST /api/data-library/collections [TECHNICIAN]
 */
export const createCollection = async (req: Request, res: Response) => {
  const parsed = createCollectionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.flatten() });
  }
  const { title, data_type, description, tags } = parsed.data;

  const result = await pool.query(
    `INSERT INTO data_library_collections (source, title, description, data_type, tags)
     VALUES ('external', $1, $2, $3, $4)
     RETURNING *`,
    [title, description ?? null, data_type, tags ?? null]
  );

  res.status(201).json({ success: true, data: result.rows[0] });
};

/**
 * Cập nhật thông tin cơ bản collection (title, description, data_type)
 * PUT /api/data-library/collections/:id [TECHNICIAN]
 */
export const updateCollection = async (req: Request, res: Response) => {
  const { id } = req.params;
  const schema = z.object({
    title:       z.string().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
    data_type:   z.string().min(1).max(50).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.flatten() });
  }

  const sets: string[]   = [];
  const vals: unknown[]  = [];
  let   idx              = 1;

  if (parsed.data.title       !== undefined) { sets.push(`title = $${idx++}`);       vals.push(parsed.data.title); }
  if (parsed.data.description !== undefined) { sets.push(`description = $${idx++}`); vals.push(parsed.data.description); }
  if (parsed.data.data_type   !== undefined) { sets.push(`data_type = $${idx++}`);   vals.push(parsed.data.data_type); }

  if (!sets.length) {
    return res.status(400).json({ success: false, message: "Không có gì để cập nhật" });
  }

  sets.push(`updated_at = NOW()`);
  vals.push(id);

  const result = await pool.query(
    `UPDATE data_library_collections SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: "Collection không tồn tại" });
  }
  res.json({ success: true, data: result.rows[0] });
};

/**
 * Xóa collection, toàn bộ entries và các file MinIO liên quan
 * DELETE /api/data-library/collections/:id [TECHNICIAN]
 */
export const deleteCollection = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Lấy tất cả minio_keys của entries thuộc collection
  const entriesResult = await pool.query(
    "SELECT minio_keys FROM data_library_entries WHERE collection_id = $1",
    [id]
  );

  // Xóa từng file trên MinIO
  if (entriesResult.rows.length) {
    const s3 = createS3Client();
    const deletePromises: Promise<unknown>[] = [];
    for (const entry of entriesResult.rows) {
      const keys = entry.minio_keys as Record<string, string>;
      for (const minioKey of Object.values(keys)) {
        deletePromises.push(
          s3.send(new DeleteObjectCommand({ Bucket: DATA_LIBRARY_BUCKET, Key: minioKey }))
            .catch((e) => console.warn(`[deleteCollection] MinIO delete failed: ${minioKey}`, e))
        );
      }
    }
    await Promise.all(deletePromises);
  }

  const result = await pool.query(
    "DELETE FROM data_library_collections WHERE id = $1 RETURNING id",
    [id]
  );
  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: "Collection không tồn tại" });
  }
  res.json({ success: true, message: "Đã xóa collection" });
};

// ============================================================
// ENTRY HANDLERS
// ============================================================

/**
 * Tải xuống 1 file hoặc toàn bộ snapshot dưới dạng zip
 * GET /api/data-library/entries/:id/download?file={key|all}
 */
export const downloadEntry = async (req: Request, res: Response) => {
  const { id }   = req.params;
  const fileKey  = (req.query.file as string) || "all";

  const entryResult = await pool.query(
    `SELECT e.*, c.title AS collection_title
     FROM data_library_entries e
     JOIN data_library_collections c ON c.id = e.collection_id
     WHERE e.id = $1`,
    [id]
  );
  if (!entryResult.rows.length) {
    return res.status(404).json({ success: false, message: "Entry không tồn tại" });
  }

  const entry       = entryResult.rows[0];
  const minioKeys   = entry.minio_keys as Record<string, string>;
  const s3          = createS3Client();
  const safeTitle   = (entry.collection_title as string).replace(/[^a-zA-Z0-9_\-]/g, "_");
  const dateStr     = String(entry.snapshot_date).split("T")[0];

  // ---- Tải 1 file ----
  if (fileKey !== "all") {
    const minioKey = minioKeys[fileKey];
    if (!minioKey) {
      return res.status(400).json({ success: false, message: `File key "${fileKey}" không tồn tại` });
    }

    const isCompressed = minioKey.endsWith(".gz");
    const ext          = minioKey.replace(/\.gz$/, "").split(".").pop() ?? "bin";
    const filename     = `${safeTitle}_${dateStr}_${fileKey}.${ext}`;

    try {
      const s3Object = await s3.send(new GetObjectCommand({ Bucket: DATA_LIBRARY_BUCKET, Key: minioKey }));
      const bodyStream = s3Object.Body as Readable;

      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", ext === "csv" ? "text/csv" : "application/json");

      if (isCompressed) {
        bodyStream.pipe(createGunzip()).pipe(res);
      } else {
        bodyStream.pipe(res);
      }
    } catch (err) {
      console.error("[downloadEntry] S3 error:", err);
      res.status(500).json({ success: false, message: "Lỗi khi tải file từ storage" });
    }
    return;
  }

  // ---- Tải toàn bộ snapshot (zip) ----
  const zipFilename = `${safeTitle}_${dateStr}.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipFilename}"`);

  const archive = archiver("zip", { zlib: { level: 0 } }); // level 0 vì files đã nén
  archive.pipe(res);

  try {
    for (const [key, minioKey] of Object.entries(minioKeys)) {
      const s3Object = await s3.send(new GetObjectCommand({ Bucket: DATA_LIBRARY_BUCKET, Key: minioKey }));
      const bodyStream = s3Object.Body as Readable;
      const isCompressed = minioKey.endsWith(".gz");
      const ext           = minioKey.replace(/\.gz$/, "").split(".").pop() ?? "bin";
      const entryName     = `${dateStr}_${key}.${ext}`;

      if (isCompressed) {
        archive.append(bodyStream.pipe(createGunzip()), { name: entryName });
      } else {
        archive.append(bodyStream, { name: entryName });
      }
    }
    await archive.finalize();
  } catch (err) {
    console.error("[downloadEntry/zip] error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Lỗi khi tạo zip" });
    }
  }
};

/**
 * Import 1 file vào collection (có thể tạo collection mới nếu collection_id="new")
 * POST /api/data-library/entries [TECHNICIAN]
 */
export const importEntry = async (req: Request, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    return res.status(400).json({ success: false, message: "Thiếu file đính kèm" });
  }

  const parsed = importEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, errors: parsed.error.flatten() });
  }
  const { collection_id, snapshot_date, new_title, data_type, description } = parsed.data;

  // Xác định collection_id thực sự
  let realCollectionId = collection_id;
  if (collection_id === "new") {
    if (!new_title || !data_type) {
      return res.status(400).json({
        success: false,
        message: "Cần new_title và data_type khi tạo collection mới",
      });
    }
    const colResult = await pool.query(
      `INSERT INTO data_library_collections (source, title, description, data_type)
       VALUES ('external', $1, $2, $3)
       RETURNING id`,
      [new_title, description ?? null, data_type]
    );
    realCollectionId = colResult.rows[0].id;
  }

  // Xác định extension và nén gzip
  const ext         = file.originalname.split(".").pop()?.toLowerCase() ?? "bin";
  const fileUuid    = randomUUID().replace(/-/g, "").slice(0, 8);
  const safeName    = file.originalname.replace(/[^a-zA-Z0-9._\-]/g, "_");
  const minioKey    = `external/${fileUuid}_${safeName}.gz`;

  const compressedBuffer = gzipSync(file.buffer);

  // Đếm records
  let recordCount = 0;
  try {
    const raw = file.buffer.toString("utf-8");
    if (ext === "json") {
      const parsed = JSON.parse(raw);
      recordCount  = Array.isArray(parsed) ? parsed.length : 1;
    } else {
      recordCount = raw.split("\n").filter((l) => l.trim()).length - 1; // trừ header
    }
  } catch { /* ignore */ }

  // Upload lên MinIO
  const s3 = createS3Client();
  await s3.send(new PutObjectCommand({
    Bucket:      DATA_LIBRARY_BUCKET,
    Key:         minioKey,
    Body:        compressedBuffer,
    ContentType: "application/gzip",
  }));

  // Insert vào DB
  const minioKeys  = { [ext]: minioKey };
  const fileSizes  = { [ext]: compressedBuffer.length };

  const entryResult = await pool.query(
    `INSERT INTO data_library_entries
       (collection_id, snapshot_date, minio_keys, file_sizes, record_count, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (collection_id, snapshot_date)
     DO UPDATE SET
       minio_keys   = data_library_entries.minio_keys || EXCLUDED.minio_keys,
       file_sizes   = data_library_entries.file_sizes  || EXCLUDED.file_sizes,
       record_count = data_library_entries.record_count + EXCLUDED.record_count
     RETURNING *`,
    [
      realCollectionId,
      snapshot_date,
      JSON.stringify(minioKeys),
      JSON.stringify(fileSizes),
      recordCount,
      req.auth?.email ?? "unknown",
    ]
  );

  res.status(201).json({ success: true, data: entryResult.rows[0] });
};

/**
 * Xóa 1 entry (snapshot) và các file MinIO liên quan
 * DELETE /api/data-library/entries/:id [TECHNICIAN]
 */
export const deleteEntry = async (req: Request, res: Response) => {
  const { id } = req.params;

  const entryResult = await pool.query(
    "SELECT minio_keys FROM data_library_entries WHERE id = $1",
    [id]
  );
  if (!entryResult.rows.length) {
    return res.status(404).json({ success: false, message: "Entry không tồn tại" });
  }

  // Xóa từng file trên MinIO
  const minioKeys = entryResult.rows[0].minio_keys as Record<string, string>;
  if (minioKeys && Object.keys(minioKeys).length) {
    const s3 = createS3Client();
    await Promise.all(
      Object.values(minioKeys).map((key) =>
        s3.send(new DeleteObjectCommand({ Bucket: DATA_LIBRARY_BUCKET, Key: key }))
          .catch((e) => console.warn(`[deleteEntry] MinIO delete failed: ${key}`, e))
      )
    );
  }

  await pool.query("DELETE FROM data_library_entries WHERE id = $1", [id]);
  res.json({ success: true, message: "Đã xóa snapshot" });
};
