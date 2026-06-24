/**
 * Mock cho model-metrics.service.ts — số liệu hiệu năng model dùng cho trang Analytics.
 */
import type { CameraRankingItem, HorizonMetric, ModelMetricsHistoryRow } from "@/services/model-metrics.service";
import { CAMERA_SEEDS } from "./cameras";
import { getOrSeed } from "../engine/store";
import { jitter, rand, randInt, round1, round2 } from "../engine/utils";

const KEY = "model_metrics_history";
const HORIZONS = [5, 10, 15, 30, 60];

function buildHorizonMetric(h: number): HorizonMetric {
  // Horizon càng lớn → sai số càng cao, độ chính xác càng thấp (giống thực tế dự báo)
  const scale = 1 + h / 30;
  const avgError = round2(rand(2, 5) * scale);
  return {
    horizon_minutes: h,
    total_predictions: randInt(800, 5000),
    avg_error: avgError,
    median_error: round2(avgError * rand(0.8, 1.0)),
    p95_error: round2(avgError * rand(2.2, 3.2)),
    min_error: round2(avgError * 0.1),
    max_error: round2(avgError * rand(4, 7)),
    accuracy_5xe: round1(clampPct(92 - h * 0.5 + jitter(0, 4))),
    accuracy_10xe: round1(clampPct(97 - h * 0.25 + jitter(0, 2))),
    recommendation: h <= 15 ? "Mô hình đang hoạt động tốt" : "Cân nhắc huấn luyện lại nếu độ lệch tiếp tục tăng",
    status: h <= 30 ? "healthy" : "watch",
    prediction_confidence: { score: round1(80 - h * 0.3), level: h <= 15 ? "high" : "medium", low_sample_count: randInt(0, 5) },
    error_confidence: { score: round1(85 - h * 0.25), level: h <= 15 ? "high" : "medium", mismatch_count: randInt(0, 8) },
  };
}

function clampPct(v: number): number {
  return Math.min(99.5, Math.max(40, v));
}

function buildCameraRanking(): { best: CameraRankingItem[]; worst: CameraRankingItem[] } {
  const items: CameraRankingItem[] = CAMERA_SEEDS.map((seed) => {
    const avgError = round2(rand(1.5, 9));
    return {
      camera_id: seed.cam_id,
      predictions_count: randInt(200, 3000),
      avg_error: avgError,
      median_error: round2(avgError * rand(0.8, 1.0)),
      error_percentage: round1(rand(3, 22)),
      accuracy_5xe: round1(clampPct(95 - avgError * 4)),
    };
  });
  const sorted = [...items].sort((a, b) => a.avg_error - b.avg_error);
  return { best: sorted.slice(0, 5), worst: sorted.slice(-5).reverse() };
}

function buildRow(generatedAt: Date, periodDays: number): ModelMetricsHistoryRow {
  const mae = round2(rand(2.5, 5.5));
  const totalPred = randInt(15000, 60000);
  const verified = Math.round(totalPred * rand(0.85, 0.97));
  return {
    id: Math.round(generatedAt.getTime() / 1000),
    generated_at: generatedAt.toISOString(),
    period_days: periodDays,
    overall: {
      total_predictions: totalPred,
      verified_predictions: verified,
      mae,
      rmse: round2(mae * rand(1.3, 1.7)),
      mape: round1(rand(8, 20)),
      accuracy_5xe: round1(clampPct(90 + jitter(0, 6))),
      accuracy_10xe: round1(clampPct(96 + jitter(0, 3))),
      accuracy_15xe: round1(clampPct(98 + jitter(0, 1.5))),
      verification_rate: round1((verified / totalPred) * 100),
      avg_input_samples: round1(rand(8, 14)),
      avg_lag_samples: round1(rand(4, 8)),
      avg_sync_samples: round1(rand(6, 11)),
      low_sample_forecasts: randInt(0, 40),
      mismatched_syncs: randInt(0, 25),
      prediction_confidence: { score: round1(rand(70, 92)), level: "high", avg_input_samples: round1(rand(8, 14)), avg_lag_samples: round1(rand(4, 8)), low_sample_count: randInt(0, 40) },
      error_confidence: { score: round1(rand(75, 95)), level: "high", avg_sync_samples: round1(rand(6, 11)), mismatched_count: randInt(0, 25) },
    },
    by_horizon: HORIZONS.map(buildHorizonMetric),
    camera_ranking: buildCameraRanking(),
    data_coverage: {
      total_predictions: totalPred,
      verified,
      pending: totalPred - verified,
      verification_rate: round1((verified / totalPred) * 100),
      last_updated: new Date().toISOString(),
      minutes_since_update: randInt(0, 20),
    },
    trend_accuracy: {
      trend_accuracy: round1(rand(72, 90)),
      total_checks: randInt(500, 2000),
      correct_predictions: randInt(400, 1800),
      correct_increasing: randInt(100, 600),
      correct_decreasing: randInt(100, 600),
      correct_stable: randInt(100, 600),
      incomplete_groups: randInt(0, 15),
      horizon_coverage_pct: round1(rand(85, 99)),
      method: "directional_match",
      per_horizon: HORIZONS.map((h) => ({
        horizon_minutes: h,
        trend_accuracy: round1(rand(68, 92)),
        total_checks: randInt(100, 400),
        correct_predictions: randInt(70, 380),
        correct_increasing: randInt(20, 130),
        correct_decreasing: randInt(20, 130),
        correct_stable: randInt(20, 130),
      })),
    },
    confidence_distribution: {
      total_records: totalPred,
      verified_records: verified,
      avg_input_samples: round1(rand(8, 14)),
      avg_lag_samples: round1(rand(4, 8)),
      avg_sync_samples: round1(rand(6, 11)),
      high_quality_predictions: Math.round(verified * rand(0.75, 0.9)),
      low_quality_predictions: Math.round(verified * rand(0.1, 0.25)),
      high_quality_percent: round1(rand(75, 90)),
      low_quality_percent: round1(rand(10, 25)),
      consistent_syncs: Math.round(verified * rand(0.8, 0.95)),
      inconsistent_syncs: Math.round(verified * rand(0.05, 0.2)),
      consistent_sync_percent: round1(rand(80, 95)),
      inconsistent_sync_percent: round1(rand(5, 20)),
    },
    created_at: generatedAt.toISOString(),
  };
}

function seedHistory(): ModelMetricsHistoryRow[] {
  const rows: ModelMetricsHistoryRow[] = [];
  for (let i = 0; i < 14; i++) {
    const date = new Date(Date.now() - i * 86_400_000);
    rows.push(buildRow(date, 7));
  }
  return rows;
}

export function getModelMetricsHistory(limit: number): ModelMetricsHistoryRow[] {
  const rows = getOrSeed(KEY, seedHistory);
  return rows.slice(0, limit);
}

export function getLatestModelMetrics(): ModelMetricsHistoryRow {
  const rows = getOrSeed(KEY, seedHistory);
  // Làm "tươi" bản ghi mới nhất mỗi lần gọi để cảm giác như đang cập nhật liên tục
  const fresh = buildRow(new Date(), 7);
  return { ...fresh, id: rows[0]?.id ?? fresh.id };
}
