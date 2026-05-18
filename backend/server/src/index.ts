import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
// import swaggerUi from "swagger-ui-express";  // TODO: re-enable khi swagger được revamp
import pool from "./config/database";
// import { swaggerSpec } from "./config/swagger";  // TODO: re-enable khi swagger được revamp
import testControllerApi from "./routes/test.api";
import cameraApi from "./routes/camera.api";
import modelMetricsApi from "./routes/model-metrics.api";
import modelApi from "./routes/model.api";
import authApi from "./routes/auth.api";
import dataLibraryApi from "./routes/data-library.api";
import trafficPatternApi from "./routes/traffic-pattern.api";
import trafficHistoryApi from "./routes/traffic-history.api";
import forecastApi from "./routes/forecast.api";
import helpApi from "./routes/help.api";
import { reportsRoutes } from "./routes/reports.api";
import { requireAuth } from "./middleware/auth.middleware";
import { runMigrations } from "./migrations/runner";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;

// Hỗ trợ nhiều origins: CORS_ORIGIN="https://web.devmindtan.com,http://localhost:5173"
// Tự động thêm server's own origin để Swagger UI hoạt động
const allowedOrigins = [
  `http://localhost:${PORT}`, // Swagger UI (same-origin request)
  ...(process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim()),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép requests không có origin (mobile apps, curl, Swagger UI local)
      // callback(null, false) thay vì throw Error — tránh Express trả 500 trước khi gắn header
      // Traefik cors-backend middleware là security gate thực sự trong production
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Attach database pool to app.locals for controllers
app.locals.db = pool;

// Swagger UI – tạm đóng cho đến khi revamp spec
// app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
//   customSiteTitle: "KLTN 2026 API Docs",
//   swaggerOptions: { persistAuthorization: true },
// }));

// Auth routes – public (guest-token, login, refresh)
app.use("/api/auth", authApi);

// Protected routes – cần JWT (viewer hoặc technician)
app.use("/api/cameras", requireAuth, cameraApi);
app.use("/api/model-metrics", requireAuth, modelMetricsApi);

// Model routes – GET requireAuth, write operations requireTechnician (xử lý trong route file)
app.use("/api/models", requireAuth, modelApi);

// Data Library routes – GET requireAuth, write operations requireTechnician (xử lý trong route file)
app.use("/api/data-library", requireAuth, dataLibraryApi);

// Traffic Pattern routes – lấy dữ liệu phân bố mật độ giao thông (direct query)
app.use("/api/traffic", requireAuth, trafficPatternApi);

// Traffic History routes – lấy dữ liệu lịch sử giao thông theo ngày cụ thể
app.use("/api/traffic", requireAuth, trafficHistoryApi);

// Forecast routes – tổng hợp, chuỗi thời gian và chi tiết slot dự báo
app.use("/api/forecast", requireAuth, forecastApi);

// Help / Documentation routes – CMS tài liệu hướng dẫn
app.use("/api/help", requireAuth, helpApi);

// Reports routes – Smart Reports system (PDF + XLSX generation)
app.use("/api/reports", requireAuth, reportsRoutes);

// Legacy test route
app.use("/", testControllerApi);

/**
 * Global error handler - đảm bảo CORS headers được trả về ngay cả khi có lỗi
 */
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error("Global error handler:", err.message || err);

  // Đảm bảo CORS headers luôn có mặt (defense-in-depth, backup cho Traefik)
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// PostgreSQL connection + auto-migration
pool
  .query("SELECT NOW()")
  .then(async () => {
    console.log("PostgreSQL connected ✅");
    await runMigrations(pool);
  })
  .catch((err) => console.error("PostgreSQL connection error:", err));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
