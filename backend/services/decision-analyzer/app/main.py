#!/usr/bin/env python3
"""
Decision-Making System Analyzer
Main orchestrator for generating traffic management recommendations
Runs as CronJob (every 15 minutes) or triggered on-demand

Usage:
  python main.py          # Run full analysis
  python main.py --test   # Run with test data (no DB write)
"""

import os
import sys
import json
import logging
import asyncio
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from typing import Optional
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db_client import get_db_connection, close_db_connection
from analyzers.congestion_analyzer import CongestionAnalyzer
from analyzers.predictive_analyzer import PredictiveAnalyzer
from analyzers.optimization_analyzer import OptimizationAnalyzer
from analyzers.quality_analyzer import QualityAnalyzer
from analyzers.monitoring_analyzer import MonitoringAnalyzer

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s - %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# Decisions with compound score below this are not stored
_MIN_COMPOUND_SCORE_TO_STORE = 30.0


class DecisionAnalyzerOrchestrator:
    """Orchestrates all analyzer modules and stores results"""

    def __init__(self, test_mode: bool = False):
        self.test_mode = test_mode
        self.db_conn = None
        self.analyzers = []
        self.all_decisions = []

    async def initialize(self):
        try:
            if not self.test_mode:
                self.db_conn = get_db_connection()
                logger.info("✅ Database connection established")

            self.analyzers = [
                CongestionAnalyzer(self.db_conn),
                PredictiveAnalyzer(self.db_conn),
                OptimizationAnalyzer(self.db_conn),
                QualityAnalyzer(self.db_conn),
                MonitoringAnalyzer(self.db_conn),
            ]
            logger.info(f"✅ Initialized {len(self.analyzers)} analyzer modules")

        except Exception as e:
            logger.error(f"❌ Failed to initialize: {e}")
            raise

    async def run_analysis(self) -> list:
        logger.info("=" * 60)
        logger.info("Starting Decision Analysis")
        logger.info("=" * 60)

        try:
            tasks = [analyzer.analyze() for analyzer in self.analyzers]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            all_decisions = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"❌ Analyzer {i} failed: {result}")
                else:
                    decisions = result or []
                    logger.info(f"✅ Analyzer {i} ({self.analyzers[i].name}) generated {len(decisions)} decisions")
                    all_decisions.extend(decisions)

            # Filter out any decisions that slipped through with too-low compound score
            before = len(all_decisions)
            all_decisions = [
                d for d in all_decisions
                if d.get("score_compound", 0) >= _MIN_COMPOUND_SCORE_TO_STORE
            ]
            filtered = before - len(all_decisions)
            if filtered:
                logger.info(f"🔽 Filtered {filtered} low-quality decisions (compound < {_MIN_COMPOUND_SCORE_TO_STORE})")

            self.all_decisions = all_decisions
            self._log_confidence_summary(all_decisions)
            logger.info(f"📊 Total decisions to store: {len(all_decisions)}")
            return all_decisions

        except Exception as e:
            logger.error(f"❌ Analysis failed: {e}")
            raise

    def _log_confidence_summary(self, decisions: list):
        """Log a breakdown of confidence tiers so operators can assess batch quality."""
        if not decisions:
            return
        tiers = {"high (≥75)": 0, "medium (50-74)": 0, "low (<50)": 0}
        for d in decisions:
            c = d.get("score_confidence", 0)
            if c >= 75:
                tiers["high (≥75)"] += 1
            elif c >= 50:
                tiers["medium (50-74)"] += 1
            else:
                tiers["low (<50)"] += 1
        logger.info(
            f"📈 Confidence breakdown — "
            + " | ".join(f"{k}: {v}" for k, v in tiers.items())
        )

    async def store_decisions(self):
        """Store generated decisions to database, skipping active duplicates."""
        if self.test_mode or not self.db_conn:
            logger.info("ℹ️ Test mode: Decisions not stored to DB")
            return

        if not self.all_decisions:
            logger.info("ℹ️ No decisions to store")
            return

        try:
            cursor = self.db_conn.cursor()

            # Load active decisions from last 24h to dedup
            # Key = (category, camera_id, title_prefix_40_chars) — more specific than before
            cursor.execute("""
                SELECT category, camera_ids, LEFT(title, 40)
                FROM decisions
                WHERE status IN ('new', 'reviewed')
                  AND generated_at > NOW() - INTERVAL '24 hours'
            """)
            existing = cursor.fetchall()
            existing_keys: set = set()
            for cat, cam_ids_val, title_prefix in existing:
                cam_list = cam_ids_val if isinstance(cam_ids_val, list) else json.loads(cam_ids_val or "[]")
                primary = cam_list[0] if cam_list else ""
                existing_keys.add((cat, primary, title_prefix))

            stored_count = 0
            skipped_count = 0
            seen_this_run: set = set()

            for decision in self.all_decisions:
                cam_list = decision.get("camera_ids") or []
                primary_cam = cam_list[0] if cam_list else ""
                title_prefix = decision.get("title", "")[:40]
                dedup_key = (decision["category"], primary_cam, title_prefix)

                if dedup_key in existing_keys or dedup_key in seen_this_run:
                    skipped_count += 1
                    logger.debug(f"⏭ Skipping duplicate: {dedup_key}")
                    continue

                seen_this_run.add(dedup_key)
                cursor.execute("""
                    INSERT INTO decisions (
                        category, title, recommendation, rationale,
                        score_impact, score_confidence, score_urgency, score_compound,
                        camera_ids, evidence, action_items, effective_until, created_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    decision["category"],
                    decision["title"],
                    decision["recommendation"],
                    decision["rationale"],
                    decision["score_impact"],
                    decision["score_confidence"],
                    decision["score_urgency"],
                    decision["score_compound"],
                    json.dumps(decision.get("camera_ids", [])),
                    json.dumps(decision.get("evidence", {})),
                    json.dumps(decision.get("action_items", [])),
                    decision.get("effective_until"),
                    "system"
                ))
                stored_count += 1

            self.db_conn.commit()
            logger.info(f"✅ Stored {stored_count} decisions (skipped {skipped_count} duplicates)")

            if stored_count > 0:
                await self._notify_decision_ready(stored_count)

        except Exception as e:
            logger.error(f"❌ Failed to store decisions: {e}")
            if self.db_conn:
                self.db_conn.rollback()
            raise
        finally:
            if cursor:
                cursor.close()

    async def _notify_decision_ready(self, count: int):
        """
        POST to app-route webhook to broadcast DECISION_UPDATED via Socket.IO.
        Best-effort — never raises.
        """
        webhook_url = os.getenv("APP_ROUTE_WEBHOOK_URL", "")
        if not webhook_url:
            logger.debug("ℹ️ APP_ROUTE_WEBHOOK_URL not configured, skipping notify")
            return

        payload = json.dumps({
            "data": [{
                "type": "DecisionReady",
                "id": "urn:ngsi-ld:DecisionReady:1",
                "count": {"type": "Number", "value": count},
                "triggered_at": {"type": "Text", "value": datetime.now().isoformat()},
            }]
        }).encode("utf-8")

        try:
            req = urllib.request.Request(
                webhook_url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                logger.info(f"📡 Notified app-route DECISION_UPDATED ({count} decisions) → HTTP {resp.status}")
        except urllib.error.URLError as e:
            logger.warning(f"⚠️ Failed to notify app-route: {e.reason}")
        except Exception as e:
            logger.warning(f"⚠️ Failed to notify app-route: {e}")

    async def cleanup(self):
        if self.db_conn:
            close_db_connection(self.db_conn)
            logger.info("✅ Database connection closed")

    async def run(self) -> list:
        try:
            await self.initialize()
            decisions = await self.run_analysis()
            await self.store_decisions()
            return decisions
        finally:
            await self.cleanup()


async def main():
    parser = argparse.ArgumentParser(description="Decision-Making System Analyzer")
    parser.add_argument("--test", action="store_true", help="Run in test mode (no DB write)")
    args = parser.parse_args()

    orchestrator = DecisionAnalyzerOrchestrator(test_mode=args.test)

    try:
        decisions = await orchestrator.run()

        logger.info("=" * 60)
        logger.info("Analysis Complete ✅")
        logger.info("=" * 60)

        if args.test:
            logger.info("\n📋 Generated Decisions:")
            for d in decisions:
                logger.info(
                    f"  [{d['score_compound']:.1f}] "
                    f"conf={d['score_confidence']:.0f} "
                    f"| {d['category']:<15} "
                    f"| {d['title']}"
                )

        return 0

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
