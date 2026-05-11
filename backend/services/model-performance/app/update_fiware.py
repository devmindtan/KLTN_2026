"""
Service gửi performance metrics lên FIWARE Orion Context Broker
Frontend sẽ nhận metrics qua WebSocket để hiển thị dashboard
"""

from shared.monitor_performance import monitor_performance
from analyze_metrics import ModelPerformanceAnalyzer, engine
import asyncio
import json
import logging
import math
import os
import sys
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict

import aiohttp
from dotenv import load_dotenv
from sqlalchemy import text

sys.path.append(os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")))


sys.path.append(os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")))


sys.path.append(os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")))

load_dotenv()

FIWARE_ORION_BASE = os.getenv("FIWARE_ORION_BASE")
FIWARE_ORION_URL = f"http://{FIWARE_ORION_BASE}/v2/entities"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def ensure_metrics_history_table() -> None:
    """
    Tạo bảng lưu lịch sử metrics nếu chưa tồn tại (với confidence_distribution)
    Unique constraint trên snapshot_date để đảm bảo 1 snapshot / ngày
    """
    create_table_query = text("""
        CREATE TABLE IF NOT EXISTS model_metrics_history (
            id BIGSERIAL PRIMARY KEY,
            snapshot_date DATE NOT NULL,
            generated_at TIMESTAMPTZ NOT NULL,
            period_days INTEGER NOT NULL,
            overall JSONB NOT NULL,
            by_horizon JSONB NOT NULL,
            camera_ranking JSONB NOT NULL,
            data_coverage JSONB NOT NULL,
            trend_accuracy JSONB NOT NULL,
            confidence_distribution JSONB DEFAULT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    create_index_query = text("""
        CREATE INDEX IF NOT EXISTS idx_model_metrics_history_generated_at
        ON model_metrics_history (generated_at DESC)
    """)

    # Unique constraint: chỉ 1 snapshot mỗi ngày
    create_unique_query = text("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_model_metrics_history_snapshot_date
        ON model_metrics_history (snapshot_date)
    """)

    # Thêm cột snapshot_date nếu bảng đã tồn tại nhưng chưa có cột này
    add_column_query = text("""
        ALTER TABLE model_metrics_history
        ADD COLUMN IF NOT EXISTS snapshot_date DATE
    """)

    with engine.begin() as conn:
        conn.execute(create_table_query)
        conn.execute(add_column_query)
        conn.execute(create_index_query)
        conn.execute(create_unique_query)


@monitor_performance
def save_metrics_history(metrics: Dict) -> bool:
    """
    Lưu snapshot metrics vào PostgreSQL để phục vụ màn hình lịch sử (bao gồm confidence_distribution)
    """
    try:
        # Validate metrics không rỗng
        if not metrics or not isinstance(metrics, dict):
            logger.warning("⚠️ Metrics is empty or invalid. Skipping save to history.")
            return False
        
        # Check if có overall metrics (chỉ số quan trọng nhất)
        overall = metrics.get("overall", {})
        if not overall or overall.get("total_predictions", 0) == 0:
            logger.warning("⚠️ No overall metrics or zero predictions. Skipping save to history.")
            return False
        
        metrics_clean = convert_decimal_to_float(metrics)
        generated_at_value = metrics_clean.get(
            "generated_at", datetime.utcnow().timestamp())
        
        # Convert timestamp to datetime object for PostgreSQL TIMESTAMPTZ column
        # Handle both timestamp (float) and ISO string formats
        if isinstance(generated_at_value, (int, float)):
            generated_at = datetime.fromtimestamp(generated_at_value, tz=timezone.utc)
        else:
            # Already ISO string, parse it
            from dateutil import parser
            generated_at = parser.isoparse(generated_at_value)

        ensure_metrics_history_table()

        insert_query = text("""
            INSERT INTO model_metrics_history (
                snapshot_date,
                generated_at,
                period_days,
                overall,
                by_horizon,
                camera_ranking,
                data_coverage,
                trend_accuracy,
                confidence_distribution
            )
            VALUES (
                :snapshot_date,
                :generated_at,
                :period_days,
                CAST(:overall AS JSONB),
                CAST(:by_horizon AS JSONB),
                CAST(:camera_ranking AS JSONB),
                CAST(:data_coverage AS JSONB),
                CAST(:trend_accuracy AS JSONB),
                CAST(:confidence_distribution AS JSONB)
            )
            ON CONFLICT (snapshot_date) DO UPDATE SET
                generated_at           = EXCLUDED.generated_at,
                period_days            = EXCLUDED.period_days,
                overall                = EXCLUDED.overall,
                by_horizon             = EXCLUDED.by_horizon,
                camera_ranking         = EXCLUDED.camera_ranking,
                data_coverage          = EXCLUDED.data_coverage,
                trend_accuracy         = EXCLUDED.trend_accuracy,
                confidence_distribution = EXCLUDED.confidence_distribution
        """)

        with engine.begin() as conn:
            conn.execute(
                insert_query,
                {
                    "snapshot_date": generated_at.date(),
                    "generated_at": generated_at,
                    "period_days": metrics_clean.get("period_days", 7),
                    "overall": json.dumps(metrics_clean.get("overall", {})),
                    "by_horizon": json.dumps(metrics_clean.get("by_horizon", [])),
                    "camera_ranking": json.dumps(
                        metrics_clean.get("camera_ranking", {
                                          "best": [], "worst": []})
                    ),
                    "data_coverage": json.dumps(metrics_clean.get("data_coverage", {})),
                    "trend_accuracy": json.dumps(metrics_clean.get("trend_accuracy", {})),
                    "confidence_distribution": json.dumps(metrics_clean.get("confidence_distribution", {})),
                },
            )

        logger.info(
            f"✅ Metrics history upserted for {generated_at.date()} (1 snapshot/day)")
        return True
    except Exception as e:
        logger.error(f"❌ Error saving metrics history: {e}")
        return False


def convert_decimal_to_float(obj: Any) -> Any:
    """
    Recursively convert Decimal and datetime objects for JSON serialization
    Handle None, NaN, Infinity for FIWARE compatibility
    Args:
        obj: Any object (dict, list, Decimal, datetime, etc.)
    Returns:
        Object with all Decimals → float, datetime → ISO string
    """
    if obj is None:
        return None
    elif isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, float):
        # Handle NaN and Infinity
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, datetime):
        return obj.timestamp()
    elif isinstance(obj, dict):
        return {key: convert_decimal_to_float(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimal_to_float(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(convert_decimal_to_float(item) for item in obj)
    else:
        return obj


@monitor_performance
async def update_metrics_to_fiware(metrics: Dict):
    """
    Gửi performance metrics lên FIWARE Orion (bao gồm confidence scores)
    Entity ID: urn:ngsi-ld:ModelMetrics:performance

    Args:
        metrics: Dict chứa toàn bộ metrics từ ModelPerformanceAnalyzer
    """
    # Validate metrics
    if not metrics or not isinstance(metrics, dict):
        logger.error("❌ Metrics is empty or invalid. Cannot send to FIWARE.")
        return False
    
    overall = metrics.get("overall", {})
    if not overall or overall.get("total_predictions", 0) == 0:
        logger.warning("⚠️ No valid metrics data. Sending default values to FIWARE.")
        # Send default metrics để FIWARE không bị outdated
        metrics = {
            "period_days": 7,
            "generated_at": datetime.utcnow().isoformat(),
            "overall": {
                "total_predictions": 0,
                "verified_predictions": 0,
                "mae": 0.0,
                "mape": 0.0,
                "accuracy_5xe": 0.0,
                "verification_rate": 0.0,
                "prediction_confidence": {"score": 0.0, "level": "Low", "avg_input_samples": 0, "avg_lag_samples": 0, "low_sample_count": 0},
                "error_confidence": {"score": 0.0, "level": "Low", "avg_sync_samples": 0, "mismatched_count": 0}
            },
            "by_horizon": [],
            "camera_ranking": {"best": [], "worst": []},
            "data_coverage": {"total_predictions": 0, "verified": 0, "pending": 0, "verification_rate": 0.0},
            "trend_accuracy": {"trend_accuracy": 0.0, "total_checks": 0},
            "confidence_distribution": {"total_records": 0, "verified_records": 0}
        }
    
    entity_id = "urn:ngsi-ld:ModelMetrics:performance"

    # Convert all Decimal objects to float for JSON serialization
    metrics_clean = convert_decimal_to_float(metrics)
    
    # Clean data_coverage: remove datetime field to avoid FIWARE reserved field conflict
    # FIWARE has reserved field "last_updated" - any datetime-like field can cause validation error
    data_coverage_clean = dict(metrics_clean.get("data_coverage", {}))
    data_coverage_clean.pop("last_verification_time", None)  # Remove datetime field
    # Keep only: total_predictions, verified, pending, verification_rate, minutes_since_update

    payload = {
        "id": entity_id,
        "type": "ModelMetrics",
        "overall": {"type": "StructuredValue", "value": metrics_clean.get("overall", {})},
        "by_horizon": {
            "type": "StructuredValue",
            "value": metrics_clean.get("by_horizon", []),
        },
        "camera_ranking": {
            "type": "StructuredValue",
            "value": metrics_clean.get("camera_ranking", {"best": [], "worst": []}),
        },
        "data_coverage": {
            "type": "StructuredValue",
            "value": data_coverage_clean,  # Use cleaned version without datetime field
        },
        "trend_accuracy": {
            "type": "StructuredValue",
            "value": metrics_clean.get("trend_accuracy", {}),
        },
        "confidence_distribution": {
            "type": "StructuredValue",
            "value": metrics_clean.get("confidence_distribution", {}),
        },
        "period_days": {"type": "Number", "value": metrics_clean.get("period_days", 7)},
        "last_updated": {
            "type": "DateTime",
            "value": metrics_clean.get("generated_at", datetime.utcnow().isoformat()),
        },
    }

    headers = {
        "Content-Type": "application/json",
        "fiware-service": "traffic_monitor",
        "fiware-servicepath": "/",
    }

    try:
        async with aiohttp.ClientSession() as session:
            url = f"{FIWARE_ORION_URL}?options=upsert"
            async with session.post(url, json=payload, headers=headers, timeout=10) as resp:
                if resp.status in [201, 204]:
                    logger.info("✅ Metrics updated to FIWARE successfully")
                    return True
                else:
                    error_text = await resp.text()
                    logger.error(
                        f"❌ FIWARE Error: {resp.status} - {error_text}")
                    # Print full payload khi lỗi
                    logger.info("📋 Full payload causing error:")
                    logger.info(json.dumps(
                        payload, indent=2, ensure_ascii=False))
                    return False

    except asyncio.TimeoutError:
        logger.error("❌ Timeout connecting to FIWARE Orion")
        return False
    except Exception as e:
        logger.error(f"❌ Error updating metrics to FIWARE: {e}")
        return False


@monitor_performance
async def run_single_update():
    """
    Chạy 1 lần: Tính metrics → Lưu vào PostgreSQL (1 snapshot/ngày).
    Được gọi bởi CronJob qua `python main.py --once`.
    """
    logger.info("📊 Tính metrics và lưu vào PostgreSQL...")
    analyzer = ModelPerformanceAnalyzer(engine)

    try:
        report = analyzer.get_full_report(period_days=7)

        save_success = save_metrics_history(report)

        if save_success:
            logger.info("✅ Single update completed successfully (saved to PostgreSQL)")
            return report
        else:
            logger.error("❌ Failed to save metrics to PostgreSQL")
            return None

    except Exception as e:
        logger.error(f"❌ Error in single update: {e}")
        return None
