/**
 * Reports Controller - API endpoints for Smart Reports system
 * Handles CRUD operations for reports, file downloads, templates
 * Kích hoạt sinh báo cáo qua k8s Job (thay thế spawn("python"))
 */
import { Request, Response } from "express";
import { z } from "zod";
import { Pool } from "pg";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import * as k8s from "@kubernetes/client-node";

// ─── MinIO client (dùng cho streaming download) ───────────────────────────────
function _getS3Client() {
  return new S3Client({
    endpoint:      process.env.MINIO_ENDPOINT_URL || "http://localhost:9000",
    credentials: {
      accessKeyId:     process.env.MINIO_ACCESS_KEY    || "admin",
      secretAccessKey: process.env.MINIO_SECRET_KEY    || "admin",
    },
    region:          "us-east-1",
    forcePathStyle:  true,
  });
}

// ─── Validation schemas ───────────────────────────────────────────────────────
const generateReportSchema = z.object({
  title: z.string().min(1).max(255),
  type: z.enum(["daily", "weekly", "monthly", "quarterly", "custom", "incident"]),
  period_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  settings: z.object({
    hour_from:          z.number().int().min(0).max(23).nullable().optional(),
    hour_to:            z.number().int().min(1).max(24).nullable().optional(),
    includeCharts:      z.boolean().optional(),
    includeRawData:     z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
  }).optional().default({}),
});

const listReportsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  type: z.enum(["daily", "weekly", "monthly", "quarterly", "custom", "incident"]).optional(),
  status: z.enum(["pending", "generating", "ready", "failed"]).optional(),
  search: z.string().optional()
});

/**
 * GET /api/reports - Danh sách báo cáo với pagination và filter
 */
