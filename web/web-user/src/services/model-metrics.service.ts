/**
 * Model Metrics Service - API service để lấy dữ liệu hiệu suất model
 */

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL;

if (!BACKEND_API_URL) {
  throw new Error("VITE_BACKEND_URL is not configured in environment variables");
}

export interface HorizonMetric {
  horizon_minutes: number;
  total_predictions: number;
  avg_error: number;
  median_error: number;
  p95_error: number;
  min_error: number;
  max_error: number;
  accuracy_5xe: number;
  accuracy_10xe: number;
  recommendation?: string;
  status?: string;
}

export interface CameraRankingItem {
  camera_id: string;
  predictions_count: number;
  avg_error: number;
  median_error: number;
  error_percentage: number;
  accuracy_5xe: number;
}

export interface ModelMetricsHistoryRow {
  id: number;
  generated_at: string;
  period_days: number;
  overall: {
    total_predictions: number;
    verified_predictions: number;
    mae: number;
    rmse: number;
    mape: number;
    accuracy_5xe: number;
    accuracy_10xe: number;
    accuracy_15xe: number;
    verification_rate: number;
  };
  by_horizon: HorizonMetric[];
  camera_ranking: {
    best: CameraRankingItem[];
    worst: CameraRankingItem[];
  };
  data_coverage: {
    total_predictions: number;
    verified: number;
    pending: number;
    verification_rate: number;
    last_updated: string;
    minutes_since_update: number;
  };
  trend_accuracy: {
    trend_accuracy: number;
    total_checks: number;
    correct_predictions: number;
    correct_increasing: number;
    correct_decreasing: number;
    correct_stable: number;
  };
  created_at: string;
}

interface LatestResponse {
  success: boolean;
  data?: ModelMetricsHistoryRow;
  message?: string;
}

interface HistoryResponse {
  success: boolean;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
  data?: ModelMetricsHistoryRow[];
  message?: string;
}

/**
 * Lấy snapshot metrics model mới nhất
 * GET /api/model-metrics/latest
 */
export async function getLatestModelMetrics(): Promise<ModelMetricsHistoryRow | null> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/model-metrics/latest`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: LatestResponse = await response.json();
    if (result.success && result.data) {
      return result.data;
    }

    return null;
  } catch (error) {
    console.error("❌ Error fetching latest model metrics:", error);
    return null;
  }
}

/**
 * Lấy lịch sử metrics model theo phân trang
 * GET /api/model-metrics/history
 */
export async function getModelMetricsHistory(limit: number = 20): Promise<ModelMetricsHistoryRow[]> {
  try {
    const response = await fetch(
      `${BACKEND_API_URL}/api/model-metrics/history?limit=${limit}&offset=0`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: HistoryResponse = await response.json();
    if (result.success && Array.isArray(result.data)) {
      return result.data;
    }

    return [];
  } catch (error) {
    console.error("❌ Error fetching model metrics history:", error);
    return [];
  }
}
