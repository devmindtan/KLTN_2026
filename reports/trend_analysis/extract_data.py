"""
Trích xuất dữ liệu phân tích xu hướng theo chunk để tránh tràn RAM.

Tables:
- camera_forecasts (chunk theo forecast_for_time)
- camera_detections (aggregate theo giờ + chunk theo created_at)
- ml_model_metadata (full)
- model_metrics_history (full + flatten JSON)
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import create_engine, text


@dataclass
class ExtractConfig:
    output_dir: Path
    date_from: datetime
    date_to: datetime
    chunk_days: int
    sql_fetch_chunk_size: int


def _load_env_file(file_path: Path) -> None:
    """Load simple KEY=VALUE pairs from .env file into process env if key is missing."""
    if not file_path.exists():
        return

    for raw_line in file_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _bootstrap_env() -> None:
    """Try loading env vars from trend_analysis/.env, then workspace root .env as fallback."""
    script_dir = Path(__file__).resolve().parent
    root_dir = script_dir.parents[2]

    _load_env_file(script_dir / ".env")
    _load_env_file(root_dir / ".env")


def _get_db_engine():
    host = os.getenv("POSTGRES_HOST")
    db = os.getenv("POSTGRES_DBS")
    user = os.getenv("POSTGRES_USERNAME")
    pwd = os.getenv("POSTGRES_PASSWORD")
    port = os.getenv("POSTGRES_PORT", "5432")

    if not all([host, db, user, pwd]):
        raise ValueError(
            "Thiếu env vars POSTGRES_HOST / POSTGRES_DBS / POSTGRES_USERNAME / POSTGRES_PASSWORD"
        )

    db_url = f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{db}"
    return create_engine(db_url, pool_pre_ping=True)


def _daterange_chunks(start: datetime, end: datetime, chunk_days: int):
    cursor = start
    while cursor < end:
        chunk_end = min(cursor + timedelta(days=chunk_days), end)
        yield cursor, chunk_end
        cursor = chunk_end


def _append_csv(df: pd.DataFrame, path: Path) -> int:
    if df.empty:
        return 0
    header = not path.exists()
    df.to_csv(path, mode="a", index=False, header=header)
    return len(df)


def _column_exists(engine, table_name: str, column_name: str, table_schema: str = "public") -> bool:
    query = text(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = :table_schema
          AND table_name = :table_name
          AND column_name = :column_name
        LIMIT 1
        """
    )
    with engine.connect() as conn:
        result = conn.execute(
            query,
            {
                "table_schema": table_schema,
                "table_name": table_name,
                "column_name": column_name,
            },
        )
        return result.scalar() is not None


def extract_camera_forecasts(engine, cfg: ExtractConfig) -> dict[str, Any]:
    out_file = cfg.output_dir / "camera_forecasts.csv"
    if out_file.exists():
        out_file.unlink()

    query = text(
        """
        SELECT
            camera_id,
            forecast_for_time,
            horizon_minutes,
            predicted_value,
            actual_value,
            error_value,
            input_value,
            input_sample_count,
            lag_sample_count,
            sync_sample_count,
            created_at
        FROM camera_forecasts
        WHERE forecast_for_time >= :start_ts
          AND forecast_for_time < :end_ts
        ORDER BY forecast_for_time
        """
    )

    total_rows = 0
    total_sql_chunks = 0

    for start_ts, end_ts in _daterange_chunks(cfg.date_from, cfg.date_to, cfg.chunk_days):
        for sql_chunk in pd.read_sql(
            query,
            engine,
            params={"start_ts": start_ts, "end_ts": end_ts},
            chunksize=cfg.sql_fetch_chunk_size,
        ):
            total_rows += _append_csv(sql_chunk, out_file)
            total_sql_chunks += 1

    return {
        "file": str(out_file),
        "rows": total_rows,
        "sql_chunks": total_sql_chunks,
    }


