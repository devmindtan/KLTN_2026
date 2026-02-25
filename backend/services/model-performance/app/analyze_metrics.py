"""
Service phân tích performance metrics của ML model dự đoán giao thông
Tính toán MAE, MAPE, RMSE, Accuracy rates, và phân tích theo horizon/camera
"""

from shared.monitor_performance import monitor_performance
import logging
import os
import sys
from datetime import datetime
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
        Tính toán overall metrics: MAE, RMSE, MAPE, Accuracy rates
        Args:
            period_days: Số ngày lịch sử để phân tích (default: 7)
        Returns:
            Dict chứa các metrics tổng quan
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
                ROUND(COUNT(*) FILTER (WHERE error_value <= 15)::numeric / COUNT(*) FILTER (WHERE error_value IS NOT NULL) * 100, 1) as accuracy_15xe
            FROM camera_forecasts
            WHERE forecast_for_time >= NOW() - INTERVAL ':days days'
        """)

        try:
            with self.engine.connect() as conn:
                result = conn.execute(query, {"days": period_days}).fetchone()
                metrics = dict(result._mapping)

                # Calculate verification rate
                if metrics["total_predictions"] > 0:
                    metrics["verification_rate"] = round(
                        metrics["verified_predictions"] /
                        metrics["total_predictions"] * 100, 1
                    )
                else:
                    metrics["verification_rate"] = 0.0

                logger.info(
                    f"Overall metrics: MAE={metrics['mae']}, MAPE={metrics['mape']}%, "
                    f"Accuracy≤5xe={metrics['accuracy_5xe']}%"
                )
                return metrics

        except Exception as e:
            logger.error(f"Error calculating overall metrics: {e}")
            return {}

    @monitor_performance
    def analyze_by_horizon(self, period_days: int = 7) -> List[Dict]:
        """
        Phân tích performance theo từng horizon (5m, 10m, 15m, 30m, 60m)
        Args:
            period_days: Số ngày lịch sử để phân tích
        Returns:
            List[Dict] metrics cho mỗi horizon
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
                ROUND(COUNT(*) FILTER (WHERE error_value <= 10)::numeric / COUNT(*) * 100, 1) as accuracy_10xe
            FROM camera_forecasts
            WHERE error_value IS NOT NULL
              AND forecast_for_time >= NOW() - INTERVAL ':days days'
            GROUP BY horizon_minutes
            ORDER BY horizon_minutes
        """)

        try:
            with self.engine.connect() as conn:
                results = conn.execute(query, {"days": period_days}).fetchall()
                horizons = [dict(row._mapping) for row in results]

                # Add recommendations
                for h in horizons:
                    if h["avg_error"] < 4:
                        h["recommendation"] = "KEEP"
                        h["status"] = "good"
                    elif h["avg_error"] < 6:
                        h["recommendation"] = "OPTIONAL"
                        h["status"] = "fair"
                    else:
                        h["recommendation"] = "DROP"
                        h["status"] = "poor"

                logger.info(f"Analyzed {len(horizons)} horizons")
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
              AND c.forecast_for_time >= NOW() - INTERVAL ':days days'
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
                MAX(created_at) FILTER (WHERE error_value IS NOT NULL) as last_updated
            FROM camera_forecasts
            WHERE forecast_for_time >= NOW() - INTERVAL ':days days'
        """)

        try:
            with self.engine.connect() as conn:
                result = conn.execute(query, {"days": period_days}).fetchone()
                coverage = dict(result._mapping)

                # Calculate minutes since last update
                if coverage["last_updated"]:
                    from datetime import datetime, timezone

                    now = datetime.now(timezone.utc)
                    last_update = coverage["last_updated"]
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
            return {}

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
                  AND forecast_for_time >= NOW() - INTERVAL ':days days'
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
                trend_metrics = dict(result._mapping)

                logger.info(
                    f"Trend accuracy: {trend_metrics['trend_accuracy']}% "
                    f"({trend_metrics['correct_predictions']}/{trend_metrics['total_checks']})"
                )

                return trend_metrics

        except Exception as e:
            logger.error(f"Error calculating trend accuracy: {e}")
            return {}

    @monitor_performance
    def get_full_report(self, period_days: int = 7) -> Dict:
        """
        Tổng hợp toàn bộ metrics vào 1 report
        Args:
            period_days: Số ngày lịch sử để phân tích
        Returns:
            Dict chứa toàn bộ metrics
        """
        logger.info(
            f"Generating full performance report for last {period_days} days...")

        report = {
            "period_days": period_days,
            "generated_at": datetime.now().isoformat(),
            "overall": self.calculate_overall_metrics(period_days),
            "by_horizon": self.analyze_by_horizon(period_days),
            "camera_ranking": self.rank_cameras(period_days, top_n=5),
            "data_coverage": self.calculate_data_coverage(period_days),
            "trend_accuracy": self.calculate_trend_accuracy(period_days),
        }

        logger.info("✅ Full report generated successfully")
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