export async function getReports(req: Request, res: Response) {
  try {
    console.log("[reports] getReports - req exists:", !!req);
    console.log("[reports] getReports - req.query:", req?.query);
    
    if (!req || !req.query) {
      console.error("[reports] getReports - req or req.query is undefined");
      return res.status(400).json({
        success: false,
        error: "Invalid request object"
      });
    }
    
    const query = listReportsSchema.parse(req.query);
    const db = req.app.locals.db as Pool;
    
    // Build WHERE conditions
    const conditions = ["1=1"];
    const params: any[] = [];
    let paramCount = 0;
    
    if (query.type) {
      paramCount++;
      conditions.push(`type = $${paramCount}`);
      params.push(query.type);
    }
    
    if (query.status) {
      paramCount++;
      conditions.push(`status = $${paramCount}`);
      params.push(query.status);
    }
    
    if (query.search) {
      paramCount++;
      conditions.push(`title ILIKE $${paramCount}`);
      params.push(`%${query.search}%`);
    }
    
    // Count total records
    const countQuery = `SELECT COUNT(*) FROM reports WHERE ${conditions.join(" AND ")}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    // Get paginated results
    const offset = (query.page - 1) * query.limit;
    paramCount++;
    params.push(query.limit);
    paramCount++;
    params.push(offset);
    
    const dataQuery = `
      SELECT 
        id, title, type, period_from, period_to, status, 
        files_json, summary_json, created_at, generated_at, error_message
      FROM reports 
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC 
      LIMIT $${paramCount-1} OFFSET $${paramCount}
    `;
    
    const result = await db.query(dataQuery, params);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    });
    
  } catch (error) {
    console.error("[reports] getReports failed:", error);
    res.status(500).json({
      success: false,
      error: "Lỗi khi lấy danh sách báo cáo"
    });
  }
}

/**
 * GET /api/reports/:id - Chi tiết báo cáo với download links
 */
export async function getReportById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const db = req.app.locals.db as Pool;
    
    const result = await db.query(
      "SELECT * FROM reports WHERE id = $1",
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy báo cáo"
      });
    }
    
    const report = result.rows[0];
    
    // files_json chứa path nội bộ — client download qua /api/reports/:id/download/:format
    
    res.json({
      success: true,
      data: report
    });
    
  } catch (error) {
    console.error("[reports] getReportById failed:", error);
    res.status(500).json({
      success: false,
      error: "Lỗi khi lấy chi tiết báo cáo"
    });
  }
}

/**
 * POST /api/reports/generate - Tạo báo cáo mới
 */
export async function generateReport(req: Request, res: Response) {
  try {
    const reportData = generateReportSchema.parse(req.body);
    const db = req.app.locals.db as Pool;
    const userId = (req as any).user?.id; // From auth middleware
    
    // Validate date range
    const fromDate = new Date(reportData.period_from);
    const toDate = new Date(reportData.period_to);
    
    if (fromDate > toDate) {
      return res.status(400).json({
        success: false,
        error: "Ngày bắt đầu không thể lớn hơn ngày kết thúc"
      });
    }
    
    // Create report record
    const insertResult = await db.query(`
      INSERT INTO reports (title, type, period_from, period_to, settings_json, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `, [
      reportData.title,
      reportData.type,
      reportData.period_from,
      reportData.period_to,
      JSON.stringify(reportData.settings),
      userId
    ]);
    
    const reportId = insertResult.rows[0].id;
    
    // Trigger report generation async (k8s Job)
    _triggerReportGeneration(reportId, reportData, db);
    
    res.status(202).json({
      success: true,
      data: {
        id: reportId,
        status: "pending",
        message: "Báo cáo đang được tạo. Bạn sẽ nhận được thông báo khi hoàn tất."
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Dữ liệu đầu vào không hợp lệ",
        details: error.issues
      });
    }
    
    console.error("[reports] generateReport failed:", error);
    res.status(500).json({
      success: false,
      error: "Lỗi khi tạo báo cáo"
    });
  }
}

/**
 * DELETE /api/reports/:id - Xóa báo cáo (soft delete)
 */
export async function deleteReport(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const db = req.app.locals.db as Pool;
    
    // Check if report exists
    const checkResult = await db.query(
      "SELECT id, files_json FROM reports WHERE id = $1",
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy báo cáo"
      });
    }
    
    // Soft delete (update status instead of actual deletion)
    await db.query(
      "UPDATE reports SET status = 'deleted', error_message = 'Đã xóa bởi người dùng' WHERE id = $1",
      [id]
    );
    
    // TODO: Optionally delete files from MinIO
    
    res.json({
      success: true,
      message: "Báo cáo đã được xóa thành công"
    });
    
  } catch (error) {
    console.error("[reports] deleteReport failed:", error);
    res.status(500).json({
      success: false,
      error: "Lỗi khi xóa báo cáo"
    });
  }
}

/**
 * GET /api/reports/:id/download/:format - Download file PDF/XLSX
 */
export async function downloadReportFile(req: Request, res: Response) {
  try {
    const { id, format } = req.params;
    
    if (!["pdf", "xlsx"].includes(format)) {
      return res.status(400).json({
        success: false,
        error: "Format không hợp lệ. Chỉ hỗ trợ 'pdf' hoặc 'xlsx'"
      });
    }
    
    const db = req.app.locals.db as Pool;
    
    const result = await db.query(
      "SELECT title, files_json, status FROM reports WHERE id = $1",
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy báo cáo"
      });
    }
    
    const report = result.rows[0];
    
    if (report.status !== "ready") {
      return res.status(400).json({
        success: false,
        error: "Báo cáo chưa sẵn sẵng để tải"
      });
    }
    
    if (!report.files_json?.[format]?.path) {
      return res.status(404).json({
        success: false,
        error: `File ${format.toUpperCase()} không tồn tại`
      });
    }
    
    // Stream file từ MinIO về client
    const filePath = report.files_json[format].path;
    const fileName = `${report.title.replace(/[^a-zA-Z0-9]/g, "_")}.${format}`;
    const contentType = format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    try {
      await _streamFileFromMinio(filePath, fileName, contentType, res);
    } catch (streamError) {
      console.error("[reports] MinIO stream failed:", streamError);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Lỗi khi tải file từ MinIO" });
      }
    }
    
  } catch (error) {
    console.error("[reports] downloadReportFile failed:", error);
    res.status(500).json({
      success: false,
      error: "Lỗi khi tải báo cáo"
    });
  }
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Tạo k8s Job để sinh báo cáo bất đồng bộ
 * Image + env vars theo spec report-generator-job.yaml
 */
async function _triggerReportGeneration(reportId: string, config: any, db: Pool) {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault(); // in-cluster ServiceAccount hoặc ~/.kube/config local

  const batchApi   = kc.makeApiClient(k8s.BatchV1Api);
  const namespace  = process.env.KUBE_NAMESPACE || "backend";
  const image      = process.env.REPORT_GENERATOR_IMAGE || "devmindtan/dev-repo:report-generator-v1.0.2";

  // Tên Job: report-<8 ký tự đầu UUID> (unique, hợp lệ với DNS k8s)
  const shortId  = reportId.replace(/-/g, "").slice(0, 8);
  const jobName  = `report-${shortId}`;
  const configJson = JSON.stringify(config);

  const job: k8s.V1Job = {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      name:      jobName,
      namespace,
      labels: { app: "report-generator", "report-id": reportId },
    },
    spec: {
      ttlSecondsAfterFinished: 3600,
      backoffLimit: 1,
      template: {
        metadata: { labels: { app: "report-generator" } },
        spec: {
          restartPolicy: "Never",
          containers: [{
            name:    "report-generator",
            image,
            imagePullPolicy: "Always", // Luôn pull image mới nhất, không dùng cache
            command: ["python", "app/main.py", reportId],
            env: [
              { name: "REPORT_CONFIG",      value: configJson },
              { name: "POSTGRES_HOST",      value: process.env.POSTGRES_HOST      || "postgres-postgresql.database.svc.cluster.local" },
              { name: "POSTGRES_DBS",       value: process.env.POSTGRES_DBS       || "kltn_db" },
              { name: "POSTGRES_USERNAME",  value: process.env.POSTGRES_USERNAME  || "admin" },
              { name: "POSTGRES_PASSWORD",  value: process.env.POSTGRES_PASSWORD  || "" },
              { name: "POSTGRES_PORT",      value: process.env.POSTGRES_PORT      || "5432" },
              { name: "MINIO_ENDPOINT_URL", value: process.env.MINIO_ENDPOINT_URL || "http://minio.database.svc.cluster.local:9000" },
              { name: "MINIO_ACCESS_KEY",   value: process.env.MINIO_ACCESS_KEY   || "admin" },
              { name: "MINIO_SECRET_KEY",   value: process.env.MINIO_SECRET_KEY   || "" },
              { name: "MINIO_BUCKET",       value: process.env.MINIO_BUCKET       || "reports" },
            ],
            resources: {
              requests: { memory: "256Mi", cpu: "200m" },
              limits:   { memory: "1Gi",  cpu: "1000m" },
            },
          }],
        },
      },
    },
  };

  try {
    await batchApi.createNamespacedJob({ namespace, body: job });
    console.log(`[reports] ✅ k8s Job created: ${jobName} for report ${reportId}`);
  } catch (k8sErr: any) {
    console.error(`[reports] ❌ k8s Job creation failed:`, k8sErr?.body || k8sErr);

    // Đánh dấu báo cáo là failed để UI biết
    await db.query(
      "UPDATE reports SET status = 'failed', error_message = $1 WHERE id = $2",
      ["Lỗi khi khởi động k8s Job sinh báo cáo", reportId]
    );
  }
}

/**
 * Stream file PDF/XLSX từ MinIO về client
 * Key path lấy từ files_json.pdf.path hoặc files_json.xlsx.path
 */
async function _streamFileFromMinio(
  filePath: string,
  fileName: string,
  contentType: string,
  res: Response
) {
  const s3     = _getS3Client();
  const bucket = process.env.MINIO_BUCKET || "reports";

  const command  = new GetObjectCommand({ Bucket: bucket, Key: filePath });
  const response = await s3.send(command);

  if (!response.Body) throw new Error("Empty response body from MinIO");

  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Content-Type", contentType);
  if (response.ContentLength) {
    res.setHeader("Content-Length", response.ContentLength);
  }

  (response.Body as Readable).pipe(res);
}