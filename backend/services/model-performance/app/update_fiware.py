"""
Service gửi performance metrics lên FIWARE Orion Context Broker
Frontend sẽ nhận metrics qua WebSocket để hiển thị dashboard
"""

from shared.monitor_performance import monitor_performance
from app.analyze_metrics import ModelPerformanceAnalyzer, engine
import asyncio
import json
import logging
import math
import os
import sys
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict

import aiohttp
from dotenv import load_dotenv
from sqlalchemy import text

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
    Tạo bảng lưu lịch sử metrics nếu chưa tồn tại
    """
    create_table_query = text("""
        CREATE TABLE IF NOT EXISTS model_metrics_history (
            id BIGSERIAL PRIMARY KEY,
            generated_at TIMESTAMPTZ NOT NULL,
            period_days INTEGER NOT NULL,
            overall JSONB NOT NULL,
            by_horizon JSONB NOT NULL,
            camera_ranking JSONB NOT NULL,
            data_coverage JSONB NOT NULL,
            trend_accuracy JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    create_index_query = text("""
        CREATE INDEX IF NOT EXISTS idx_model_metrics_history_generated_at
        ON model_metrics_history (generated_at DESC)
    """)

    with engine.begin() as conn:
        conn.execute(create_table_query)
        conn.execute(create_index_query)


@monitor_performance
def save_metrics_history(metrics: Dict) -> bool:
    """
    Lưu snapshot metrics vào PostgreSQL để phục vụ màn hình lịch sử
    """
    try:
        metrics_clean = convert_decimal_to_float(metrics)
        generated_at = metrics_clean.get(
            "generated_at", datetime.now().isoformat())

        ensure_metrics_history_table()

        insert_query = text("""
            INSERT INTO model_metrics_history (
                generated_at,
                period_days,
                overall,
                by_horizon,
                camera_ranking,
                data_coverage,
                trend_accuracy
            )
            VALUES (
                :generated_at,
                :period_days,
                CAST(:overall AS JSONB),
                CAST(:by_horizon AS JSONB),
                CAST(:camera_ranking AS JSONB),
                CAST(:data_coverage AS JSONB),
                CAST(:trend_accuracy AS JSONB)
            )
        """)

        with engine.begin() as conn:
            conn.execute(
                insert_query,
                {
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
                },
            )

        logger.info("✅ Metrics history saved to PostgreSQL")
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
        return obj.isoformat()
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
    Gửi performance metrics lên FIWARE Orion
    Entity ID: urn:ngsi-ld:ModelMetrics:performance

    Args:
        metrics: Dict chứa toàn bộ metrics từ ModelPerformanceAnalyzer
    """
    entity_id = "urn:ngsi-ld:ModelMetrics:performance"

    # Convert all Decimal objects to float for JSON serialization
    metrics_clean = convert_decimal_to_float(metrics)

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
            "value": metrics_clean.get("data_coverage", {}),
        },
        "trend_accuracy": {
            "type": "StructuredValue",
            "value": metrics_clean.get("trend_accuracy", {}),
        },
        "period_days": {"type": "Number", "value": metrics_clean.get("period_days", 7)},
        "last_updated": {
            "type": "DateTime",
            "value": metrics_clean.get("generated_at", datetime.now().isoformat()),
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
async def run_metrics_update_cycle(interval_minutes: int = 60):
    """
    Chạy định kỳ: Tính metrics → Gửi lên FIWARE

    Args:
        interval_minutes: Khoảng thời gian giữa các lần update (default: 60 phút)
    """
    analyzer = ModelPerformanceAnalyzer(engine)
    logger.info(
        f"Starting metrics update cycle (every {interval_minutes} minutes)")

    iteration = 0
    while True:
        iteration += 1
        logger.info(f"\n{'='*60}")
        logger.info(f"METRICS UPDATE CYCLE #{iteration}")
        logger.info(f"{'='*60}")

        try:
            # Calculate full report
            report = analyzer.get_full_report(period_days=7)

            # Save history to PostgreSQL
            save_metrics_history(report)

            # Send to FIWARE
            success = await update_metrics_to_fiware(report)

            if success:
                logger.info(f"✅ Cycle #{iteration} completed successfully")
                # Print summary
                overall = report.get("overall", {})
                logger.info(
                    f"   MAE: {overall.get('mae', 'N/A')}, "
                    f"MAPE: {overall.get('mape', 'N/A')}%, "
                    f"Accuracy≤5xe: {overall.get('accuracy_5xe', 'N/A')}%"
                )
            else:
                logger.warning(f"⚠️ Cycle #{iteration} completed with errors")

        except Exception as e:
            logger.error(f"❌ Error in cycle #{iteration}: {e}")

        # Sleep until next cycle
        sleep_seconds = interval_minutes * 60
        logger.info(
            f"💤 Sleeping for {interval_minutes} minutes until next cycle...")
        await asyncio.sleep(sleep_seconds)


async def run_single_update():
    """
    Chạy 1 lần update (dùng cho manual trigger hoặc test)
    """
    logger.info("Running single metrics update...")
    analyzer = ModelPerformanceAnalyzer(engine)

    try:
        report = analyzer.get_full_report(period_days=7)

        # Save history to PostgreSQL
        save_metrics_history(report)

        success = await update_metrics_to_fiware(report)

        if success:
            logger.info("✅ Single update completed successfully")
            return report
        else:
            logger.error("❌ Single update failed")
            return None

    except Exception as e:
        logger.error(f"❌ Error in single update: {e}")
        return None


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--once":
        # Run once and exit
        logger.info("Running in single-shot mode (--once)")
        result = asyncio.run(run_single_update())
        if result:
            print("\n" + "=" * 60)
            print("METRICS SUMMARY")
            print("=" * 60)
            overall = result.get("overall", {})
            print(f"MAE:           {overall.get('mae', 'N/A')} xe")
            print(f"MAPE:          {overall.get('mape', 'N/A')}%")
            print(f"Accuracy ≤5xe: {overall.get('accuracy_5xe', 'N/A')}%")
            print(f"Accuracy ≤10xe: {overall.get('accuracy_10xe', 'N/A')}%")
            print(f"Verified:      {overall.get('verification_rate', 'N/A')}%")
            sys.exit(0)
        else:
            sys.exit(1)
    else:
        # Run continuous loop
        logger.info("Running in continuous mode (Ctrl+C to stop)")
        logger.info("Tip: Use --once flag for single execution")
        try:
            asyncio.run(run_metrics_update_cycle(interval_minutes=60))
        except KeyboardInterrupt:
            logger.info("\n⚠️ Stopped by user (Ctrl+C)")
            sys.exit(0)
