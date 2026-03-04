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
import { requireAuth } from "./middleware/auth.middleware";

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

// Legacy test route
app.use("/", testControllerApi);

// PostgreSQL connection test
pool
  .query("SELECT NOW()")
  .then(() => console.log("PostgreSQL connected ✅"))
  .catch((err) => console.error("PostgreSQL connection error:", err));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
