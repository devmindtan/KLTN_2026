"""
Script download Random Forest models từ MinIO về local
Dùng trong Dockerfile hoặc khi cần pull latest models
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


def download_random_forest_models(output_dir="models"):
    """
    Download tất cả Random Forest models từ MinIO (5m, 10m, 15m, 30m, 60m + encoder)
    Args:
        output_dir: Thư mục lưu models (default: models/)
    Returns:
        True nếu download thành công tất cả models
    """
    client = MinIOModelClient()
    
    # Danh sách models cần tải
    horizons = ['5m', '10m', '15m', '30m', '60m']
    model_files = [f'camera_rf_model_{h}.joblib' for h in horizons]
    model_files.append('camera_label_encoder.joblib')
    
    logger.info(f"📥 Downloading Random Forest models from MinIO...")
    logger.info(f"   Total files: {len(model_files)}")
    
    # List tất cả files trong random-forest/v1/
    try:
        response = client.client.list_objects_v2(
            Bucket=client.bucket_name,
            Prefix="random-forest/v1/"
        )
        
        if 'Contents' not in response or len(response['Contents']) == 0:
            logger.error("❌ No Random Forest models found in random-forest/v1/")
            logger.error("   Hãy upload models bằng upload_model.py hoặc train.py trước!")
            return False
        
        # Group files theo suffix để lấy latest của mỗi loại
        # File pattern: random-forest_{YYYYMMDD}_{horizon}.joblib
        # hoặc random-forest_{YYYYMMDD}_encoder.joblib
        files_by_type = {}
        for obj in response['Contents']:
            key = obj['Key']
            filename = os.path.basename(key)
            
            # Xác định loại file (5m, 10m, encoder, etc)
            if filename.endswith('_encoder.joblib'):
                file_type = 'encoder'
            elif '_5m.joblib' in filename:
                file_type = '5m'
            elif '_10m.joblib' in filename:
                file_type = '10m'
            elif '_15m.joblib' in filename:
                file_type = '15m'
            elif '_30m.joblib' in filename:
                file_type = '30m'
            elif '_60m.joblib' in filename:
                file_type = '60m'
            else:
                continue
            
            # Lưu file với LastModified để lấy latest sau
            if file_type not in files_by_type:
                files_by_type[file_type] = []
            files_by_type[file_type].append({
                'key': key,
                'modified': obj['LastModified']
            })
        
        # Lấy file mới nhất của mỗi loại
        latest_files = {}
        for file_type, files in files_by_type.items():
            latest = sorted(files, key=lambda x: x['modified'], reverse=True)[0]
            latest_files[file_type] = latest['key']
        
        # Kiểm tra đủ files chưa
        required_types = ['5m', '10m', '15m', '30m', '60m', 'encoder']
        missing = set(required_types) - set(latest_files.keys())
        if missing:
            logger.error(f"❌ Missing model types: {missing}")
            logger.error("   Available types: " + ", ".join(latest_files.keys()))
            return False
        
        logger.info(f"   Found all required models (latest versions)")
        
    except Exception as e:
        logger.error(f"❌ Failed to list models: {e}")
        return False
    
    # Download all models
    download_map = {
        '5m': os.path.join(output_dir, 'camera_rf_model_5m.joblib'),
        '10m': os.path.join(output_dir, 'camera_rf_model_10m.joblib'),
        '15m': os.path.join(output_dir, 'camera_rf_model_15m.joblib'),
        '30m': os.path.join(output_dir, 'camera_rf_model_30m.joblib'),
        '60m': os.path.join(output_dir, 'camera_rf_model_60m.joblib'),
        'encoder': os.path.join(output_dir, 'camera_label_encoder.joblib'),
    }
    
    success_count = 0
    total_size = 0
    
    for file_type, local_path in download_map.items():
        minio_key = latest_files[file_type]
        logger.info(f"   📥 {file_type:8s}: {os.path.basename(minio_key)}")
        
        success = client.download_model(minio_key, local_path)
        if success:
            file_size = os.path.getsize(local_path)
            total_size += file_size
            success_count += 1
            logger.info(f"      ✅ {file_size / 1024:.1f} KB")
        else:
            logger.error(f"      ❌ Download failed!")
            return False
    
    logger.info(f"✅ All models downloaded! ({success_count}/{len(download_map)} files, {total_size / (1024*1024):.2f} MB)")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Download Random Forest models from MinIO")
    parser.add_argument(
        "--output-dir",
        default="models",
        help="Output directory for model files (default: models/)"
    )
    
    args = parser.parse_args()
    
    logger.info("="*60)
    logger.info("📥 Random Forest Models Download Script")
    logger.info("="*60)
    
    success = download_random_forest_models(output_dir=args.output_dir)
    
    if not success:
        sys.exit(1)
