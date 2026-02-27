"""
Script upload YOLO best.pt model hiện tại lên MinIO + save metadata
Chỉ chạy 1 lần để khởi tạo model storage
"""
from shared.model_metadata_db import ModelMetadataDB
from shared.minio_client import MinIOModelClient
import os
import sys
import logging
from datetime import datetime, timezone
from psycopg2.pool import ThreadedConnectionPool

# Add shared to Python path
sys.path.append(os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")))


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def upload_current_yolo_model():
    """Upload best.pt hiện tại lên MinIO với metadata"""

    # Đường dẫn model local (relative từ image-process root directory)
    local_model_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "models", "best.pt"
    )

    if not os.path.exists(local_model_path):
        logger.error(f"❌ Model not found: {local_model_path}")
        logger.error(f"   Script chạy từ: {os.getcwd()}")
        return False

    # MinIO key theo pattern mới: ml-models/yolo/v1/yolo_YYYYMMDD_best.pt
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    minio_key = f"yolo/v1/yolo_{date_str}_best.pt"

    # Metadata của model hiện tại (theo thông tin user cung cấp)
    metadata = {
        "model_type": "yolo",
        "model_version": "v1_initial",
        "base_model": "yolov11m",
        "training_samples": None,  # Không biết chính xác
        "training_duration_hours": 24.0,  # ~1 ngày
        "metrics": {
            "note": "Retrain tu yolov11m, metrics chua do chinh xac"
        },
        "is_active": True,
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }

    # 1. Upload lên MinIO
    logger.info("📤 Uploading model to MinIO...")
    # Hardcode bucket name "ml-models" cho model storage
    # (không dùng MINIO_BUCKET_NAME env var vì đó dành cho camera images)
    client = MinIOModelClient(bucket_name="ml-models")

    success = client.upload_model(
        local_path=local_model_path,
        minio_key=minio_key,
        metadata=metadata
    )

    if not success:
        logger.error("❌ Upload failed!")
        return False

    # 2. Lưu metadata vào PostgreSQL
    logger.info("💾 Saving metadata to PostgreSQL...")

    # Kết nối DB (lấy credentials từ env)
    db_pool = ThreadedConnectionPool(
        minconn=1,
        maxconn=5,
        host=os.getenv("POSTGRES_HOST"),
        database=os.getenv("POSTGRES_DBS"),
        user=os.getenv("POSTGRES_USERNAME"),
        password=os.getenv("POSTGRES_PASSWORD"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
    )

    metadata_db = ModelMetadataDB(db_pool)

    record_id = metadata_db.save_model_metadata(
        model_type="yolo",
        model_version="v1_initial",
        minio_key=minio_key,
        base_model="yolov11m",
        training_samples=None,
        training_duration_hours=24.0,
        metrics={"note": "Retrain tu yolov11m, metrics chua do chinh xac"},
        is_active=True
    )

    db_pool.closeall()

    if record_id:
        logger.info(f"✅ Upload complete! Model ID: {record_id}")
        logger.info(f"   MinIO: {minio_key}")
        logger.info(f"   Version: v1_initial")
        return True
    else:
        logger.error("❌ Failed to save metadata to DB")
        return False


if __name__ == "__main__":
    logger.info("="*60)
    logger.info("🚀 YOLO Model Upload Script")
    logger.info("="*60)

    success = upload_current_yolo_model()

    if success:
        logger.info("\n✅ Done! Model đã được upload lên MinIO storage")
        logger.info("   Tiếp theo: Modify Dockerfile để download từ MinIO")
    else:
        logger.error("\n❌ Upload failed!")
        sys.exit(1)
