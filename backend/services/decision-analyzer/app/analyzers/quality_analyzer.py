"""
Model Quality Analyzer
Monitors prediction accuracy and recommends model maintenance actions

Confidence model
────────────────
  The analyzer is itself reporting on model quality, so confidence here
  reflects how reliable our *measurement* of quality is:

  confidence = confidence_from_samples(sample_count, reference=20)
      capped at 90 — MAPE is a point estimate; there is always measurement noise.

  Hard rule: if sample_count < 3 → suppress (not enough actuals to judge).
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)

_MIN_SAMPLES = 3
_MAPE_WARN = 25.0   # yellow flag
_MAPE_CRIT = 40.0   # red flag — immediate retrain
_MIN_INPUT_SAMPLES = 10


class QualityAnalyzer(BaseAnalyzer):
    """Analyzes model quality and predicts when retraining is needed"""

    async def analyze(self) -> List[Dict]:
        try:
            decisions = []
            quality_issues = self._get_quality_issues()

            if not quality_issues:
                logger.info(f"[{self.name}] Model quality is acceptable")
                return []

            logger.info(f"[{self.name}] Found {len(quality_issues)} quality issues")

            for issue in quality_issues:
                issue_decisions = self._analyze_quality_issue(issue)
                decisions.extend(issue_decisions)

            logger.info(f"[{self.name}] Generated {len(decisions)} decisions")
            return decisions

        except Exception as e:
            logger.error(f"[{self.name}] Analysis failed: {e}", exc_info=True)
            return []

    def _get_quality_issues(self) -> List[Dict]:
        """
        Get cameras with degraded model accuracy (MAPE > threshold) or
        insufficient input data in last 24h.

        Also returns p25/p75 MAPE for spread analysis — a high-spread MAPE
        (p75 − p25 > 30%) is a sign of intermittent degradation, not just
        a noisy average.
        """
        query = """
            SELECT
                cf.camera_id                                                AS cam_id,
                cd.display_name,
                cd.location,
                COUNT(*)                                                    AS sample_count,
                AVG(
                    CASE WHEN cf.actual_value > 0
                    THEN ABS(cf.actual_value - cf.predicted_value) / cf.actual_value * 100
                    ELSE NULL END
                )                                                           AS mape,
                PERCENTILE_CONT(0.25) WITHIN GROUP (
                    ORDER BY
                        CASE WHEN cf.actual_value > 0
                        THEN ABS(cf.actual_value - cf.predicted_value) / cf.actual_value * 100
                        ELSE NULL END
                )                                                           AS mape_p25,
                PERCENTILE_CONT(0.75) WITHIN GROUP (
                    ORDER BY
                        CASE WHEN cf.actual_value > 0
                        THEN ABS(cf.actual_value - cf.predicted_value) / cf.actual_value * 100
                        ELSE NULL END
                )                                                           AS mape_p75,
                SQRT(AVG(POWER(cf.actual_value - cf.predicted_value, 2)))  AS rmse,
                AVG(cf.input_sample_count)                                  AS avg_input_samples
            FROM camera_forecasts cf
            LEFT JOIN camera_data cd ON cf.camera_id = cd.cam_id
            WHERE cf.actual_value IS NOT NULL
              AND cf.forecast_for_time > NOW() - INTERVAL '24 hours'
            GROUP BY cf.camera_id, cd.display_name, cd.location
            HAVING COUNT(*) >= %s
              AND (
                AVG(
                    CASE WHEN cf.actual_value > 0
                    THEN ABS(cf.actual_value - cf.predicted_value) / cf.actual_value * 100
                    ELSE NULL END
                ) > %s
                OR AVG(cf.input_sample_count) < %s
              )
            ORDER BY mape DESC NULLS LAST
            LIMIT 20
        """
        return self._safe_query(query, (_MIN_SAMPLES, _MAPE_WARN, _MIN_INPUT_SAMPLES))

    def _calc_confidence(self, issue: Dict) -> float:
        """Confidence in our quality measurement scales with number of actuals."""
        return min(
            90.0,
            self.confidence_from_samples(
                int(issue.get("sample_count") or 0),
                reference=20,
                floor=30.0,
                ceiling=90.0,
            )
        )

    def _analyze_quality_issue(self, issue: Dict) -> List[Dict]:
        """Generate ONE decision per quality issue: MAPE issue takes precedence"""
        mape = float(issue.get("mape") or 0)
        avg_samples = float(issue.get("avg_input_samples") or 0)

        if mape >= _MAPE_WARN:
            d = self._create_retrain_decision(issue)
            return [d] if d else []
        if avg_samples < _MIN_INPUT_SAMPLES:
            d = self._create_data_quality_decision(issue)
            return [d] if d else []
        return []

    def _build_evidence(self, issue: Dict, confidence: float) -> Dict:
        mape_p25 = issue.get("mape_p25")
        mape_p75 = issue.get("mape_p75")
        spread = (float(mape_p75) - float(mape_p25)) if (mape_p25 is not None and mape_p75 is not None) else None
        return {
            "mape": round(float(issue.get("mape") or 0), 2),
            "mape_p25": round(float(mape_p25), 2) if mape_p25 is not None else None,
            "mape_p75": round(float(mape_p75), 2) if mape_p75 is not None else None,
            "mape_spread_iqr": round(spread, 2) if spread is not None else None,
            "rmse": round(float(issue.get("rmse") or 0), 2),
            "sample_count": int(issue.get("sample_count") or 0),
            "avg_input_samples": round(float(issue.get("avg_input_samples") or 0), 1),
            "mape_threshold_warn": _MAPE_WARN,
            "mape_threshold_crit": _MAPE_CRIT,
            "confidence_breakdown": {
                "method": "confidence_from_samples(reference=20)",
                "final": confidence,
            },
        }

    def _create_retrain_decision(self, issue: Dict) -> Optional[Dict]:
        mape = float(issue.get("mape") or 0)
        if mape < _MAPE_WARN:
            return None

        cam_id = issue["cam_id"]
        name = issue.get("display_name") or cam_id
        confidence = self._calc_confidence(issue)

        # Escalate urgency for critical MAPE
        urgency = 80 if mape >= _MAPE_CRIT else 60
        impact = 75 if mape >= _MAPE_CRIT else 65

        mape_p25 = issue.get("mape_p25")
        mape_p75 = issue.get("mape_p75")
        spread_note = ""
        if mape_p25 is not None and mape_p75 is not None:
            spread = float(mape_p75) - float(mape_p25)
            if spread > 30:
                spread_note = (
                    f" Biến động MAPE cao (IQR = {spread:.1f}%) cho thấy "
                    "độ chính xác không ổn định — có thể liên quan đến sự kiện đặc biệt."
                )

        return self._create_decision(
            category="quality",
            title=f"Huấn luyện lại mô hình dự báo cho {name}",
            recommendation=f"MAPE = {mape:.1f}% vượt ngưỡng {_MAPE_WARN:.0f}%. Khởi động quy trình huấn luyện lại mô hình.",
            rationale=(
                f"Sai số dự báo trung bình {mape:.1f}% trong 24 giờ qua "
                f"(dựa trên {int(issue.get('sample_count') or 0)} cặp dự báo–thực tế).{spread_note} "
                "Mô hình cần được cập nhật dữ liệu mới."
            ),
            score_impact=impact,
            score_confidence=confidence,
            score_urgency=urgency,
            camera_ids=[cam_id],
            evidence=self._build_evidence(issue, confidence),
            action_items=[
                {"action": "Kiểm tra pipeline dữ liệu huấn luyện", "actor": "technician", "timeToAction": "soon"},
                {"action": "Kích hoạt job huấn luyện lại qua giao diện Models", "actor": "technician", "timeToAction": "planned"},
                {"action": "Đánh giá MAPE sau khi deploy model mới", "actor": "system", "timeToAction": "planned"},
            ],
            effective_until=datetime.now() + timedelta(days=1),
        )

    def _create_data_quality_decision(self, issue: Dict) -> Optional[Dict]:
        avg_samples = float(issue.get("avg_input_samples") or 0)
        if avg_samples >= _MIN_INPUT_SAMPLES:
            return None

        cam_id = issue["cam_id"]
        name = issue.get("display_name") or cam_id
        confidence = self._calc_confidence(issue)

        return self._create_decision(
            category="quality",
            title=f"Điều tra chất lượng dữ liệu camera {name}",
            recommendation=(
                f"Số mẫu đầu vào trung bình ({avg_samples:.1f}) dưới ngưỡng tối thiểu "
                f"({_MIN_INPUT_SAMPLES}). Kiểm tra luồng dữ liệu detection."
            ),
            rationale=(
                f"Input sample count = {avg_samples:.1f} < {_MIN_INPUT_SAMPLES} — "
                f"mô hình thiếu đủ dữ liệu để dự báo chính xác "
                f"(dựa trên {int(issue.get('sample_count') or 0)} lần đo lường)."
            ),
            score_impact=65,
            score_confidence=confidence,
            score_urgency=70,
            camera_ids=[cam_id],
            evidence=self._build_evidence(issue, confidence),
            action_items=[
                {"action": "Kiểm tra luồng detection từ camera", "actor": "technician", "timeToAction": "soon"},
                {"action": "Xác minh service image-process đang chạy", "actor": "technician", "timeToAction": "soon"},
                {"action": "Bổ sung dữ liệu nếu pipeline bị gián đoạn", "actor": "technician", "timeToAction": "planned"},
            ],
            effective_until=datetime.now() + timedelta(days=1),
        )