def extract_camera_detections_hourly(engine, cfg: ExtractConfig) -> dict[str, Any]:
    out_file = cfg.output_dir / "camera_detections_hourly.csv"
    if out_file.exists():
        out_file.unlink()

    query = text(
        """
        SELECT
            date_trunc('hour', created_at) AS hour_bucket,
            camera_id,
            AVG(total_objects)::double precision AS avg_objects,
            MAX(total_objects) AS max_objects,
            MIN(total_objects) AS min_objects,
            COALESCE(STDDEV_POP(total_objects), 0)::double precision AS std_objects,
            SUM(total_objects) AS sum_objects,
            COUNT(*) AS sample_count
        FROM camera_detections
        WHERE created_at >= :start_ts
          AND created_at < :end_ts
        GROUP BY 1, 2
        ORDER BY 1, 2
        """
    )

    total_rows = 0
    total_sql_chunks = 0

    for start_ts, end_ts in _daterange_chunks(cfg.date_from, cfg.date_to, cfg.chunk_days):
        for sql_chunk in pd.read_sql(
            query,
            engine,
            params={"start_ts": start_ts, "end_ts": end_ts},
            chunksize=cfg.sql_fetch_chunk_size,
        ):
            total_rows += _append_csv(sql_chunk, out_file)
            total_sql_chunks += 1

    return {
        "file": str(out_file),
        "rows": total_rows,
        "sql_chunks": total_sql_chunks,
    }


def extract_ml_model_metadata(engine, cfg: ExtractConfig) -> dict[str, Any]:
    out_file = cfg.output_dir / "ml_model_metadata.csv"
    if out_file.exists():
        out_file.unlink()

    has_activated_at = _column_exists(engine, "ml_model_metadata", "activated_at")
    activated_at_select = "activated_at" if has_activated_at else "NULL::timestamptz AS activated_at"

    query = text(
        f"""
        SELECT
            id,
            model_type,
            model_version,
            minio_key,
            base_model,
            training_samples,
            training_duration_hours,
            metrics,
            is_active,
            {activated_at_select},
            created_at
        FROM ml_model_metadata
        ORDER BY created_at
        """
    )
    df = pd.read_sql(query, engine)
    rows = _append_csv(df, out_file)
    return {"file": str(out_file), "rows": rows}


def _extract_from_json(raw: Any, *keys: str, default=None):
    if raw is None:
        return default
    payload = raw
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            return default
    if not isinstance(payload, dict):
        return default
    for key in keys:
        if key in payload:
            return payload[key]
    return default


