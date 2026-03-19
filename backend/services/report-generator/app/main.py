"""
Main orchestrator for report generation
Entry point for creating Smart Reports (PDF + XLSX)
"""
import os
import logging
import sys
from datetime import datetime, date
from typing import Dict, Any, Optional
import json

# Database and storage
import pandas as pd
from sqlalchemy import create_engine, text
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

# Internal modules
from analytics_engine import analyze_traffic_data
from pdf_generator import create_executive_summary_pdf
from xlsx_exporter import create_structured_data_xlsx

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_report(report_id: str, report_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Orchestrate toàn bộ quy trình tạo báo cáo
    
    Args:
        report_id: UUID của báo cáo trong DB
        report_config: {type, period_from, period_to, title, settings}
        
    Returns:
        {success: bool, files: {pdf: {}, xlsx: {}}, summary: {}, error?: str}
    """
    try:
        logger.info(f"🚀 Starting report generation: {report_id}")
        
        # Step 1: Update status to "generating"
        _update_report_status(report_id, "generating")
        
        # Step 2: Data collection & validation
        settings   = report_config.get("settings", {}) or {}
        hour_from  = settings.get("hour_from")   # None = không lọc giờ
        hour_to    = settings.get("hour_to")      # None = không lọc giờ

        traffic_data, cameras_data = _collect_traffic_data(
            report_config["period_from"],
            report_config["period_to"],
            hour_from=hour_from,
            hour_to=hour_to,
        )
        
        if traffic_data.empty:
            raise ValueError("Không có dữ liệu giao thông trong khoảng thời gian đã chọn")
        
        # Step 3: Analytics processing
        logger.info("📊 Analyzing traffic data...")
        analyzed_summary = analyze_traffic_data(traffic_data, cameras_data)
        
        # Step 4: Generate files
        report_meta = {
            "title":       report_config["title"],
            "period_from": report_config["period_from"],
            "period_to":   report_config["period_to"],
            "hour_from":   hour_from,
            "hour_to":     hour_to,
            "generated_at": datetime.now().isoformat(),
            "timeseries_count": len(traffic_data)
        }
        
        logger.info("📄 Generating PDF...")
        pdf_bytes = create_executive_summary_pdf(analyzed_summary, report_meta)
        
        logger.info("📊 Generating XLSX...")
        xlsx_bytes = create_structured_data_xlsx(analyzed_summary, traffic_data, report_meta)
        
        # Step 5: Upload files to MinIO
        logger.info("☁️ Uploading to MinIO...")
        file_paths = _upload_files_to_minio(report_id, pdf_bytes, xlsx_bytes, report_config)
        
        # Step 6: Update database with results
        result = {
            "success": True,
            "files": file_paths,
            "summary": analyzed_summary,
            "generated_at": datetime.now().isoformat()
        }
        
        _update_report_status(report_id, "ready", result)
        
        logger.info(f"✅ Report generation completed: {report_id}")
        return result
        
    except Exception as e:
        error_msg = f"Report generation failed: {str(e)}"
        logger.error(f"❌ {error_msg}")
        
        _update_report_status(report_id, "failed", {"error": error_msg})
        
        return {
            "success": False,
            "error": error_msg
        }

def _collect_traffic_data(
    period_from: str,
    period_to: str,
    hour_from: Optional[int] = None,
    hour_to: Optional[int] = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Lấy dữ liệu giao thông từ DB trong khoảng ngày và giờ chỉ định.
    hour_from/hour_to: giờ bắt đầu/kết thúc (0-23). None = lấy tất cả giờ.
    """
    engine = _get_db_engine()

    # Xây dựng điều kiện lọc giờ nếu có
    hour_filter = ""
    params: Dict[str, Any] = {"from_date": period_from, "to_date": period_to}

    if hour_from is not None and hour_to is not None:
        if hour_to <= 24:  # hour_to=24 nghĩa là cuối ngày → < 24 hoặc không giới hạn trên
            hour_filter = "AND EXTRACT(HOUR FROM created_at) >= :hour_from AND EXTRACT(HOUR FROM created_at) < :hour_to"
        else:
            hour_filter = "AND EXTRACT(HOUR FROM created_at) >= :hour_from"
        params["hour_from"] = hour_from
        params["hour_to"]   = hour_to

    traffic_query = text(f"""
        SELECT
            camera_id,
            created_at,
            total_objects,
            detections
        FROM camera_detections
        WHERE created_at::date BETWEEN :from_date AND :to_date
        {hour_filter}
        ORDER BY created_at
    """)

    traffic_data = pd.read_sql(traffic_query, engine, params=params)
    
    # Query camera metadata — bảng đúng là camera_data (cam_id, display_name, location)
    cameras_query = text("""
        SELECT cam_id, display_name AS name, location
        FROM camera_data
    """)
    
    cameras_data = pd.read_sql(cameras_query, engine)
    
    logger.info(f"📈 Collected {len(traffic_data)} traffic records from {len(cameras_data)} cameras"
                + (f" (giờ {hour_from}:00–{hour_to}:00)" if hour_from is not None else " (tất cả giờ)"))
    
    return traffic_data, cameras_data

def _upload_files_to_minio(report_id: str, pdf_bytes: bytes, xlsx_bytes: bytes, config: Dict) -> Dict[str, Dict[str, Any]]:
    """Upload PDF and XLSX files to MinIO storage"""
    s3_client = _get_minio_client()
    bucket = os.getenv("MINIO_BUCKET", "reports")
    
    # Generate file names with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = f"{config['type']}_report_{timestamp}"
    
    pdf_key  = f"{datetime.now().year}/{datetime.now().month:02d}/{report_id}_{base_name}.pdf"
    xlsx_key = f"{datetime.now().year}/{datetime.now().month:02d}/{report_id}_{base_name}.xlsx"
    
    # Upload PDF
    s3_client.put_object(
        Bucket=bucket,
        Key=pdf_key,
        Body=pdf_bytes,
        ContentType="application/pdf"
    )
    
    # Upload XLSX
    s3_client.put_object(
        Bucket=bucket,
        Key=xlsx_key,
        Body=xlsx_bytes,
        ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    
    # Generate pre-signed URLs (24 hour expiry)
    pdf_url = s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': bucket, 'Key': pdf_key},
        ExpiresIn=86400
    )
    
    xlsx_url = s3_client.generate_presigned_url(
        'get_object', 
        Params={'Bucket': bucket, 'Key': xlsx_key},
        ExpiresIn=86400
    )
    
    return {
        "pdf": {
            "path": pdf_key,
            "sizeMB": round(len(pdf_bytes) / 1024 / 1024, 2),
            "url": pdf_url
        },
        "xlsx": {
            "path": xlsx_key,
            "sizeMB": round(len(xlsx_bytes) / 1024 / 1024, 2),
            "url": xlsx_url
        }
    }

def _update_report_status(report_id: str, status: str, result_data: Optional[Dict] = None) -> None:
    """Cập nhật trạng thái báo cáo trong database. Non-fatal: log warning nếu DB lỗi (vd: test local)."""
    if os.getenv("SKIP_DB_UPDATE", "false").lower() == "true":
        logger.warning(f"⏭️  [SKIP_DB] status={status} report_id={report_id}")
        return
    try:
        engine = _get_db_engine()
    except Exception as e:
        logger.warning(f"⚠️  Bỏ qua DB update (không kết nối được): {e}")
        return

    files_str   = json.dumps(result_data.get("files"))   if result_data and "files"   in result_data else None
    summary_str = json.dumps(result_data.get("summary")) if result_data and "summary" in result_data else None
    error_msg   = result_data.get("error") if result_data else None

    # Dùng CAST(...AS jsonb) thay vì ::jsonb để tránh conflict với SQLAlchemy :param binding
    update_query = text("""
        UPDATE reports
        SET status        = :status,
            generated_at  = CASE WHEN :status = 'ready' THEN NOW() ELSE generated_at END,
            files_json    = CASE WHEN :files   IS NOT NULL THEN CAST(:files   AS jsonb) ELSE files_json   END,
            summary_json  = CASE WHEN :summary IS NOT NULL THEN CAST(:summary AS jsonb) ELSE summary_json END,
            error_message = :error_msg
        WHERE id = :report_id
    """)

    params = {
        "report_id": report_id,
        "status":    status,
        "files":     files_str,
        "summary":   summary_str,
        "error_msg": error_msg,
    }

    try:
        with engine.connect() as conn:
            conn.execute(update_query, params)
            conn.commit()
        logger.info(f"📝 Updated report {report_id} status to: {status}")
    except Exception as e:
        logger.warning(f"⚠️  Bỏ qua DB update (lỗi: {e.__class__.__name__}: {e})")

def _get_db_engine():
    """Tạo SQLAlchemy engine từ các POSTGRES_* env vars (chuẩn chung toàn project)"""
    host = os.getenv("POSTGRES_HOST")
    db   = os.getenv("POSTGRES_DBS")
    user = os.getenv("POSTGRES_USERNAME")
    pwd  = os.getenv("POSTGRES_PASSWORD")
    port = os.getenv("POSTGRES_PORT", "5432")

    if not all([host, db, user, pwd]):
        raise ValueError("Thiếu env vars POSTGRES_HOST / POSTGRES_DBS / POSTGRES_USERNAME / POSTGRES_PASSWORD")

    db_url = f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{db}"
    return create_engine(db_url, pool_pre_ping=True)

def _get_minio_client():
    """Tạo boto3 S3 client kết nối MinIO (dùng MINIO_ENDPOINT_URL chuẩn chung)"""
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("MINIO_ENDPOINT_URL"),
        aws_access_key_id=os.getenv("MINIO_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("MINIO_SECRET_KEY"),
        region_name="us-east-1",
        config=boto3.session.Config(signature_version="s3v4"),
    )

if __name__ == "__main__":
    """
    CLI: python main.py <report_id> [--config '{...}']
    - Nếu truyền --config → dùng config đó (dành cho test thủ công)
    - Không truyền → đọc từ env REPORT_CONFIG (set bởi server khi spawn)
    """
    import argparse

    parser = argparse.ArgumentParser(description="Generate traffic report")
    parser.add_argument("report_id", help="UUID của báo cáo trong DB (hoặc bất kỳ string khi --skip-db)")
    parser.add_argument("--config", help="JSON config string (tuỳ chọn, ghi đè REPORT_CONFIG env)")
    parser.add_argument("--skip-db", action="store_true", help="Bỏ qua cập nhật DB (dùng khi test local không có record)")
    args = parser.parse_args()

    if args.skip_db:
        os.environ["SKIP_DB_UPDATE"] = "true"
        logger.info("⏭️  Chế độ --skip-db: bỏ qua tất cả UPDATE reports")

    # Ưu tiên: --config arg > REPORT_CONFIG env > fallback test config
    config_str = args.config or os.getenv("REPORT_CONFIG")
    if config_str:
        try:
            report_config = json.loads(config_str)
        except json.JSONDecodeError as e:
            print(f"❌ Config JSON không hợp lệ: {e}")
            sys.exit(1)
    else:
        # Fallback cho test nhanh không cần DB status update
        print("⚠️  Không có REPORT_CONFIG env hoặc --config arg, dùng fallback test config")
        report_config = {
            "type": "daily",
            "period_from": "2026-03-18",
            "period_to": "2026-03-18",
            "title": "Test Report",
            "settings": {}
        }

    result = generate_report(args.report_id, report_config)
    print("Result:", json.dumps(result, indent=2, ensure_ascii=False))