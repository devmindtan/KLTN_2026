"""
Script download model từ MinIO về local
Dùng trong Dockerfile hoặc khi cần pull latest model
"""
from shared.minio_client import MinIOModelClient
import os
import sys
import logging
import argparse
# Add shared to Python path
sys.path.append(os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")))


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def download_yolo_model(output_dir="models"):
    """
    Download YOLO latest model từ MinIO (lấy file mới nhất trong v1/ folder)
    Args:
        output_dir: Thư mục lưu model (default: models/)
    Returns:
        True nếu download thành công
    """
    local_path = os.path.join(output_dir, "best.pt")

    logger.info(f"📥 Downloading latest YOLO model from MinIO...")

    # Hardcode bucket name "ml-models" cho model storage
    # (không dùng MINIO_BUCKET_NAME env var vì đó dành cho camera images)
    client = MinIOModelClient(bucket_name="ml-models")

    # List tất cả files trong yolo/v1/
    try:
        response = client.client.list_objects_v2(
            Bucket=client.bucket_name,
            Prefix="yolo/v1/"
        )

        if 'Contents' not in response or len(response['Contents']) == 0:
            logger.error("❌ No YOLO models found in yolo/v1/")
            logger.error("   Hãy chạy upload_model.py trước!")
            return False

        # Lấy file mới nhất (sort by LastModified)
        latest_file = sorted(
            response['Contents'], key=lambda x: x['LastModified'], reverse=True)[0]
        minio_key = latest_file['Key']

        logger.info(f"   Latest model: {minio_key}")
        logger.info(f"   Target: {local_path}")

    except Exception as e:
        logger.error(f"❌ Failed to list models: {e}")
        return False

    # Download
    success = client.download_model(minio_key, local_path)

    if success:
        file_size_mb = os.path.getsize(local_path) / (1024 * 1024)
        logger.info(f"✅ Download complete! ({file_size_mb:.2f} MB)")
        return True
    else:
        logger.error("❌ Download failed!")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Download YOLO model from MinIO")
    parser.add_argument(
        "--output-dir",
        default="models",
        help="Output directory for model file (default: models/)"
    )

    args = parser.parse_args()

    logger.info("="*60)
    logger.info("📥 YOLO Model Download Script")
    logger.info("="*60)

    success = download_yolo_model(output_dir=args.output_dir)

    if not success:
        sys.exit(1)
