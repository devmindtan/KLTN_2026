"""
Model Performance Service - Main Entry Point (CronJob mode)
Chạy 1 lần: Tính metrics → Lưu vào PostgreSQL (1 snapshot/ngày)
Schedule: 0 7 * * * (07:00 UTC = 14:00 ICT)
"""

import asyncio
import logging
import sys

from update_fiware import run_single_update

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def print_banner():
    """In banner khi service khởi động"""
    banner = """
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        MODEL PERFORMANCE METRICS SERVICE                  ║
║        Phân tích độ chính xác ML Model                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    """
    print(banner)


async def main():
    """Main function - entry point của CronJob (chạy 1 lần rồi thoát)"""
    print_banner()

    arg = sys.argv[1] if len(sys.argv) > 1 else "--once"

    if arg == "--once":
        logger.info("🔄 Running in SINGLE-SHOT mode (CronJob)")
        result = await run_single_update()

        if result:
            overall = result.get("overall", {})
            logger.info(
                f"✅ Done | MAE={overall.get('mae')}xe, "
                f"MAPE={overall.get('mape')}%, "
                f"Accuracy≤5xe={overall.get('accuracy_5xe')}%"
            )
            return 0
        else:
            logger.error("❌ Failed to save metrics")
            return 1

    elif arg == "--test":
        # Test mode - chỉ tính, không lưu DB
        logger.info("🧪 Running in TEST mode (no DB save)")
        from analyze_metrics import ModelPerformanceAnalyzer, engine

        analyzer = ModelPerformanceAnalyzer(engine)
        report = analyzer.get_full_report(period_days=7)

        print("\n" + "=" * 60)
        print("TEST RESULTS - METRICS SUMMARY")
        print("=" * 60)
        print(f"Period: {report['period_days']} days")
        print(f"Generated at: {report['generated_at']}")
        print("\nOverall Metrics:")
        for key, value in report["overall"].items():
            print(f"  {key:25s}: {value}")

        print("\nHorizon Analysis:")
        for h in report["by_horizon"]:
            print(
                f"  {h['horizon_minutes']:2d}m: MAE={h['avg_error']:5.2f} "
                f"Acc≤5xe={h['accuracy_5xe']:5.1f}% → {h['recommendation']}"
            )

        logger.info("✅ Test completed successfully")
        return 0

    elif arg == "--help":
        print(
            """
Usage: python main.py [OPTIONS]

Options:
  (no args)   Run once and exit (default, dùng cho CronJob)
  --once      Run once and exit
  --test      Test mode - chỉ tính metrics, không lưu DB
  --help      Show this help message
            """
        )
        return 0

    else:
        logger.error(f"❌ Unknown argument: {arg}")
        logger.info("Use --help for usage information")
        return 1


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        sys.exit(1)
