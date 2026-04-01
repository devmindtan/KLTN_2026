import pool from "../config/database"; // Import pool vừa tạo ở trên
import { Request, Response } from "express";
import { Pool } from "pg";

interface ChunkResult {
  data: any[];
  chunkIndex: number;
  totalChunks: number;
  hasMore: boolean;
  timestamp: string;
}

/**
 * ✨ IMPROVED: Query chunked theo từng tuần để tránh load toàn bộ tháng vào memory
 * Sử dụng cursor-based pagination (keyset pagination) thay vì OFFSET
 */
export async function getReportHistory(req: Request, res: Response) {
  const db = req.app.locals.db as Pool;

  try {
    const {
      limit = "50",
      offset = "0",
      action,
      month,
      year,
      useCursor = "false",
      cursor,
      chunkSize = "7", // 7 ngày mỗi chunk
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const offsetNum = parseInt(offset as string) || 0;
    const chunkDays = parseInt(chunkSize as string) || 7;
    const useKeysetPagination = useCursor === "true" || cursor;

    // ────────────────────────────────────────────────────────────────────
    // 🔵 STRATEGY 1: Keyset Pagination (recommended cho large datasets)
    // ────────────────────────────────────────────────────────────────────
    if (useKeysetPagination) {
      return await getReportHistoryWithKeyset(
        db,
        { month, year, action, limit: limitNum, cursor },
        res,
      );
    }

    // ────────────────────────────────────────────────────────────────────
    // 🟡 STRATEGY 2: Chunked Monthly Query (phân chia theo tuần)
    // ────────────────────────────────────────────────────────────────────
    if (month && year) {
      return await getReportHistoryChunked(
        db,
        { month, year, action, limit: limitNum, chunkDays },
        res,
      );
    }

    // ────────────────────────────────────────────────────────────────────
    // 🟢 STRATEGY 3: Standard Pagination (fallback - tháng này hoặc no filter)
    // ────────────────────────────────────────────────────────────────────
    let whereClauses = ["al.resource = 'reports'"];
    const params: any[] = [];

    if (action) {
      params.push(action);
      whereClauses.push(`al.action = $${params.length}`);
    }

    const whereString =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `
      SELECT 
        al.id,
        al.created_at as timestamp,
        COALESCE(ta.full_name, 'Hệ thống') as user,
        al.action,
        COALESCE(al.details->>'title', r.title, 'N/A') as target,
        COALESCE(al.details->>'message', '') as details,
        CASE 
          WHEN al.action LIKE '%DELETE%' THEN 'warning'
          WHEN al.action LIKE '%ERROR%' OR al.action LIKE '%FAIL%' THEN 'error'
          ELSE 'success'
        END as status,
        al.ip_address as ip
      FROM activity_logs al
      LEFT JOIN technician_accounts ta ON al.account_id = ta.id
      LEFT JOIN reports r ON al.resource_id = r.id::text
      ${whereString}
      ORDER BY al.created_at DESC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const finalParams = [...params, limitNum, offsetNum];
    const result = await db.query(query, finalParams);

    const countQuery = `SELECT COUNT(*) FROM activity_logs al ${whereString}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
      pagination: { limit: limitNum, offset: offsetNum, total },
    });
  } catch (error) {
    console.error("[getReportHistory] Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch report history" });
  }
}

/**
 * 🔵 KEYSET PAGINATION: Dùng cursor (created_at + id) thay vì OFFSET
 * ⚡ Lợi ích: O(1) lookup, không cần scan từ line 0 như OFFSET
 * Cách dùng: ?useCursor=true&limit=50 (lần đầu, không cursor)
 *           ?useCursor=true&limit=50&cursor=eyI...base64...IJ9 (next page)
 */
