import { Request, Response } from "express";
import { z } from "zod";
import * as k8s from "@kubernetes/client-node";
import pool from "../config/database";

// ============================================================
// K8S CLIENT HELPER
// ============================================================
/**
 * Khởi tạo k8s client.
 * - Trong k8s Pod: tự động dùng in-cluster config (ServiceAccount token).
 * - Dev local: fallback về ~/.kube/config (hoặc KUBECONFIG env var).
 */
function createK8sClients() {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  return {
    batch: kc.makeApiClient(k8s.BatchV1Api),
    apps:  kc.makeApiClient(k8s.AppsV1Api),
  };
}

const IMAGE_PREDICT_IMAGE_FALLBACK =
  process.env.IMAGE_PREDICT_IMAGE ??
  "devmindtan/dev-repo:image-predict-v1.3.0";

/**
 * Lấy image đang chạy của deployment image-predict từ k8s API.
 * Tránh hardcode version — luôn dùng đúng image đang deploy.
 * Fallback về IMAGE_PREDICT_IMAGE_FALLBACK nếu không đọc được.
 */
async function getImagePredictImage(): Promise<string> {
  try {
    const { apps } = createK8sClients();
    const deploy = await apps.readNamespacedDeployment({
      name: "image-predict",
      namespace: "backend",
    });
    const image = deploy.spec?.template?.spec?.containers?.[0]?.image;
    if (image) {
      console.info(`[Train Job] Using image from deployment: ${image}`);
      return image;
    }
  } catch (err) {
    console.warn(`[Train Job] Cannot read deployment image, using fallback: ${err instanceof Error ? err.message : err}`);
  }
  return IMAGE_PREDICT_IMAGE_FALLBACK;
}

// ============================================================
// DISPLAY NAME MAPPING
// ============================================================
const MODEL_TYPE_LABELS: Record<string, string> = {
  random_forest_5m: "Random Forest - Dự báo 5 phút",
  random_forest_10m: "Random Forest - Dự báo 10 phút",
  random_forest_15m: "Random Forest - Dự báo 15 phút",
  random_forest_30m: "Random Forest - Dự báo 30 phút",
  random_forest_60m: "Random Forest - Dự báo 60 phút",
  yolo: "YOLO - Phát hiện xe",
};

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * Lấy danh sách tất cả active models (1 model/type đang được sử dụng)
 * GET /api/models
 */
