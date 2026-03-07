import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import pool from "./config/database";
import { swaggerSpec } from "./config/swagger";
import testControllerApi from "./routes/test.api";
import cameraApi from "./routes/camera.api";
import modelMetricsApi from "./routes/model-metrics.api";
import modelApi from "./routes/model.api";
import authApi from "./routes/auth.api";
import dataLibraryApi from "./routes/data-library.api";
import trafficPatternApi from "./routes/traffic-pattern.api";
import { requireAuth } from "./middleware/auth.middleware";
import { ensureTrafficPatternMV, startTrafficPatternRefresh } from "./controllers/traffic-pattern.controller";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;

// Hỗ trợ nhiều origins: CORS_ORIGIN="https://web.devmindtan.com,http://localhost:5173"
// Tự động thêm server's own origin để Swagger UI hoạt động
const allowedOrigins = [
  `http://localhost:${PORT}`,          // Swagger UI (same-origin request)
  ...(process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim()),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép requests không có origin (mobile apps, curl, Swagger UI local)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Swagger UI – http://localhost:8080/api/docs
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "KLTN 2026 API Docs",
  swaggerOptions: { persistAuthorization: true },
}));

// Auth routes – public (guest-token, login, refresh)
app.use("/api/auth", authApi);

// Protected routes – cần JWT (viewer hoặc technician)
app.use("/api/cameras",      requireAuth, cameraApi);
app.use("/api/model-metrics", requireAuth, modelMetricsApi);

// Model routes – GET requireAuth, write operations requireTechnician (xử lý trong route file)
app.use("/api/models", requireAuth, modelApi);

// Data Library routes – GET requireAuth, write operations requireTechnician (xử lý trong route file)
app.use("/api/data-library", requireAuth, dataLibraryApi);

// Traffic Pattern routes – lấy dữ liệu phân bố mật độ giao thông (direct query)
app.use("/api/traffic", requireAuth, trafficPatternApi);

// Legacy test route
app.use("/", testControllerApi);

// PostgreSQL connection + auto-migration
pool
  .query("SELECT NOW()")
  .then(async () => {
    console.log("PostgreSQL connected ✅");
    await ensureTrafficPatternMV(pool);
    startTrafficPatternRefresh(pool);
  })
  .catch((err) => console.error("PostgreSQL connection error:", err));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
