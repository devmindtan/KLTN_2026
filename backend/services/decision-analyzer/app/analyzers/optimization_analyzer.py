"""
Route Optimization Analyzer
Identifies route performance gaps and recommends route changes

Confidence model
────────────────
  confidence = confidence_from_samples(sample_count, reference=50)
      capped at 85 — optimisation recommendations are longer-horizon and
      inherently harder to validate than real-time congestion alerts.

  Hard rules:
    - avg_vc < 0.4  AND  sample_count < 10  → suppress (not enough evidence)
    - Only emit route-change decision, not time-routing/infra (not enough data yet)
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)

_MIN_SAMPLES = 10
_VC_THRESHOLD = 0.40


class OptimizationAnalyzer(BaseAnalyzer):
    """Analyzes route performance and recommends optimizations"""

    async def analyze(self) -> List[Dict]:
        try:
            decisions = []
            problem_routes = self._get_problem_routes()

            if not problem_routes:
                logger.info(f"[{self.name}] No route optimization opportunities detected")
                return []

            logger.info(f"[{self.name}] Found {len(problem_routes)} route issues")

            for route in problem_routes:
                route_decisions = self._analyze_route(route)
                decisions.extend(route_decisions)

            logger.info(f"[{self.name}] Generated {len(decisions)} decisions")
            return decisions

        except Exception as e:
            logger.error(f"[{self.name}] Analysis failed: {e}", exc_info=True)
            return []

    def _get_problem_routes(self) -> List[Dict]:
        """
        Get cameras with persistently high load during peak hours (7 days).

        Uses p90 capacity baseline (consistent with CongestionAnalyzer).
        Also returns stddev of avg_vc across the 7-day window so we can
        distinguish *consistently* high load from occasional spikes.
        """
        query = """
            WITH capacity_calc AS (
                SELECT
                    camera_id,
                    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_objects) AS capacity_p90
                FROM camera_detections
                WHERE created_at > NOW() - INTERVAL '7 days'
                GROUP BY camera_id
                HAVING COUNT(*) >= 10
            ),
            hourly_load AS (
                SELECT
                    det.camera_id                                                      AS cam_id,
                    cd.display_name,
                    cd.location,
                    EXTRACT(HOUR FROM det.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS hour_of_day,
                    ROUND(
                        AVG(det.total_objects::float / NULLIF(COALESCE(cap.capacity_p90, 100), 0))::numeric, 3
                    )                                                                  AS avg_vc,
                    ROUND(
                        STDDEV(det.total_objects::float / NULLIF(COALESCE(cap.capacity_p90, 100), 0))::numeric, 3
                    )                                                                  AS stddev_vc,
                    COUNT(*)                                                           AS sample_count
                FROM camera_detections det
                LEFT JOIN camera_data cd      ON det.camera_id = cd.cam_id
                LEFT JOIN capacity_calc cap   ON det.camera_id = cap.camera_id
                WHERE det.created_at > NOW() - INTERVAL '7 days'
                  AND EXTRACT(HOUR FROM det.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') BETWEEN 6 AND 20
                GROUP BY det.camera_id, cd.display_name, cd.location,
                         EXTRACT(HOUR FROM det.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
                HAVING COUNT(*) >= %s
                   AND AVG(det.total_objects::float / NULLIF(COALESCE(cap.capacity_p90, 100), 0)) >= %s
            )
            SELECT cam_id, display_name, location, hour_of_day, avg_vc, stddev_vc, sample_count
            FROM hourly_load
            ORDER BY avg_vc DESC
            LIMIT 10
        """
        return self._safe_query(query, (_MIN_SAMPLES, _VC_THRESHOLD))

    def _calc_confidence(self, route: Dict) -> float:
        """
        Optimisation recommendations are derived from historical aggregates —
        more samples → more reliable pattern.
        """
        return min(
            85.0,
            self.confidence_from_samples(
                int(route.get("sample_count") or 0),
                reference=50,
                floor=30.0,
                ceiling=85.0,
            )
        )

    def _analyze_route(self, route: Dict) -> List[Dict]:
        """Generate route-change decision only (time-routing & infra need more data)"""
        decisions = []
        d = self._create_route_change_decision(route)
        if d:
            decisions.append(d)
        return decisions

    def _build_evidence(self, route: Dict, confidence: float) -> Dict:
        stddev = route.get("stddev_vc")
        return {
            "avg_vc": float(route.get("avg_vc") or 0),
            "stddev_vc": round(float(stddev), 3) if stddev is not None else None,
            "hour_of_day": int(float(route.get("hour_of_day") or 0)),
            "sample_count": int(route.get("sample_count") or 0),
            "location": route.get("location") or "",
            "capacity_basis": "p90_7d",
            "confidence_breakdown": {
                "method": "confidence_from_samples(reference=50)",
                "final": confidence,
            },
        }

    def _create_route_change_decision(self, route: Dict) -> Optional[Dict]:
        cam_id = route["cam_id"]
        name = route.get("display_name") or cam_id
        avg_vc = float(route.get("avg_vc") or 0)
        hour = int(float(route.get("hour_of_day") or 0))
        samples = int(route.get("sample_count") or 0)
        confidence = self._calc_confidence(route)

        stddev = route.get("stddev_vc")
        consistency_note = ""
        if stddev is not None:
            stddev_f = float(stddev)
            if stddev_f < 0.10:
                consistency_note = " Tải cao nhất quán (độ lệch chuẩn thấp) — phù hợp tối ưu định kỳ."
            else:
                consistency_note = f" Tải dao động (σ={stddev_f:.2f}) — có thể do sự kiện không thường xuyên."

        return self._create_decision(
            category="optimization",
            title=f"Tối ưu hoá chu kỳ đèn giờ cao điểm tại {name}",
            recommendation=(
                f"Camera {name} có V/C trung bình {avg_vc:.0%} trong khung "
                f"{hour:02d}:00-{hour+1:02d}:00 (7 ngày qua, {samples} mẫu). "
                "Xem xét điều chỉnh chu kỳ đèn cho khung giờ này."
            ),
            rationale=(
                f"Tải cao kéo dài {avg_vc:.0%} lúc {hour:02d}:00 là tín hiệu "
                "cần tối ưu lại pha đèn hoặc tăng cường biện pháp phân luồng."
                f"{consistency_note}"
            ),
            score_impact=65,
            score_confidence=confidence,
            score_urgency=40,
            camera_ids=[cam_id],
            evidence=self._build_evidence(route, confidence),
            action_items=[
                {"action": f"Phân tích chi tiết lưu lượng khung {hour:02d}:00-{hour+1:02d}:00", "actor": "technician", "timeToAction": "planned"},
                {"action": "Điều chỉnh chu kỳ đèn theo phân tích giờ cao điểm", "actor": "technician", "timeToAction": "planned"},
                {"action": "Theo dõi V/C trung bình sau khi áp dụng thay đổi", "actor": "system", "timeToAction": "planned"},
            ],
            effective_until=datetime.now() + timedelta(days=7),
        )
