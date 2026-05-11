"""Chạy toàn bộ pipeline: extract + plot (6 biểu đồ, phạm vi 15/02–15/04)."""

from __future__ import annotations

import argparse
import subprocess
import sys


def run_cmd(cmd: list[str]) -> None:
    print("▶", " ".join(cmd))
    result = subprocess.run(cmd, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(cmd)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run extraction + all chart scripts")
    parser.add_argument("--date-from", required=True, help="YYYY-MM-DD")
    parser.add_argument("--date-to", required=True, help="YYYY-MM-DD")
    parser.add_argument("--chunk-days", type=int, default=1)
    parser.add_argument("--sql-fetch-chunk-size", type=int, default=20000)
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    py = sys.executable
    base = "reports/trend_analysis"

    run_cmd(
        [
            py,
            f"{base}/extract_data.py",
            "--date-from",
            args.date_from,
            "--date-to",
            args.date_to,
            "--chunk-days",
            str(args.chunk_days),
            "--sql-fetch-chunk-size",
            str(args.sql_fetch_chunk_size),
        ]
    )

    run_cmd([py, f"{base}/plot_traffic_overview.py"])
    run_cmd([py, f"{base}/plot_forecast_quality.py"])
    run_cmd([py, f"{base}/plot_model_health.py"])

    print("✅ Hoàn tất pipeline trend analysis — 6 biểu đồ trong outputs/")


if __name__ == "__main__":
    main()
