"""
System Monitoring Analyzer
Monitors system health, camera connectivity, and data quality

Confidence model
────────────────
  For missing-camera alerts:
    confidence = confidence_from_recency(minutes_since_update, stale_threshold=120)
    The longer a camera has been silent, the MORE certain we are something is wrong.
    So we invert: longer silence → higher confidence in the alert.

  Hard rules:
    - Camera never seen before → confidence = 70 (possible new camera, not misconfigured)
    - minutes_since_update > 24h → confidence = 95 (almost certainly a real failure)
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)

_MISSING_THRESHOLD_MIN = 30.0   # alert if no data for this many minutes
_NEVER_SEEN_CONFIDENCE = 70.0


class MonitoringAnalyzer(BaseAnalyzer):
    """Analyzes system health and monitoring data"""

    async def analyze(self) -> List[Dict]:
        try:
            decisions = []
            system_issues = self._get_system_issues()

            if not system_issues:
                logger.info(f"[{self.name}] System health is good")
                return []

            logger.info(f"[{self.name}] Found {len(system_issues)} system issues")

            for issue in system_issues:
                issue_decisions = self._analyze_system_issue(issue)
                decisions.extend(issue_decisions)

            logger.info(f"[{self.name}] Generated {len(decisions)} decisions")
            return decisions

        except Exception as e:
            logger.error(f"[{self.name}] Analysis failed: {e}", exc_info=True)
            return []

    def _get_system_issues(self) -> List[Dict]:
        issues = []
        missing_cams = self._check_missing_cameras()
        issues.extend(missing_cams)
        # consistency & calibration checks: deferred until reference data available
        return issues

    def _check_missing_cameras(self) -> List[Dict]:
        """
        Cameras silent for > _MISSING_THRESHOLD_MIN minutes.
        Also returns 7-day historical sample count so we can distinguish
        brand-new cameras (low hist_count) from previously active ones.
        """
        query = """
            WITH last_seen AS (
                SELECT
                    camera_id,
                    MAX(created_at)  AS last_update,
                    COUNT(*)         AS hist_7d_count
                FROM camera_detections
                WHERE created_at > NOW() - INTERVAL '7 days'
                GROUP BY camera_id
            )
            SELECT
                cd.cam_id,
                cd.display_name,
                cd.location,
                ls.last_update,
                ls.hist_7d_count,
                EXTRACT(EPOCH FROM (NOW() - ls.last_update)) / 60  AS minutes_since_update
            FROM camera_data cd
            LEFT JOIN last_seen ls ON cd.cam_id = ls.camera_id
            WHERE ls.last_update IS NULL
               OR ls.last_update < NOW() - INTERVAL '%s minutes'
            ORDER BY ls.last_update ASC NULLS FIRST
            LIMIT 10
        """
        # psycopg2 cannot interpolate into INTERVAL string directly — use format
        formatted = query.replace("'%s minutes'", f"'{int(_MISSING_THRESHOLD_MIN)} minutes'")
        results = self._safe_query(formatted)
        return [{"type": "missing_data", "data": r} for r in results]

    def _analyze_system_issue(self, issue: Dict) -> List[Dict]:
        issue_type = issue.get("type")
        decisions = []
        if issue_type == "missing_data":
            d = self._create_investigation_decision(issue)
            if d:
                decisions.append(d)
        return decisions

    def _calc_confidence(self, cam_data: Dict) -> float:
        """
        For missing-camera alerts, confidence INCREASES with silence duration.
        A camera missing for 2 hours is far more suspicious than one missing 31 minutes.
        """
        last_update = cam_data.get("last_update")
        minutes = cam_data.get("minutes_since_update")
        hist_count = int(cam_data.get("hist_7d_count") or 0)

        if last_update is None:
            # Camera never seen — could be new installation; moderate confidence
            return _NEVER_SEEN_CONFIDENCE

        minutes_f = float(minutes) if minutes is not None else _MISSING_THRESHOLD_MIN

        # Invert recency: longer silence → higher confidence the alert is real
        if minutes_f >= 24 * 60:     # 24h+ → near-certain failure
            base = 95.0
        elif minutes_f >= 4 * 60:   # 4h+ → very likely
            base = 90.0
        elif minutes_f >= 60:        # 1h+
            base = 82.0
        else:
            base = 70.0

        # Slight upward correction if the camera has a solid history (not brand new)
        if hist_count >= 100:
            base = min(95.0, base + 3.0)

        return round(base, 1)

    def _create_investigation_decision(self, issue: Dict) -> Optional[Dict]:
        cam_data = issue.get("data", {})
        cam_id = cam_data.get("cam_id") or "unknown"
        name = cam_data.get("display_name") or cam_id
        loc = cam_data.get("location") or ""
        minutes = cam_data.get("minutes_since_update")
        last_update = cam_data.get("last_update")
        hist_count = int(cam_data.get("hist_7d_count") or 0)
        confidence = self._calc_confidence(cam_data)

        if minutes is not None:
            m = float(minutes)
            if m >= 60:
                since_str = f"{m/60:.1f} giờ"
            else:
                since_str = f"{int(m)} phút"
        elif last_update is None:
            since_str = "chưa từng ghi nhận"
        else:
            since_str = "không xác định"

        hist_note = (
            f" Camera có {hist_count} lần quan sát trong 7 ngày qua — "
            "bất thường so với hoạt động bình thường." if hist_count >= 20
            else " Camera có rất ít lịch sử — có thể là thiết bị mới hoặc chưa được cấu hình."
        )

        return self._create_decision(
            category="monitoring",
            title=f"Điều tra mất tín hiệu camera {name}",
            recommendation=(
                f"Camera {name} ({loc}) không có dữ liệu trong {since_str}. "
                "Kiểm tra kết nối và phần cứng."
            ),
            rationale=(
                f"Cập nhật cuối: {last_update or 'N/A'}. "
                f"Thiếu dữ liệu ảnh hưởng độ chính xác toàn hệ thống.{hist_note}"
            ),
            score_impact=80,
            score_confidence=confidence,
            score_urgency=85,
            camera_ids=[cam_id],
            evidence={
                "last_update": str(last_update) if last_update else None,
                "minutes_since_update": float(minutes) if minutes is not None else None,
                "hist_7d_count": hist_count,
                "location": loc,
                "alert_threshold_minutes": _MISSING_THRESHOLD_MIN,
                "confidence_breakdown": {
                    "method": "inverted_recency(silence_duration)",
                    "final": confidence,
                },
            },
            action_items=[
                {"action": "Kiểm tra kết nối mạng và nguồn điện camera", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Xác minh service image-process đang chạy", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Liên hệ kỹ thuật viên hiện trường nếu cần", "actor": "technician", "timeToAction": "soon"},
            ],
            effective_until=datetime.now() + timedelta(hours=4),
        )