export const getActiveModels = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query<{
      id: number;
      model_type: string;
      model_version: string;
      minio_key: string;
      base_model: string | null;
      training_samples: number | null;
      training_duration_hours: number | null;
      metrics: Record<string, unknown> | null;
      is_active: boolean;
      created_at: string;
    }>(
      `
      SELECT
        id,
        model_type,
        model_version,
        minio_key,
        base_model,
        training_samples,
        training_duration_hours,
        metrics,
        is_active,
        created_at
      FROM ml_model_metadata
      WHERE is_active = TRUE
      ORDER BY
        CASE model_type
          WHEN 'random_forest_5m'  THEN 1
          WHEN 'random_forest_10m' THEN 2
          WHEN 'random_forest_15m' THEN 3
          WHEN 'random_forest_30m' THEN 4
          WHEN 'random_forest_60m' THEN 5
          WHEN 'yolo'              THEN 6
          ELSE 99
        END
      `
    );

    const data = result.rows.map((row) => ({
      ...row,
      display_name: MODEL_TYPE_LABELS[row.model_type] ?? row.model_type,
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching active models:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách mô hình",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Lấy chi tiết một model theo ID
 * GET /api/models/:id
 */
export const getModelById = async (req: Request, res: Response) => {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "ID không hợp lệ",
      errors: parsed.error.issues,
    });
  }

  try {
    const result = await pool.query(
      `SELECT
        id, model_type, model_version, minio_key, base_model,
        training_samples, training_duration_hours, metrics, is_active, created_at
       FROM ml_model_metadata
       WHERE id = $1`,
      [parsed.data.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy mô hình" });
    }

    const row = result.rows[0];
    return res.status(200).json({
      success: true,
      data: { ...row, display_name: MODEL_TYPE_LABELS[row.model_type] ?? row.model_type },
    });
  } catch (error) {
    console.error("Error fetching model by id:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy chi tiết mô hình",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Lấy tất cả phiên bản của cùng loại mô hình (lịch sử versions)
 * GET /api/models/:id/history
 */
export const getModelHistory = async (req: Request, res: Response) => {
  const idParsed = idParamSchema.safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json({
      success: false,
      message: "ID không hợp lệ",
      errors: idParsed.error.issues,
    });
  }

  try {
    // Tìm model_type từ ID đã cho
    const baseResult = await pool.query(
      `SELECT model_type FROM ml_model_metadata WHERE id = $1`,
      [idParsed.data.id]
    );

    if (baseResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy mô hình" });
    }

    const { model_type } = baseResult.rows[0];

    // Lấy TẤT CẢ versions của cùng loại, mới nhất trước
    const historyResult = await pool.query(
      `SELECT
        id, model_type, model_version, minio_key, base_model,
        training_samples, training_duration_hours, metrics, is_active, created_at
       FROM ml_model_metadata
       WHERE model_type = $1
       ORDER BY created_at DESC`,
      [model_type]
    );

    return res.status(200).json({
      success: true,
      model_type,
      display_name: MODEL_TYPE_LABELS[model_type] ?? model_type,
      data: historyResult.rows,
    });
  } catch (error) {
    console.error("Error fetching model history:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy lịch sử phiên bản",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Kích hoạt một model version: set is_active=TRUE cho version được chọn,
 * set is_active=FALSE cho tất cả versions còn lại cùng model_type.
 * NOTE: Kubernetes rollout restart sẽ được thêm sau khi có RBAC (Phase 2b).
 * POST /api/models/:id/activate
 */
export const activateModel = async (req: Request, res: Response) => {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "ID không hợp lệ",
      errors: parsed.error.issues,
    });
  }

  const targetId = parsed.data.id;

  // Lấy thông tin model cần kích hoạt
  const targetResult = await pool.query(
    `SELECT id, model_type, model_version FROM ml_model_metadata WHERE id = $1`,
    [targetId]
  );

  if (targetResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: "Không tìm thấy mô hình" });
  }

  const { model_type, model_version } = targetResult.rows[0];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Deactivate tất cả versions cùng loại
    await client.query(
      `UPDATE ml_model_metadata SET is_active = FALSE WHERE model_type = $1`,
      [model_type]
    );

    // Activate version được chọn
    await client.query(
      `UPDATE ml_model_metadata SET is_active = TRUE WHERE id = $1`,
      [targetId]
    );

    await client.query("COMMIT");

    console.info(
      `[Model Activate] ${model_type} → version ${model_version} (id=${targetId})`
    );

    // Gọi image-predict /reload để tải lại model mới theo is_active=TRUE
    // image-predict sẽ download file từ MinIO và cập nhật FIWARE ModelReload entity
    // Non-critical: DB đã commit — nếu lỗi, user vẫn thấy thành công nhưng model chưa load
    let model_reload_triggered = false;
    try {
      const imagePredictUrl = process.env.IMAGE_PREDICT_RELOAD_URL ?? "http://image-predict-service.backend.svc.cluster.local:8080";
      const reloadBody = JSON.stringify({ model_type });

      await new Promise<void>((resolve, reject) => {
        const url = new URL("/reload", imagePredictUrl);
        const isHttps = url.protocol === "https:";
        const httpModule = isHttps ? require("https") : require("http");
        const options: import("http").RequestOptions = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(reloadBody),
          },
        };
        const req = (httpModule as typeof import("http")).request(options, (inner) => {
          let data = "";
          inner.on("data", (chunk: string) => { data += chunk; });
          inner.on("end", () => {
            const code = inner.statusCode ?? 0;
            // 202 Accepted = trigger thành công (reload chạy async)
            if (code >= 200 && code < 300) resolve();
            else reject(new Error(`image-predict /reload ${code}: ${data.slice(0, 200)}`));
          });
        });
        req.on("error", reject);
        req.write(reloadBody);
        req.end();
      });
      model_reload_triggered = true;
      console.info(`[Model Activate] image-predict /reload triggered for ${model_type}`);
    } catch (reloadErr) {
      console.warn(`[Model Activate] /reload skipped: ${reloadErr instanceof Error ? reloadErr.message : reloadErr}`);
    }

    return res.status(200).json({
      success: true,
      message: `Đã kích hoạt phiên bản ${model_version}`,
      data: { id: targetId, model_type, model_version },
      model_reload_triggered,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error activating model:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi kích hoạt mô hình",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    client.release();
  }
};

/**
 * Trả về khoảng thời gian có dữ liệu thực trong bảng camera_detections.
 * Dùng để constrain date picker khi user chọn phạm vi huấn luyện.
 * GET /api/models/data-range
 */