async function getReportHistoryWithKeyset(
  db: Pool,
  options: any,
  res: Response,
) {
  try {
    const { month, year, action, limit, cursor } = options;
    const params: any[] = [];

    let whereClause = "al.resource = 'reports'";

    // Thêm time range filter
    if (month && year) {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      params.push(startDate);
      whereClause += ` AND al.created_at >= $${params.length}::date`;

      params.push(startDate);
      whereClause += ` AND al.created_at < ($${params.length}::date + interval '1 month')`;
    }

    // Thêm action filter
    if (action) {
      params.push(action);
      whereClause += ` AND al.action = $${params.length}`;
    }

    // Decode cursor
    let cursorCondition = "";
    if (cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(cursor as string, "base64").toString(),
        );
        params.push(decoded.timestamp);
        params.push(decoded.id);
        cursorCondition = `AND (al.created_at, al.id) < ($${params.length - 1}, $${params.length})`;
      } catch (e) {
        console.warn("[keyset] Invalid cursor, ignoring");
      }
    }

    params.push(limit + 1); // +1 để detect hasMore

    const query = `
      SELECT 
        al.id,
        al.created_at as timestamp,
        COALESCE(ta.full_name, 'Hệ thống') as user,
        al.action,
        COALESCE(al.details->>'title', r.title, 'N/A') as target,
        COALESCE(al.details->>'message', '') as details,
        CASE 
          WHEN al.action LIKE '%DELETE%' THEN 'warning'
          WHEN al.action LIKE '%ERROR%' OR al.action LIKE '%FAIL%' THEN 'error'
          ELSE 'success'
        END as status,
        al.ip_address as ip
      FROM activity_logs al
      LEFT JOIN technician_accounts ta ON al.account_id = ta.id
      LEFT JOIN reports r ON al.resource_id = r.id::text
      WHERE ${whereClause} ${cursorCondition}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT $${params.length}
    `;

    const result = await db.query(query, params);

    const hasMore = result.rows.length > limit;
    const rows = result.rows.slice(0, limit);

    // Encode next cursor
    let nextCursor = null;
    if (hasMore && rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({
          timestamp: lastRow.timestamp,
          id: lastRow.id,
        }),
      ).toString("base64");
    }

    res.json({
      success: true,
      data: rows,
      pagination: {
        limit,
        hasMore,
        nextCursor,
        strategy: "keyset",
      },
    });
  } catch (error) {
    console.error("[getReportHistoryWithKeyset] Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch report history" });
  }
}

/**
 * 🟡 CHUNKED MONTHLY QUERY: Chia tháng thành các chunk nhỏ (7 ngày/chunk)
 * Client có thể request từng chunk một, load từ từ thay vì đợi toàn bộ
 * Response bao gồm metadata về chunks
 */