def extract_model_metrics_history(engine, cfg: ExtractConfig) -> dict[str, Any]:
    raw_file = cfg.output_dir / "model_metrics_history_raw.csv"
    flat_file = cfg.output_dir / "model_metrics_history_flat.csv"
    horizon_file = cfg.output_dir / "model_metrics_by_horizon.csv"

    for file_path in [raw_file, flat_file, horizon_file]:
        if file_path.exists():
            file_path.unlink()

    query = text(
        """
        SELECT
            id,
            generated_at,
            snapshot_date,
            period_days,
            overall,
            by_horizon,
            camera_ranking,
            data_coverage,
            trend_accuracy,
            confidence_distribution,
            created_at
        FROM model_metrics_history
        ORDER BY generated_at
        """
    )

    df = pd.read_sql(query, engine)
    raw_rows = _append_csv(df, raw_file)

    flat_rows: list[dict[str, Any]] = []
    horizon_rows: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        overall = row.get("overall")
        data_coverage = row.get("data_coverage")
        trend_accuracy = row.get("trend_accuracy")
        confidence_distribution = row.get("confidence_distribution")
        by_horizon = row.get("by_horizon")

        flat_rows.append(
            {
                "generated_at": row.get("generated_at"),
                "snapshot_date": row.get("snapshot_date"),
                "period_days": row.get("period_days"),
                "overall_mae": _extract_from_json(overall, "mae"),
                "overall_rmse": _extract_from_json(overall, "rmse"),
                "overall_mape": _extract_from_json(overall, "mape"),
                "overall_accuracy_within_5": _extract_from_json(overall, "accuracy_within_5"),
                "overall_accuracy_within_10": _extract_from_json(overall, "accuracy_within_10"),
                "overall_trend_accuracy": _extract_from_json(overall, "trend_accuracy"),
                "overall_total_predictions": _extract_from_json(overall, "total_predictions"),
                "coverage_percentage": _extract_from_json(data_coverage, "coverage_percentage", "coverage_rate"),
                "trend_correct": _extract_from_json(trend_accuracy, "correct_predictions", "total_trend_correct"),
                "trend_total": _extract_from_json(trend_accuracy, "total_checks", "total_trend_checks"),
                "horizon_coverage_pct": _extract_from_json(trend_accuracy, "horizon_coverage_pct"),
                "prediction_confidence": _extract_from_json(
                    confidence_distribution, "prediction_confidence", "avg_prediction_confidence"
                ),
                "error_confidence": _extract_from_json(
                    confidence_distribution, "error_confidence", "avg_error_confidence"
                ),
            }
        )

        by_horizon_payload = by_horizon
        if isinstance(by_horizon_payload, str):
            try:
                by_horizon_payload = json.loads(by_horizon_payload)
            except json.JSONDecodeError:
                by_horizon_payload = []

        if isinstance(by_horizon_payload, list):
            for item in by_horizon_payload:
                if not isinstance(item, dict):
                    continue
                horizon_rows.append(
                    {
                        "generated_at": row.get("generated_at"),
                        "snapshot_date": row.get("snapshot_date"),
                        "horizon_minutes": item.get("horizon_minutes")
                        or item.get("horizon"),
                        "mae": item.get("mae"),
                        "mape": item.get("mape"),
                        "accuracy_within_5": item.get("accuracy_within_5"),
                        "accuracy_within_10": item.get("accuracy_within_10"),
                        "prediction_confidence": item.get("prediction_confidence"),
                        "error_confidence": item.get("error_confidence"),
                    }
                )

    flat_df = pd.DataFrame(flat_rows)
    horizon_df = pd.DataFrame(horizon_rows)

    flat_count = _append_csv(flat_df, flat_file)
    horizon_count = _append_csv(horizon_df, horizon_file)

    return {
        "raw_file": str(raw_file),
        "raw_rows": raw_rows,
        "flat_file": str(flat_file),
        "flat_rows": flat_count,
        "horizon_file": str(horizon_file),
        "horizon_rows": horizon_count,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract trend-analysis datasets with chunk strategy")
    parser.add_argument("--date-from", required=True, help="YYYY-MM-DD")
    parser.add_argument("--date-to", required=True, help="YYYY-MM-DD (exclusive upper bound +1 day internally)")
    parser.add_argument("--chunk-days", type=int, default=1, help="Số ngày mỗi chunk (default: 1)")
    parser.add_argument(
        "--sql-fetch-chunk-size",
        type=int,
        default=20000,
        help="chunksize cho pd.read_sql (default: 20000)",
    )
    parser.add_argument(
        "--output-dir",
        default="reports/trend_analysis/data",
        help="Thư mục output CSV",
    )
    return parser.parse_args()


def main() -> None:
    _bootstrap_env()

    args = parse_args()
    date_from = datetime.strptime(args.date_from, "%Y-%m-%d")
    date_to = datetime.strptime(args.date_to, "%Y-%m-%d") + timedelta(days=1)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    cfg = ExtractConfig(
        output_dir=output_dir,
        date_from=date_from,
        date_to=date_to,
        chunk_days=max(1, args.chunk_days),
        sql_fetch_chunk_size=max(1000, args.sql_fetch_chunk_size),
    )

    engine = _get_db_engine()

    manifest = {
        "run_at": datetime.now().isoformat(),
        "config": {
            "date_from": args.date_from,
            "date_to": args.date_to,
            "chunk_days": cfg.chunk_days,
            "sql_fetch_chunk_size": cfg.sql_fetch_chunk_size,
        },
        "tables": {},
    }

    manifest["tables"]["camera_forecasts"] = extract_camera_forecasts(engine, cfg)
    manifest["tables"]["camera_detections_hourly"] = extract_camera_detections_hourly(engine, cfg)
    manifest["tables"]["ml_model_metadata"] = extract_ml_model_metadata(engine, cfg)
    manifest["tables"]["model_metrics_history"] = extract_model_metrics_history(engine, cfg)

    manifest_file = output_dir / "extraction_manifest.json"
    manifest_file.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    print("✅ Extraction completed")
    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