export const getDataRange = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query<{ min_date: string; max_date: string }>(
      `SELECT
         TO_CHAR(MIN(created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS min_date,
         TO_CHAR(MAX(created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS max_date
       FROM camera_detections`
    );
    const { min_date, max_date } = result.rows[0] ?? {};
    if (!min_date || !max_date) {
      return res.status(200).json({ success: true, min_date: null, max_date: null });
    }
    return res.status(200).json({ success: true, min_date, max_date });
  } catch (error) {
    console.error("Error fetching data range:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy phạm vi dữ liệu",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Tạo k8s Job để huấn luyện một phiên bản mới của model RF.
 * Job sẽ chạy train_single.py trong image-predict container.
 * Kết quả (is_active=FALSE) lưu vào DB, user tự kích hoạt sau khi xem metrics.
 * POST /api/models/train
 */
export const trainModel = async (req: Request, res: Response) => {
  const bodySchema = z.object({
    model_type: z.enum([
      "random_forest_5m",
      "random_forest_10m",
      "random_forest_15m",
      "random_forest_30m",
      "random_forest_60m",
    ]),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng YYYY-MM-DD"),
    end_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng YYYY-MM-DD"),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu không hợp lệ",
      errors: parsed.error.issues,
    });
  }

  const { model_type, start_date, end_date } = parsed.data;

  // Tạo job_id và tên Job k8s
  const ts      = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
  const jobName = `train-${model_type.replace(/_/g, "-")}-${ts}`;
  const job_id  = `${model_type}_${ts}`;

  // Env vars khớp với image-predict-deployment.yaml
  const jobEnv: k8s.V1EnvVar[] = [
    { name: "POSTGRES_HOST",     value: process.env.POSTGRES_HOST ?? "postgres-postgresql.database.svc.cluster.local" },
    { name: "POSTGRES_DBS",      value: process.env.POSTGRES_DBS ?? "kltn_db" },
    { name: "POSTGRES_USERNAME", value: process.env.POSTGRES_USERNAME ?? "admin" },
    { name: "POSTGRES_PASSWORD", value: process.env.POSTGRES_PASSWORD ?? "minhtan2003" },
    { name: "POSTGRES_PORT",     value: process.env.POSTGRES_PORT ?? "5432" },
    { name: "FIWARE_ORION_BASE", value: process.env.FIWARE_ORION_BASE ?? "orion-service.database.svc.cluster.local:1026" },
    { name: "MINIO_ENDPOINT_URL",value: process.env.MINIO_ENDPOINT_URL ?? "http://minio.database.svc.cluster.local:9000" },
    { name: "MINIO_ACCESS_KEY",  value: process.env.MINIO_ACCESS_KEY ?? "admin" },
    { name: "MINIO_SECRET_KEY",  value: process.env.MINIO_SECRET_KEY ?? "minhtan2003" },
    { name: "MINIO_BUCKET_NAME", value: "ml-models" },
  ];

  const jobManifest: k8s.V1Job = {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      name: jobName,
      namespace: "backend",
      labels: { app: "train-job", model_type },
    },
    spec: {
      ttlSecondsAfterFinished: 3600, // tự xóa sau 1 giờ
      backoffLimit: 0,               // không retry (FIWARE status sẽ cập nhật failed)
      template: {
        spec: {
          restartPolicy: "Never",
          nodeSelector: { "kubernetes.io/hostname": "worker-node-01" },
          containers: [
            {
              name: "trainer",
              image: IMAGE_PREDICT_IMAGE_FALLBACK, // overridden bởi getImagePredictImage() trong try block
              workingDir: "/app",
              command: [
                "python", "train_single.py",
                "--model_type", model_type,
                "--start_date", start_date,
                "--end_date",   end_date,
                "--job_id",     job_id,
              ],
              env: jobEnv,
              resources: {
                requests: { memory: "2Gi",  cpu: "500m"  },
                limits:   { memory: "4Gi",  cpu: "2000m" },
              },
            },
          ],
        },
      },
    },
  };

  try {
    const image = await getImagePredictImage();
    jobManifest.spec!.template.spec!.containers![0].image = image;

    const { batch } = createK8sClients();
    await batch.createNamespacedJob({ namespace: "backend", body: jobManifest });

    console.info(`[Train Job] Created: ${jobName} (${model_type} | ${start_date} → ${end_date}) image=${image}`);
    return res.status(201).json({
      success: true,
      job_name: jobName,
      job_id,
      status: "created",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isLocal = msg.includes("ECONNREFUSED") || msg.includes("no such file") || msg.includes("Invalid URL");
    console.error(`[Train Job] k8s error:`, msg);
    return res.status(isLocal ? 503 : 500).json({
      success: false,
      message: isLocal
        ? "k8s API không khả dụng (kiểm tra ~/.kube/config hoặc kết nối cluster)"
        : "Lỗi khi tạo training job",
      error: msg,
    });
  }
};

/**
 * Lấy tất cả versions của tất cả model types (dùng cho selector kích hoạt)
 * GET /api/models/all
 */
export const getAllModelVersions = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
        id, model_type, model_version, minio_key, base_model,
        training_samples, training_duration_hours, metrics, is_active, created_at
       FROM ml_model_metadata
       ORDER BY model_type ASC, created_at DESC`
    );

    // Group by model_type
    const grouped: Record<string, unknown[]> = {};
    for (const row of result.rows) {
      const key = row.model_type as string;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        ...row,
        display_name: MODEL_TYPE_LABELS[key] ?? key,
      });
    }

    return res.status(200).json({ success: true, data: grouped });
  } catch (error) {
    console.error("Error fetching all model versions:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách phiên bản",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
