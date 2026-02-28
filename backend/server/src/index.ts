import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/database";
import testControllerApi from "./routes/test.api";
import cameraApi from "./routes/camera.api";
import modelMetricsApi from "./routes/model-metrics.api";
import modelApi from "./routes/model.api";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/", testControllerApi);
app.use("/api/cameras", cameraApi);
app.use("/api/model-metrics", modelMetricsApi);
app.use("/api/models", modelApi);

// PostgreSQL connection test
pool
  .query("SELECT NOW()")
  .then(() => console.log("PostgreSQL connected ✅"))
  .catch((err) => console.error("PostgreSQL connection error:", err));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