async function getReportHistoryChunked(db: Pool, options: any, res: Response) {
  try {
    const { month, year, action, limit, chunkDays } = options;

    const monthStart = new Date(`${year}-${String(month).padStart(2, "0")}-01`);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const chunks: ChunkResult[] = [];
    let currentDate = new Date(monthStart);
    let chunkIndex = 0;

    // ────── Tính toán chunks ──────
    const totalDays = Math.ceil(
      (monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const totalChunks = Math.ceil(totalDays / chunkDays);

    // ────── Lặp qua từng chunk ──────
    while (currentDate < monthEnd) {
      const chunkEnd = new Date(currentDate);
      chunkEnd.setDate(chunkEnd.getDate() + chunkDays);

      const params: any[] = [];
      let whereClause = "al.resource = 'reports'";

      params.push(currentDate.toISOString().split("T")[0]);
      whereClause += ` AND al.created_at >= $${params.length}::date`;

      params.push(chunkEnd.toISOString().split("T")[0]);
      whereClause += ` AND al.created_at < $${params.length}::date`;

      if (action) {
        params.push(action);
        whereClause += ` AND al.action = $${params.length}`;
      }

      params.push(limit);

      const query = `
        SELECT 
          al.id,
          al.created_at as timestamp,
          COALESCE(ta.full_name, 'Hệ thống') as user,
          al.action,
          COALESCE(al.details->>'title', r.title, 'N/A') as target,
          COALESCE(al.details->>'message', '') as details,
          CASE 
            WHEN al.action LIKE '%DELETE%' THEN 'warning'
            WHEN al.action LIKE '%ERROR%' OR al.action LIKE '%FAIL%' THEN 'error'
            ELSE 'success'
          END as status,
          al.ip_address as ip
        FROM activity_logs al
        LEFT JOIN technician_accounts ta ON al.account_id = ta.id
        LEFT JOIN reports r ON al.resource_id = r.id::text
        WHERE ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT $${params.length}
      `;

      const result = await db.query(query, params);

      chunks.push({
        data: result.rows,
        chunkIndex,
        totalChunks,
        hasMore: result.rows.length >= limit,
        timestamp: currentDate.toISOString().split("T")[0],
      });

      currentDate = new Date(chunkEnd);
      chunkIndex++;
    }

    res.json({
      success: true,
      month,
      year,
      chunks,
      strategy: "chunked",
      chunkInfo: {
        dayPerChunk: chunkDays,
        totalChunks,
        period: {
          from: monthStart.toISOString().split("T")[0],
          to: monthEnd.toISOString().split("T")[0],
        },
      },
    });
  } catch (error) {
    console.error("[getReportHistoryChunked] Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch report history" });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 🧪 TEST FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

async function testAll() {
  console.log("\n");
  console.log(
    "╔══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║         🧪 TESTING QUERY OPTIMIZATION STRATEGIES              ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════╝",
  );

  try {
    console.log(
      "\n┌─ Test 1: CHUNKED MONTHLY QUERY (Chia tháng thành chunks) ─┐",
    );
    await testChunkedQuery();

    console.log(
      "\n┌─ Test 2: KEYSET PAGINATION (Dùng cursor thay vì offset) ──┐",
    );
    await testKeysetPagination();

    console.log(
      "\n┌─ Test 3: STANDARD PAGINATION (Fallback) ─────────────────┐",
    );
    await testStandardPagination();

    console.log("\n✅ Tất cả tests hoàn tất!");
  } catch (error) {
    console.error("❌ Test error:", error);
  } finally {
    await pool.end();
  }
}

/**
 * Test 1: Chunked Monthly Query
 * Chia tháng 03/2026 thành 7-ngày chunks, fetch từng chunk một
 */
async function testChunkedQuery() {
  const mockReq = {
    app: { locals: { db: pool } },
    query: {
      month: "03",
      year: "2026",
      limit: "10",
      chunkSize: "7",
    },
  } as any;

  const mockRes = {
    json: (data: any) => {
      console.log("\n📊 Response:");
      console.log(JSON.stringify(data, null, 2));

      if (data.chunks) {
        data.chunks.forEach((chunk: any) => {
          console.log(
            `   Chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} ` +
              `(${chunk.timestamp}): ${chunk.data.length} records`,
          );
        });
      }
    },
    status: (code: number) => ({
      json: (data: any) => console.error(`   ❌ Error ${code}:`, data),
    }),
  } as any;

  await getReportHistory(mockReq, mockRes);
}

/**
 * Test 2: Keyset Pagination (Cursor-based)
 * Lần 1: Request không cursor
 * Lần 2: Request với cursor từ lần 1
 */
async function testKeysetPagination() {
  console.log("   [Request 1: First page - no cursor]");
  const mockReq1 = {
    app: { locals: { db: pool } },
    query: {
      month: "03",
      year: "2026",
      limit: "5",
      useCursor: "true",
    },
  } as any;

  let nextCursor: string | null = null;

  const mockRes1 = {
    json: (data: any) => {
      console.log(`   ✓ Retrieved ${data.data.length} records`);
      if (data.pagination?.nextCursor) {
        nextCursor = data.pagination.nextCursor;
        console.log(
          `   ✓ Next cursor: ${data.pagination.nextCursor.substring(0, 20)}...`,
        );
      }
    },
    status: (code: number) => ({
      json: (data: any) => console.error(`   ❌ Error ${code}:`, data),
    }),
  } as any;

  await getReportHistory(mockReq1, mockRes1);

  // Lần 2: Dùng cursor để fetch next page
  if (nextCursor) {
    console.log("   [Request 2: Next page - with cursor]");
    const mockReq2 = {
      app: { locals: { db: pool } },
      query: {
        month: "03",
        year: "2026",
        limit: "5",
        useCursor: "true",
        cursor: nextCursor,
      },
    } as any;

    const mockRes2 = {
      json: (data: any) => {
        console.log(`   ✓ Retrieved ${data.data.length} records (page 2)`);
        if (!data.pagination?.hasMore) {
          console.log("   ✓ No more records (end reached)");
        }
      },
      status: (code: number) => ({
        json: (data: any) => console.error(`   ❌ Error ${code}:`, data),
      }),
    } as any;

    await getReportHistory(mockReq2, mockRes2);
  }
}

/**
 * Test 3: Standard Pagination (Fallback)
 */
async function testStandardPagination() {
  const mockReq = {
    app: { locals: { db: pool } },
    query: {
      limit: "10",
      offset: "0",
    },
  } as any;

  const mockRes = {
    json: (data: any) => {
      console.log(`   ✓ Retrieved ${data.data.length} records`);
      console.log(
        `   ✓ Total: ${data.pagination.total} | Page: ${data.pagination.page}/${data.pagination.totalPages}`,
      );
    },
    status: (code: number) => ({
      json: (data: any) => console.error(`   ❌ Error ${code}:`, data),
    }),
  } as any;

  await getReportHistory(mockReq, mockRes);
}

// ════════════════════════════════════════════════════════════════════════════
// ▶️  RUN TEST
// ════════════════════════════════════════════════════════════════════════════

testAll();
