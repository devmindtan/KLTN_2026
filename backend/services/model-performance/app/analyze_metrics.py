"""
Service phân tích performance metrics của ML model dự đoán giao thông
Tính toán MAE, MAPE, RMSE, Accuracy rates, và phân tích theo horizon/camera
"""

from shared.monitor_performance import monitor_performance
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Dict, List, Optional

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.pool import QueuePool

sys.path.append(os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")))


load_dotenv()

# ENV
POSTGRES_HOST = os.getenv("POSTGRES_HOST")
POSTGRES_DBS = os.getenv("POSTGRES_DBS")
POSTGRES_USERNAME = os.getenv("POSTGRES_USERNAME")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", 5432))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Database connection
DATABASE_URL = f"postgresql://{POSTGRES_USERNAME}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DBS}"
engine = create_engine(
    DATABASE_URL, poolclass=QueuePool, pool_size=10, max_overflow=20, pool_timeout=30
)


def calculate_prediction_confidence(input_count: int, lag_count: int) -> Dict:
    """
    Tính độ tin cậy của dự đoán dựa trên input_sample_count vs lag_sample_count
    Args:
        input_count: Số hình ảnh trong bucket hiện tại (input)
        lag_count: Số hình ảnh trong LAG window tương ứng horizon
    Returns:
        Dict {score: 0-1, level: High/Medium/Low, reason: str}
    """
    # Handle None values
    if input_count is None or lag_count is None:
        return {"score": 0.0, "level": "Low", "reason": "Missing sample count data"}

    # Nếu 1 trong 2 có sample count quá thấp (<10) → Low confidence
    if input_count < 10 or lag_count < 10:
        return {
            "score": 0.3,
            "level": "Low",
            "reason": f"Insufficient samples (input:{input_count}, lag:{lag_count})"
        }

    # Tính % chênh lệch
    max_count = max(input_count, lag_count)
    diff_percent = abs(input_count - lag_count) / max_count * 100

    # Tính confidence score (0-1)
    # Công thức: 1 - (diff_percent / 100), bounded [0, 1]
    score = max(0.0, min(1.0, 1 - (diff_percent / 100)))

    # Phân loại level
    if input_count >= 30 and lag_count >= 30 and diff_percent < 20:
        level = "High"
        reason = f"Both buckets have sufficient samples (input:{input_count}, lag:{lag_count})"
    elif diff_percent < 40:
        level = "Medium"
        reason = f"Moderate difference ({diff_percent:.1f}%) between input and lag samples"
    else:
        level = "Low"
        reason = f"Large difference ({diff_percent:.1f}%) between input:{input_count} and lag:{lag_count}"

    return {"score": round(score, 3), "level": level, "reason": reason}


def calculate_error_confidence(input_count: int, sync_count: int) -> Dict:
    """
    Tính độ tin cậy của error value dựa trên input_sample_count vs sync_sample_count
    Args:
        input_count: Số hình ảnh khi predict
        sync_count: Số hình ảnh khi sync actual value
    Returns:
        Dict {score: 0-1, level: High/Medium/Low, reason: str}
    """
    # Handle None values
    if input_count is None or sync_count is None:
        return {"score": 0.0, "level": "Low", "reason": "Missing sample count data"}

    # Tính absolute difference
    abs_diff = abs(input_count - sync_count)

    # Nếu 1 trong 2 có sample count quá thấp (<10) → Low confidence
    if input_count < 10 or sync_count < 10:
        return {
            "score": 0.3,
            "level": "Low",
            "reason": f"Insufficient samples (input:{input_count}, sync:{sync_count})"
        }

    # Data mismatch (chênh lệch >5 samples) → Low-Medium confidence
    if abs_diff > 5:
        # Tính % mismatch
        max_count = max(input_count, sync_count)
        mismatch_percent = abs_diff / max_count * 100

        if mismatch_percent > 30:
            return {
                "score": 0.4,
                "level": "Low",
                "reason": f"Data mismatch ({abs_diff} samples diff, {mismatch_percent:.1f}%)"
            }
        else:
            return {
                "score": 0.6,
                "level": "Medium",
                "reason": f"Slight data mismatch ({abs_diff} samples diff)"
            }

    # Xấp xỉ nhau (|diff| <= 5) và cả 2 >= 30 → High confidence
    if input_count >= 30 and sync_count >= 30:
        score = 0.95
        level = "High"
        reason = f"Consistent data windows (input:{input_count}, sync:{sync_count})"
    else:
        score = 0.75
        level = "Medium"
        reason = f"Acceptable samples but below optimal (input:{input_count}, sync:{sync_count})"

    return {"score": score, "level": level, "reason": reason}


class ModelPerformanceAnalyzer:
    """
    Analyzer cho ML model performance metrics
    Tính toán độ chính xác, phân tích horizons, ranking cameras
    """

    def __init__(self, db_engine):
        self.engine = db_engine
        logger.info("ModelPerformanceAnalyzer initialized")

    @monitor_performance
    def calculate_overall_metrics(self, period_days: int = 7) -> Dict:
        """
        Tính toán overall metrics: MAE, RMSE, MAPE, Accuracy rates + Confidence scores
        Args:
            period_days: Số ngày lịch sử để phân tích (default: 7)
        Returns:
            Dict chứa các metrics tổng quan bao gồm prediction & error confidence
        """
        query = text("""
            SELECT 
                COUNT(*) as total_predictions,
                COUNT(*) FILTER (WHERE error_value IS NOT NULL) as verified_predictions,
                ROUND(AVG(error_value)::numeric, 2) as mae,
                ROUND(SQRT(AVG(POWER(error_value, 2)))::numeric, 2) as rmse,
                ROUND(AVG((error_value / NULLIF(actual_value, 0) * 100)) FILTER (WHERE actual_value >= 5)::numeric, 2) as mape,
                ROUND(COUNT(*) FILTER (WHERE error_value <= 5)::numeric / COUNT(*) FILTER (WHERE error_value IS NOT NULL) * 100, 1) as accuracy_5xe,
                ROUND(COUNT(*) FILTER (WHERE error_value <= 10)::numeric / COUNT(*) FILTER (WHERE error_value IS NOT NULL) * 100, 1) as accuracy_10xe,
                ROUND(COUNT(*) FILTER (WHERE error_value <= 15)::numeric / COUNT(*) FILTER (WHERE error_value IS NOT NULL) * 100, 1) as accuracy_15xe,
                
                -- Sample count statistics for confidence calculation
                ROUND(AVG(input_sample_count)::numeric, 1) as avg_input_samples,
                ROUND(AVG(lag_sample_count)::numeric, 1) as avg_lag_samples,
                ROUND(AVG(sync_sample_count) FILTER (WHERE sync_sample_count IS NOT NULL)::numeric, 1) as avg_sync_samples,
                COUNT(*) FILTER (WHERE input_sample_count < 10 OR lag_sample_count < 10) as low_sample_forecasts,
                COUNT(*) FILTER (WHERE ABS(input_sample_count - COALESCE(sync_sample_count, input_sample_count)) > 5) as mismatched_syncs
            FROM camera_forecasts
            WHERE forecast_for_time >= NOW() - make_interval(days => :days)
              AND error_value IS NOT NULL
        """)

        try:
            with self.engine.connect() as conn:
                result = conn.execute(query, {"days": period_days}).fetchone()
                
                # Handle empty result
                if not result:
                    logger.warning(f"⚠️ No data found for period_days={period_days}. Returning default metrics.")
                    return {
                        "total_predictions": 0,
                        "verified_predictions": 0,
                        "mae": 0.0,
                        "rmse": 0.0,
                        "mape": 0.0,
                        "accuracy_5xe": 0.0,
                        "accuracy_10xe": 0.0,
                        "accuracy_15xe": 0.0,
                        "verification_rate": 0.0,
                        "prediction_confidence": {"score": 0.0, "level": "Low", "avg_input_samples": 0, "avg_lag_samples": 0, "low_sample_count": 0},
                        "error_confidence": {"score": 0.0, "level": "Low", "avg_sync_samples": 0, "mismatched_count": 0}
                    }
                
                metrics = dict(result._mapping)

                # Calculate verification rate
                if metrics["total_predictions"] > 0:
                    metrics["verification_rate"] = round(
                        metrics["verified_predictions"] /
                        metrics["total_predictions"] * 100, 1
                    )
                else:
                    metrics["verification_rate"] = 0.0

                # Calculate average confidence scores
                avg_input = metrics.get("avg_input_samples", 0) or 0
                avg_lag = metrics.get("avg_lag_samples", 0) or 0
                avg_sync = metrics.get("avg_sync_samples", 0) or 0

                pred_confidence = calculate_prediction_confidence(
                    int(avg_input), int(avg_lag))
                error_confidence = calculate_error_confidence(
                    int(avg_input), int(avg_sync))

                metrics["prediction_confidence"] = {
                    "score": pred_confidence["score"],
                    "level": pred_confidence["level"],
                    "avg_input_samples": avg_input,
                    "avg_lag_samples": avg_lag,
                    "low_sample_count": metrics.get("low_sample_forecasts", 0)
                }

                metrics["error_confidence"] = {
                    "score": error_confidence["score"],
                    "level": error_confidence["level"],
                    "avg_sync_samples": avg_sync,
                    "mismatched_count": metrics.get("mismatched_syncs", 0)
                }

                logger.info(
                    f"Overall metrics: MAE={metrics['mae']}, MAPE={metrics['mape']}%, "
                    f"Accuracy≤5xe={metrics['accuracy_5xe']}%, "
                    f"Pred Confidence={pred_confidence['level']}, Error Confidence={error_confidence['level']}"
                )
                return metrics

        except Exception as e:
            logger.error(f"Error calculating overall metrics: {e}")
            # Return default structure to prevent crash
            return {
                "total_predictions": 0,
                "verified_predictions": 0,
                "mae": 0.0,
                "rmse": 0.0,
                "mape": 0.0,
                "accuracy_5xe": 0.0,
                "accuracy_10xe": 0.0,
                "accuracy_15xe": 0.0,
                "verification_rate": 0.0,
                "prediction_confidence": {"score": 0.0, "level": "Low", "avg_input_samples": 0, "avg_lag_samples": 0, "low_sample_count": 0},
                "error_confidence": {"score": 0.0, "level": "Low", "avg_sync_samples": 0, "mismatched_count": 0}
            }

    @monitor_performance
    def analyze_by_horizon(self, period_days: int = 7) -> List[Dict]:
        """
        Phân tích performance theo từng horizon (5m, 10m, 15m, 30m, 60m) + confidence scores
        Args:
            period_days: Số ngày lịch sử để phân tích
        Returns:
            List[Dict] metrics cho mỗi horizon bao gồm prediction & error confidence
        """
        query = text("""
            SELECT 
                horizon_minutes,
                COUNT(*) as total_predictions,
                ROUND(AVG(error_value)::numeric, 2) as avg_error,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY error_value)::numeric, 2) as median_error,
                ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY error_value)::numeric, 2) as p95_error,
                ROUND(MIN(error_value)::numeric, 2) as min_error,
                ROUND(MAX(error_value)::numeric, 2) as max_error,
                ROUND(COUNT(*) FILTER (WHERE error_value <= 5)::numeric / COUNT(*) * 100, 1) as accuracy_5xe,
                ROUND(COUNT(*) FILTER (WHERE error_value <= 10)::numeric / COUNT(*) * 100, 1) as accuracy_10xe,
                
                -- Sample count statistics per horizon
                ROUND(AVG(input_sample_count)::numeric, 1) as avg_input_samples,
                ROUND(AVG(lag_sample_count)::numeric, 1) as avg_lag_samples,
                ROUND(AVG(sync_sample_count) FILTER (WHERE sync_sample_count IS NOT NULL)::numeric, 1) as avg_sync_samples,
                COUNT(*) FILTER (WHERE input_sample_count < 10 OR lag_sample_count < 10) as low_sample_count,
                COUNT(*) FILTER (WHERE ABS(input_sample_count - COALESCE(sync_sample_count, input_sample_count)) > 5) as mismatch_count
            FROM camera_forecasts
            WHERE error_value IS NOT NULL
              AND forecast_for_time >= NOW() - make_interval(days => :days)
            GROUP BY horizon_minutes
            ORDER BY horizon_minutes
        """)

        try:
            with self.engine.connect() as conn:
                results = conn.execute(query, {"days": period_days}).fetchall()
                
                # Handle empty results
                if not results:
                    logger.warning(f"⚠️ No horizon data found for period_days={period_days}. Returning empty list.")
                    return []
                
                horizons = [dict(row._mapping) for row in results]

                # Add recommendations and confidence scores
                for h in horizons:
                    # Original recommendation logic
                    if h["avg_error"] < 4:
                        h["recommendation"] = "KEEP"
                        h["status"] = "good"
                    elif h["avg_error"] < 6:
                        h["recommendation"] = "OPTIONAL"
                        h["status"] = "fair"
                    else:
                        h["recommendation"] = "DROP"
                        h["status"] = "poor"

                    # Calculate confidence scores
                    avg_input = int(h.get("avg_input_samples", 0) or 0)
                    avg_lag = int(h.get("avg_lag_samples", 0) or 0)
                    avg_sync = int(h.get("avg_sync_samples", 0) or 0)

                    pred_conf = calculate_prediction_confidence(
                        avg_input, avg_lag)
                    error_conf = calculate_error_confidence(
                        avg_input, avg_sync)

                    h["prediction_confidence"] = {
                        "score": pred_conf["score"],
                        "level": pred_conf["level"],
                        "low_sample_count": h.get("low_sample_count", 0)
                    }

                    h["error_confidence"] = {
                        "score": error_conf["score"],
                        "level": error_conf["level"],
                        "mismatch_count": h.get("mismatch_count", 0)
                    }

                logger.info(
                    f"Analyzed {len(horizons)} horizons with confidence scores")
                return horizons

        except Exception as e:
            logger.error(f"Error analyzing horizons: {e}")
            return []

    @monitor_performance
    def rank_cameras(
        self, period_days: int = 7, top_n: int = 5, horizon_filter: Optional[int] = None
    ) -> Dict:
        """
        Ranking cameras theo performance (best & worst)
        Args:
            period_days: Số ngày lịch sử
            top_n: Số lượng cameras trong top/bottom
            horizon_filter: Lọc theo horizon cụ thể (None = all horizons)
        Returns:
            Dict {"best": [...], "worst": [...]}
        """
        query = text("""
            SELECT 
                c.camera_id,
                COUNT(*) as predictions_count,
                ROUND(AVG(c.error_value)::numeric, 2) as avg_error,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c.error_value)::numeric, 2) as median_error,
                ROUND((AVG(c.error_value) / NULLIF(AVG(c.actual_value), 0) * 100)::numeric, 1) as error_percentage,
                ROUND(COUNT(*) FILTER (WHERE c.error_value <= 5)::numeric / COUNT(*) * 100, 1) as accuracy_5xe
            FROM camera_forecasts c
            WHERE c.error_value IS NOT NULL
              AND c.forecast_for_time >= NOW() - make_interval(days => :days)
              AND (:horizon IS NULL OR c.horizon_minutes = :horizon)
            GROUP BY c.camera_id
            HAVING COUNT(*) >= 50
            ORDER BY avg_error ASC
        """)

        try:
            with self.engine.connect() as conn:
                results = conn.execute(
                    query, {"days": period_days, "horizon": horizon_filter}
                ).fetchall()
                all_cameras = [dict(row._mapping) for row in results]

                if not all_cameras:
                    logger.warning("No camera data found")
                    return {"best": [], "worst": []}

                best = all_cameras[:top_n]
                # Reverse để worst nhất lên đầu
                worst = all_cameras[-top_n:][::-1]

                logger.info(
                    f"Ranked {len(all_cameras)} cameras. Best MAE: {best[0]['avg_error']}, "
                    f"Worst MAE: {worst[0]['avg_error']}"
                )

                return {"best": best, "worst": worst}

        except Exception as e:
            logger.error(f"Error ranking cameras: {e}")
            return {"best": [], "worst": []}

    @monitor_performance
    def calculate_data_coverage(self, period_days: int = 7) -> Dict:
        """
        Tính verification rate và data freshness
        Args:
            period_days: Số ngày lịch sử
        Returns:
            Dict chứa coverage metrics
        """
        query = text("""
            SELECT 
                COUNT(*) as total_predictions,
                COUNT(*) FILTER (WHERE error_value IS NOT NULL) as verified,
                COUNT(*) FILTER (WHERE error_value IS NULL) as pending,
                ROUND(COUNT(*) FILTER (WHERE error_value IS NOT NULL)::numeric / COUNT(*) * 100, 1) as verification_rate,
                MAX(created_at) FILTER (WHERE error_value IS NOT NULL) as last_verification_time
            FROM camera_forecasts
            WHERE forecast_for_time >= NOW() - make_interval(days => :days)
        """)

        try:
            with self.engine.connect() as conn:
                result = conn.execute(query, {"days": period_days}).fetchone()
                
                # Handle empty result
                if not result:
                    logger.warning(f"⚠️ No coverage data found for period_days={period_days}. Returning default.")
                    return {
                        "total_predictions": 0,
                        "verified": 0,
                        "pending": 0,
                        "verification_rate": 0.0,
                        "last_verification_time": None,
                        "minutes_since_update": None
                    }
                
                coverage = dict(result._mapping)

                # Calculate minutes since last update
                if coverage["last_verification_time"]:
                    from datetime import datetime, timezone

                    now = datetime.now(timezone.utc)
                    last_update = coverage["last_verification_time"]
                    if last_update.tzinfo is None:
                        # Make aware if naive
                        from datetime import timezone

                        last_update = last_update.replace(tzinfo=timezone.utc)

                    delta = now - last_update
                    coverage["minutes_since_update"] = round(
                        delta.total_seconds() / 60, 1)
                else:
                    coverage["minutes_since_update"] = None

                logger.info(
                    f"Data coverage: {coverage['verification_rate']}% verified, "
                    f"Last update: {coverage['minutes_since_update']} minutes ago"
                )

                return coverage

        except Exception as e:
            logger.error(f"Error calculating data coverage: {e}")
            return {
                "total_predictions": 0,
                "verified": 0,
                "pending": 0,
                "verification_rate": 0.0,
                "last_verification_time": None,
                "minutes_since_update": None
            }

    @monitor_performance
    def calculate_trend_accuracy(self, period_days: int = 7) -> Dict:
        """
        Tính accuracy của trend predictions (increasing/decreasing/stable)
        Args:
            period_days: Số ngày lịch sử
        Returns:
            Dict chứa trend accuracy metrics
        """
        query = text("""
            WITH trend_analysis AS (
                SELECT 
                    camera_id,
                    forecast_for_time,
                    horizon_minutes,
                    predicted_value,
                    actual_value,
                    error_value,
                    LAG(actual_value) OVER (PARTITION BY camera_id ORDER BY forecast_for_time) as prev_actual,
                    -- Predicted trend (so với previous actual)
                    CASE 
                        WHEN predicted_value > LAG(actual_value) OVER (PARTITION BY camera_id ORDER BY forecast_for_time)
                        THEN 'increasing'
                        WHEN predicted_value < LAG(actual_value) OVER (PARTITION BY camera_id ORDER BY forecast_for_time)
                        THEN 'decreasing'
                        ELSE 'stable'
                    END as predicted_trend,
                    -- Actual trend
                    CASE 
                        WHEN actual_value > LAG(actual_value) OVER (PARTITION BY camera_id ORDER BY forecast_for_time)
                        THEN 'increasing'
                        WHEN actual_value < LAG(actual_value) OVER (PARTITION BY camera_id ORDER BY forecast_for_time)
                        THEN 'decreasing'
                        ELSE 'stable'
                    END as actual_trend
                FROM camera_forecasts
                WHERE horizon_minutes = 5
                  AND error_value IS NOT NULL
                  AND forecast_for_time >= NOW() - make_interval(days => :days)
            )
            SELECT 
                ROUND(COUNT(*) FILTER (WHERE predicted_trend = actual_trend)::numeric / COUNT(*) * 100, 1) as trend_accuracy,
                COUNT(*) as total_checks,
                COUNT(*) FILTER (WHERE predicted_trend = actual_trend) as correct_predictions,
                COUNT(*) FILTER (WHERE predicted_trend = 'increasing' AND actual_trend = 'increasing') as correct_increasing,
                COUNT(*) FILTER (WHERE predicted_trend = 'decreasing' AND actual_trend = 'decreasing') as correct_decreasing,
                COUNT(*) FILTER (WHERE predicted_trend = 'stable' AND actual_trend = 'stable') as correct_stable
            FROM trend_analysis
            WHERE prev_actual IS NOT NULL
        """)

        try:
            with self.engine.connect() as conn:
                result = conn.execute(query, {"days": period_days}).fetchone()
                
                # Handle empty result
                if not result:
                    logger.warning(f"⚠️ No trend data found for period_days={period_days}. Returning default.")
                    return {
                        "trend_accuracy": 0.0,
                        "total_checks": 0,
                        "correct_predictions": 0,
                        "correct_increasing": 0,
                        "correct_decreasing": 0,
                        "correct_stable": 0
                    }
                
                trend_metrics = dict(result._mapping)

                logger.info(
                    f"Trend accuracy: {trend_metrics['trend_accuracy']}% "
                    f"({trend_metrics['correct_predictions']}/{trend_metrics['total_checks']})"
                )

                return trend_metrics

        except Exception as e:
            logger.error(f"Error calculating trend accuracy: {e}")
            return {
                "trend_accuracy": 0.0,
                "total_checks": 0,
                "correct_predictions": 0,
                "correct_increasing": 0,
                "correct_decreasing": 0,
                "correct_stable": 0
            }

    @monitor_performance
    def analyze_confidence_distribution(self, period_days: int = 7) -> Dict:
        """
        Phân tích phân phối confidence scores - giúp đánh giá data quality tổng thể
        Args:
            period_days: Số ngày lịch sử để phân tích
        Returns:
            Dict chứa confidence distribution statistics
        """
        query = text("""
            SELECT 
                -- Overall sample statistics
                COUNT(*) as total_records,
                COUNT(*) FILTER (WHERE error_value IS NOT NULL) as verified_records,
                
                -- Prediction confidence factors (input vs lag)
                ROUND(AVG(input_sample_count)::numeric, 1) as avg_input_samples,
                ROUND(AVG(lag_sample_count)::numeric, 1) as avg_lag_samples,
                ROUND(STDDEV(input_sample_count)::numeric, 1) as stddev_input_samples,
                
                -- Distribution by sample count thresholds
                COUNT(*) FILTER (WHERE input_sample_count >= 30 AND lag_sample_count >= 30) as high_quality_predictions,
                COUNT(*) FILTER (WHERE input_sample_count < 10 OR lag_sample_count < 10) as low_quality_predictions,
                
                -- Error confidence factors (input vs sync)
                ROUND(AVG(sync_sample_count) FILTER (WHERE sync_sample_count IS NOT NULL)::numeric, 1) as avg_sync_samples,
                COUNT(*) FILTER (WHERE ABS(input_sample_count - COALESCE(sync_sample_count, input_sample_count)) <= 5) as consistent_syncs,
                COUNT(*) FILTER (WHERE ABS(input_sample_count - COALESCE(sync_sample_count, input_sample_count)) > 5) as inconsistent_syncs,
                
                -- Sample count ranges
                MIN(input_sample_count) as min_input_samples,
                MAX(input_sample_count) as max_input_samples,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY input_sample_count) as median_input_samples
                
            FROM camera_forecasts  
            WHERE forecast_for_time >= NOW() - make_interval(days => :days)
        """)

        try:
            with self.engine.connect() as conn:
                result = conn.execute(query, {"days": period_days}).fetchone()
                
                # Handle empty result
                if not result:
                    logger.warning(f"⚠️ No confidence data found for period_days={period_days}. Returning default.")
                    return {
                        "total_records": 0,
                        "verified_records": 0,
                        "avg_input_samples": 0.0,
                        "avg_lag_samples": 0.0,
                        "stddev_input_samples": 0.0,
                        "high_quality_predictions": 0,
                        "low_quality_predictions": 0,
                        "avg_sync_samples": 0.0,
                        "consistent_syncs": 0,
                        "inconsistent_syncs": 0,
                        "min_input_samples": 0,
                        "max_input_samples": 0,
                        "median_input_samples": 0.0,
                        "high_quality_percent": 0.0,
                        "low_quality_percent": 0.0,
                        "consistent_sync_percent": 0.0,
                        "inconsistent_sync_percent": 0.0
                    }
                
                stats = dict(result._mapping)

                # Calculate percentages
                total = stats.get("total_records", 0)
                if total > 0:
                    stats["high_quality_percent"] = round(
                        stats.get("high_quality_predictions", 0) /
                        total * 100, 1
                    )
                    stats["low_quality_percent"] = round(
                        stats.get("low_quality_predictions", 0) /
                        total * 100, 1
                    )

                    verified = stats.get("verified_records", 0)
                    if verified > 0:
                        stats["consistent_sync_percent"] = round(
                            stats.get("consistent_syncs", 0) /
                            verified * 100, 1
                        )
                        stats["inconsistent_sync_percent"] = round(
                            stats.get("inconsistent_syncs", 0) /
                            verified * 100, 1
                        )

                logger.info(
                    f"Confidence distribution: {stats.get('high_quality_percent', 0)}% high quality, "
                    f"{stats.get('low_quality_percent', 0)}% low quality predictions"
                )

                return stats

        except Exception as e:
            logger.error(f"Error analyzing confidence distribution: {e}")
            return {
                "total_records": 0,
                "verified_records": 0,
                "avg_input_samples": 0.0,
                "avg_lag_samples": 0.0,
                "stddev_input_samples": 0.0,
                "high_quality_predictions": 0,
                "low_quality_predictions": 0,
                "avg_sync_samples": 0.0,
                "consistent_syncs": 0,
                "inconsistent_syncs": 0,
                "min_input_samples": 0,
                "max_input_samples": 0,
                "median_input_samples": 0.0,
                "high_quality_percent": 0.0,
                "low_quality_percent": 0.0,
                "consistent_sync_percent": 0.0,
                "inconsistent_sync_percent": 0.0
            }

    @monitor_performance
    def get_full_report(self, period_days: int = 7) -> Dict:
        """
        Tổng hợp toàn bộ metrics vào 1 report bao gồm confidence analysis
        Args:
            period_days: Số ngày lịch sử để phân tích
        Returns:
            Dict chứa toàn bộ metrics + confidence scores
        """
        logger.info(
            f"Generating full performance report for last {period_days} days...")

        report = {
            "period_days": period_days,
            "generated_at": datetime.utcnow().isoformat(),
            "overall": self.calculate_overall_metrics(period_days),
            "by_horizon": self.analyze_by_horizon(period_days),
            "camera_ranking": self.rank_cameras(period_days, top_n=5),
            "data_coverage": self.calculate_data_coverage(period_days),
            "trend_accuracy": self.calculate_trend_accuracy(period_days),
            "confidence_distribution": self.analyze_confidence_distribution(period_days),
        }

        logger.info(
            "✅ Full report generated successfully with confidence metrics")
        return report


# Test functions
if __name__ == "__main__":
    analyzer = ModelPerformanceAnalyzer(engine)

    # Test overall metrics
    print("\n" + "=" * 60)
    print("OVERALL METRICS")
    print("=" * 60)
    overall = analyzer.calculate_overall_metrics(period_days=7)
    for key, value in overall.items():
        print(f"{key:25s}: {value}")

    # Test horizon analysis
    print("\n" + "=" * 60)
    print("HORIZON ANALYSIS")
    print("=" * 60)
    horizons = analyzer.analyze_by_horizon(period_days=7)
    for h in horizons:
        print(
            f"Horizon {h['horizon_minutes']:2d}m: MAE={h['avg_error']:5.2f} "
            f"Acc≤5xe={h['accuracy_5xe']:5.1f}% → {h['recommendation']}"
        )

    # Test camera ranking
    print("\n" + "=" * 60)
    print("CAMERA RANKING")
    print("=" * 60)
    ranking = analyzer.rank_cameras(period_days=7, top_n=3)
    print("\n✅ TOP 3 BEST:")
    for i, cam in enumerate(ranking["best"], 1):
        print(
            f"  {i}. {cam['display_name']:30s}: MAE={cam['avg_error']:5.2f} "
            f"Acc={cam['accuracy_5xe']:5.1f}%"
        )
    print("\n❌ TOP 3 WORST:")
    for i, cam in enumerate(ranking["worst"], 1):
        print(
            f"  {i}. {cam['display_name']:30s}: MAE={cam['avg_error']:5.2f} "
            f"Acc={cam['accuracy_5xe']:5.1f}%"
        )

    # Test data coverage
    print("\n" + "=" * 60)
    print("DATA COVERAGE")
    print("=" * 60)
    coverage = analyzer.calculate_data_coverage(period_days=7)
    for key, value in coverage.items():
        print(f"{key:25s}: {value}")

    # Test trend accuracy
    print("\n" + "=" * 60)
    print("TREND ACCURACY")
    print("=" * 60)
    trend = analyzer.calculate_trend_accuracy(period_days=7)
    for key, value in trend.items():
        print(f"{key:25s}: {value}")
