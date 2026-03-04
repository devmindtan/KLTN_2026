"""
Exporter module - Convert DataFrame → gzip bytes và upload lên MinIO
"""
import gzip
import io
import json
import logging
import os
from datetime import date

import boto3
import pandas as pd
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

BUCKET = os.getenv("MINIO_BUCKET", "data-library")


def _get_minio_client():
    """Khởi tạo boto3 S3 client trỏ vào MinIO"""
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("MINIO_ENDPOINT_URL"),
        aws_access_key_id=os.getenv("MINIO_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("MINIO_SECRET_KEY"),
    )


def _df_to_csv_gz(df: pd.DataFrame) -> bytes:
    """DataFrame → CSV string → gzip bytes"""
    csv_str = df.to_csv(index=False)
    return gzip.compress(csv_str.encode("utf-8"))


def _df_to_json_gz(df: pd.DataFrame) -> bytes:
    """DataFrame → JSON array string → gzip bytes"""
    json_str = df.to_json(orient="records", date_format="iso", force_ascii=False)
    return gzip.compress(json_str.encode("utf-8"))


def _upload_bytes(client, key: str, data: bytes, content_type: str) -> int:
    """
    Upload raw bytes lên MinIO
    Trả về số bytes đã upload
    """
    try:
        client.put_object(
            Bucket=BUCKET,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        logger.info(f"✅ Uploaded {key} ({len(data):,} bytes)")
        return len(data)
    except ClientError as e:
        logger.error(f"❌ Upload failed [{key}]: {e}")
        raise


def export_detections(df: pd.DataFrame, snapshot_date: date, timestamp_str: str) -> tuple[dict, dict]:
    """
    Export detections DataFrame lên MinIO dưới 2 format: csv.gz, json.gz
    Trả về (minio_keys, file_sizes)
    """
    client = _get_minio_client()
    minio_keys = {}
    file_sizes = {}

    # CSV
    csv_key = f"internal/{timestamp_str}_detections.csv.gz"
    csv_bytes = _df_to_csv_gz(df)
    file_sizes["detections_csv"] = _upload_bytes(client, csv_key, csv_bytes, "application/gzip")
    minio_keys["detections_csv"] = csv_key

    # JSON
    json_key = f"internal/{timestamp_str}_detections.json.gz"
    json_bytes = _df_to_json_gz(df)
    file_sizes["detections_json"] = _upload_bytes(client, json_key, json_bytes, "application/gzip")
    minio_keys["detections_json"] = json_key

    return minio_keys, file_sizes


def export_forecasts(df: pd.DataFrame, snapshot_date: date, timestamp_str: str) -> tuple[dict, dict]:
    """
    Export forecasts DataFrame lên MinIO dưới 2 format: csv.gz, json.gz
    Trả về (minio_keys, file_sizes)
    """
    client = _get_minio_client()
    minio_keys = {}
    file_sizes = {}

    # CSV
    csv_key = f"internal/{timestamp_str}_forecasts.csv.gz"
    csv_bytes = _df_to_csv_gz(df)
    file_sizes["forecasts_csv"] = _upload_bytes(client, csv_key, csv_bytes, "application/gzip")
    minio_keys["forecasts_csv"] = csv_key

    # JSON
    json_key = f"internal/{timestamp_str}_forecasts.json.gz"
    json_bytes = _df_to_json_gz(df)
    file_sizes["forecasts_json"] = _upload_bytes(client, json_key, json_bytes, "application/gzip")
    minio_keys["forecasts_json"] = json_key

    return minio_keys, file_sizes


def export_summary(
    snapshot_date: date,
    timestamp_str: str,
    detections_df: pd.DataFrame,
    forecasts_df: pd.DataFrame,
    all_minio_keys: dict,
) -> str:
    """
    Tạo và upload summary.json (không nén) cho snapshot
    Trả về minio_key của summary file
    """
    client = _get_minio_client()

    # Tính avg_error_by_horizon nếu có actual_value
    avg_error = {}
    if not forecasts_df.empty and "error_value" in forecasts_df.columns:
        for horizon, grp in forecasts_df.dropna(subset=["error_value"]).groupby("horizon_minutes"):
            avg_error[str(int(horizon))] = round(float(grp["error_value"].mean()), 3)

    cameras_det = int(detections_df["camera_id"].nunique()) if not detections_df.empty else 0
    cameras_fore = int(forecasts_df["camera_id"].nunique()) if not forecasts_df.empty else 0
    avg_obj = round(float(detections_df["total_objects"].mean()), 2) if not detections_df.empty else 0.0

    summary = {
        "date": str(snapshot_date),
        "generated_at": f"{timestamp_str[:4]}-{timestamp_str[4:6]}-{timestamp_str[6:8]}T{timestamp_str[9:11]}:{timestamp_str[11:13]}:{timestamp_str[13:15]}Z",
        "detections": {
            "total_records": len(detections_df),
            "cameras": cameras_det,
            "avg_total_objects_per_5min": avg_obj,
        },
        "forecasts": {
            "total_records": len(forecasts_df),
            "cameras": cameras_fore,
            "horizons": sorted(forecasts_df["horizon_minutes"].unique().tolist()) if not forecasts_df.empty else [],
            "avg_error_by_horizon": avg_error,
        },
        "files": list(all_minio_keys.values()),
    }

    summary_key = f"internal/{timestamp_str}_summary.json"
    summary_bytes = json.dumps(summary, ensure_ascii=False, indent=2).encode("utf-8")
    _upload_bytes(client, summary_key, summary_bytes, "application/json")

    return summary_key
