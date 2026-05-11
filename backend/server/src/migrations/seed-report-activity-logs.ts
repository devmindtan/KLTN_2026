/**
 * Backfill activity_logs cho existing reports
 * Chạy 1 lần khi deploy activity logging feature lần đầu
 * 
 * Usage: npx ts-node src/migrations/seed-report-activity-logs.ts
 */
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  database: process.env.POSTGRES_DBS || "traffic",
  user: process.env.POSTGRES_USERNAME || "admin",
  password: process.env.POSTGRES_PASSWORD || "admin",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
});

async function main() {
  try {
    console.log("🔍 Backfilling activity logs for existing reports...\n");

    // Get reports without activity logs
    const result = await pool.query(`
      SELECT r.id, r.title, r.type, r.status, r.created_at, r.created_by
      FROM reports r
      WHERE NOT EXISTS (
        SELECT 1 FROM activity_logs al 
        WHERE al.resource = 'reports' 
        AND al.resource_id = r.id::text
        AND al.action = 'CREATE_REPORT'
      )
      ORDER BY r.created_at DESC
    `);

    if (result.rows.length === 0) {
      console.log("✅ All reports already have activity logs. Nothing to do.");
      return;
    }

    console.log(`Found ${result.rows.length} reports without CREATE_REPORT logs\n`);

    for (const report of result.rows) {
      // Insert CREATE_REPORT log with original timestamp
      await pool.query(
        `INSERT INTO activity_logs (account_id, action, resource, resource_id, details, ip_address, created_at)
         VALUES ($1, 'CREATE_REPORT', 'reports', $2, $3, '127.0.0.1', $4)`,
        [
          report.created_by,
          report.id,
          JSON.stringify({ title: report.title, type: report.type, backfilled: true }),
          report.created_at
        ]
      );

      console.log(`✓ ${report.title} (${report.id.substring(0, 8)}...)`);

      // If deleted, add DELETE_REPORT log
      if (report.status === 'deleted') {
        await pool.query(
          `INSERT INTO activity_logs (account_id, action, resource, resource_id, details, ip_address, created_at)
           VALUES ($1, 'DELETE_REPORT', 'reports', $2, $3, '127.0.0.1', NOW())`,
          [
            report.created_by,
            report.id,
            JSON.stringify({ title: report.title, action: 'soft_delete', backfilled: true })
          ]
        );
        console.log(`  ↳ + DELETE_REPORT log`);
      }
    }

    console.log(`\n✅ Backfilled ${result.rows.length} report activity logs`);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
