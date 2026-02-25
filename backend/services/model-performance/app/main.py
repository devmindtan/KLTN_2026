"""
Model Performance Service - Main Entry Point
Chạy service phân tích metrics và gửi lên FIWARE định kỳ
"""

import asyncio
import logging
import sys

from app.update_fiware import run_metrics_update_cycle, run_single_update

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
    """Main function - entry point của service"""
    print_banner()

    # Check command line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == "--once":
            # Single execution mode
            logger.info("🔄 Running in SINGLE-SHOT mode")
            logger.info("📊 Calculating metrics and sending to FIWARE once...")
            result = await run_single_update()

            if result:
                logger.info("✅ Success! Metrics sent to FIWARE")
                overall = result.get("overall", {})
                logger.info(
                    f"   Summary: MAE={overall.get('mae')}xe, "
                    f"MAPE={overall.get('mape')}%, "
                    f"Accuracy≤5xe={overall.get('accuracy_5xe')}%"
                )
                return 0
            else:
                logger.error("❌ Failed to send metrics")
                return 1

        elif sys.argv[1] == "--test":
            # Test mode - only calculate, không gửi FIWARE
            logger.info("🧪 Running in TEST mode (no FIWARE update)")
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

        elif sys.argv[1] == "--help":
            print(
                """
Usage: python main.py [OPTIONS]

Options:
  (no args)   Run continuous service (update every 60 minutes)
  --once      Run once and exit
  --test      Test mode - calculate metrics without sending to FIWARE
  --help      Show this help message

Examples:
  python main.py              # Continuous mode (default)
  python main.py --once       # Single execution
  python main.py --test       # Test calculation only
            """
            )
            return 0

        else:
            logger.error(f"❌ Unknown argument: {sys.argv[1]}")
            logger.info("Use --help for usage information")
            return 1

    # Default: Continuous mode
    logger.info("🔁 Running in CONTINUOUS mode")
    logger.info("📊 Will update metrics every 60 minutes")
    logger.info("⚠️  Press Ctrl+C to stop")

    try:
        await run_metrics_update_cycle(interval_minutes=60)
    except KeyboardInterrupt:
        logger.info("\n⚠️  Service stopped by user (Ctrl+C)")
        return 0
    except Exception as e:
        logger.error(f"❌ Service crashed: {e}")
        return 1


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        sys.exit(1)
