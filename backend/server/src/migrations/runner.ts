import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";

/**
 * Danh sách migration SQL chạy tuần tự khi server khởi động.
 * Tất cả file đều dùng IF NOT EXISTS — an toàn khi chạy lại.
 * 002 (Materialized Views) được xử lý riêng: chỉ chạy khi MV chưa tồn tại.
 */
const PLAIN_MIGRATIONS = [
  "000_core_tables.sql",
  "001_auth_tables.sql",
  "003_data_library.sql",
  "006_help_articles.sql",
  "008_reports_tables.sql",
];

const MV_MIGRATION = "002_traffic_pattern_views.sql";
const MV_FORECAST_MIGRATION = "004_forecast_capacity_views.sql";
const MV_FORECAST_ROLLING_MIGRATION = "005_forecast_rolling_view.sql";

/**
 * Chạy toàn bộ migrations khi server khởi động.
 * - Plain migrations (000, 001, 003): luôn chạy, idempotent.
 * - MV migration (002): chỉ chạy nếu mv_traffic_by_hour chưa tồn tại.
 * Không throw — chỉ log lỗi để tránh crash server khi migration fail.
 */
export async function runMigrations(dbPool: Pool): Promise<void> {
  console.log("[migrations] Starting startup migrations...");

  // ── Plain migrations ──────────────────────────────────────────────────────
  for (const file of PLAIN_MIGRATIONS) {
    const sqlPath = path.join(__dirname, file);
    try {
      const sql = fs.readFileSync(sqlPath, "utf8");
      await dbPool.query(sql);
      console.log(`[migrations] ✅ ${file}`);
    } catch (err) {
      console.error(`[migrations] ❌ ${file} failed:`, err);
    }
  }

  // ── Materialized Views (002) ─────────────────────────────────────────────
  // Chỉ tạo nếu chưa tồn tại — tránh REFRESH BLOCKING khi MV đã có sẵn
  try {
    const { rows } = await dbPool.query(
      `SELECT matviewname FROM pg_matviews WHERE matviewname = 'mv_traffic_by_hour'`
    );
    if (rows.length === 0) {
      const sqlPath = path.join(__dirname, MV_MIGRATION);
      const sql     = fs.readFileSync(sqlPath, "utf8");
      await dbPool.query(sql);
      console.log(`[migrations] ✅ ${MV_MIGRATION} (created + initial refresh)`);
    } else {
      console.log(`[migrations] ✅ ${MV_MIGRATION} (already exists, skipped)`);
    }
  } catch (err) {
    console.error(`[migrations] ❌ ${MV_MIGRATION} failed:`, err);
  }

  // ── Forecast Materialized Views (004) ────────────────────────────────────
  // Chỉ tạo nếu chưa tồn tại — tránh blocking khi MV đã có sẵn dữ liệu
  try {
    const { rows } = await dbPool.query(
      `SELECT matviewname FROM pg_matviews WHERE matviewname = 'mv_forecast_capacity'`
    );
    if (rows.length === 0) {
      const sqlPath = path.join(__dirname, MV_FORECAST_MIGRATION);
      const sql     = fs.readFileSync(sqlPath, "utf8");
      await dbPool.query(sql);
      console.log(`[migrations] ✅ ${MV_FORECAST_MIGRATION} (created + initial refresh)`);
    } else {
      console.log(`[migrations] ✅ ${MV_FORECAST_MIGRATION} (already exists, skipped)`);
    }
  } catch (err) {
    console.error(`[migrations] ❌ ${MV_FORECAST_MIGRATION} failed:`, err);
  }

  // ── Forecast Rolling Today MV (005) ──────────────────────────────────────
  // Rolling forecast chart - chỉ ngày hiện tại, phụ thuộc mv_forecast_capacity
  // NOTE: MV structure thay đổi 15/03/26 từ PIVOT → simple filter (giữ nguyên
  //       structure gốc camera_forecasts). Detect bằng cột horizon_minutes.
  try {
    const { rows } = await dbPool.query(`
      SELECT attname FROM pg_attribute
      JOIN pg_class ON pg_class.oid = pg_attribute.attrelid
      WHERE pg_class.relname = 'mv_forecast_rolling_today'
        AND pg_attribute.attname = 'horizon_minutes'
        AND pg_attribute.attnum > 0
    `);
    const hasNewStructure = rows.length > 0; // có cột horizon_minutes → MV mới
    if (!hasNewStructure) {
      // Chưa có MV, hoặc MV cũ (PIVOT) → drop và tạo lại
      await dbPool.query(`DROP INDEX IF EXISTS idx_mv_forecast_rolling_today`);
      await dbPool.query(`DROP MATERIALIZED VIEW IF EXISTS mv_forecast_rolling_today`);
      const sqlPath = path.join(__dirname, MV_FORECAST_ROLLING_MIGRATION);
      const sql     = fs.readFileSync(sqlPath, "utf8");
      await dbPool.query(sql);
      console.log(`[migrations] ✅ ${MV_FORECAST_ROLLING_MIGRATION} (created/upgraded to simple-filter structure)`);
    } else {
      console.log(`[migrations] ✅ ${MV_FORECAST_ROLLING_MIGRATION} (already up-to-date, skipped)`);
    }
  } catch (err) {
    console.error(`[migrations] ❌ ${MV_FORECAST_ROLLING_MIGRATION} failed:`, err);
  }

  console.log("[migrations] Startup migrations completed ✅");
}
