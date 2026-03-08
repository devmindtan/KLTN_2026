"""
MinIO Client Utility cho ML Models
Cung cấp functions upload/download models từ MinIO storage
"""
import os
import logging
from datetime import datetime
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class MinIOModelClient:
    """Client để quản lý ML models trên MinIO"""

    def __init__(self, endpoint_url=None, access_key=None, secret_key=None, bucket_name=None):
        """
        Khởi tạo MinIO client
        Args:
            endpoint_url: MinIO endpoint (default từ env MINIO_ENDPOINT_URL)
            access_key: Access key (default từ env MINIO_ACCESS_KEY)
            secret_key: Secret key (default từ env MINIO_SECRET_KEY)
            bucket_name: Bucket name (default từ env MINIO_BUCKET_NAME)
        """
        self.endpoint_url = endpoint_url or os.getenv("MINIO_ENDPOINT_URL")
        self.access_key = access_key or os.getenv("MINIO_ACCESS_KEY")
        self.secret_key = secret_key or os.getenv("MINIO_SECRET_KEY")
        self.bucket_name = bucket_name or os.getenv(
            "MINIO_BUCKET_NAME", "ml-models")

        self.client = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
        )

        logger.info(
            f"✅ MinIO Client initialized: {self.endpoint_url} -> {self.bucket_name}")

    def upload_model(self, local_path: str, minio_key: str, metadata: dict = None) -> bool:
        """
        Upload model file lên MinIO
        Args:
            local_path: Đường dẫn file local (vd: models/best.pt)
            minio_key: Key trên MinIO (vd: ml-models/yolo/v1/yolo_20260227_best.pt)
            metadata: Dict metadata (optional, lưu vào S3 object metadata)
        Returns:
            True nếu upload thành công
        """
        try:
            extra_args = {}
            if metadata:
                # Convert metadata dict to string format cho S3 metadata
                extra_args["Metadata"] = {
                    k: str(v) for k, v in metadata.items()
                }

            self.client.upload_file(
                Filename=local_path,
                Bucket=self.bucket_name,
                Key=minio_key,
                ExtraArgs=extra_args if extra_args else None
            )

            file_size_mb = os.path.getsize(local_path) / (1024 * 1024)
            logger.info(
                f"✅ Uploaded {local_path} → {minio_key} ({file_size_mb:.2f} MB)")
            return True

        except ClientError as e:
            logger.error(f"❌ Upload failed: {e}")
            return False

    def download_model(self, minio_key: str, local_path: str) -> bool:
        """
        Download model từ MinIO về local
        Args:
            minio_key: Key trên MinIO (vd: models/yolo/best.pt)
            local_path: Đường dẫn lưu file local (vd: models/best.pt)
        Returns:
            True nếu download thành công
        """
        try:
            # Tạo thư mục nếu chưa tồn tại
            os.makedirs(os.path.dirname(local_path), exist_ok=True)

            self.client.download_file(
                Bucket=self.bucket_name,
                Key=minio_key,
                Filename=local_path
            )

            file_size_mb = os.path.getsize(local_path) / (1024 * 1024)
            logger.info(
                f"✅ Downloaded {minio_key} → {local_path} ({file_size_mb:.2f} MB)")
            return True

        except ClientError as e:
            logger.error(f"❌ Download failed: {e}")
            return False

    def model_exists(self, minio_key: str) -> bool:
        """
        Kiểm tra model có tồn tại trên MinIO không
        Args:
            minio_key: Key trên MinIO
        Returns:
            True nếu file tồn tại
        """
        try:
            self.client.head_object(Bucket=self.bucket_name, Key=minio_key)
            return True
        except ClientError:
            return False

    def list_model_versions(self, model_type: str, version_folder: str = "v1") -> list:
        """
        List tất cả versions của một loại model trong folder
        Args:
            model_type: Loại model (yolo, random-forest)
            version_folder: Version folder (default: v1)
        Returns:
            List of dict [{Key, LastModified, Size}, ...] sorted by LastModified DESC
        """
        try:
            prefix = f"ml-models/{model_type}/{version_folder}/"
            response = self.client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )

            if 'Contents' not in response:
                return []

            # Sort by LastModified descending (newest first)
            versions = sorted(
                response['Contents'],
                key=lambda x: x['LastModified'],
                reverse=True
            )

            return versions

        except ClientError as e:
            logger.error(f"❌ List versions failed: {e}")
            return []
