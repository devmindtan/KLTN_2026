import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

/**
 * Khởi tạo PostgreSQL connection pool
 * Sử dụng environment variable DATABASE_URL
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Optional: cấu hình connection pool
  max: 20, // số connection tối đa
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,  // 10s (đủ thời gian cho CAPACITY_CTE complex query)
  statement_timeout: 30000,        // query tự kill sau 30s tránh hang
});

// Test connection
pool.on("connect", () => {
  console.log("PostgreSQL connected ✅");
});

pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err);
});

export default pool;
