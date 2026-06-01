"""
Congestion Management Analyzer
Detects heavy/congested traffic situations and recommends interventions

Confidence model
────────────────
  confidence = blend(
      confidence_from_samples(sample_count, reference=20),   weight=0.5
      confidence_from_recency(minutes_since_update),          weight=0.5
  )
  capped at 90 — we never claim full certainty about real-world traffic.
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)

# V/C thresholds
_VC_MODERATE = 0.75
_VC_HEAVY = 0.85
_VC_SEVERE = 1.0

# We need at least this many recent samples to trust the current status
_MIN_SAMPLES_CONGESTION = 3


class CongestionAnalyzer(BaseAnalyzer):
    """Analyzes traffic congestion patterns and generates intervention recommendations"""

    async def analyze(self) -> List[Dict]:
        """
        Analyze congestion situations:
        1. Find cameras with heavy/congested status with sufficient recent data
        2. Calculate data-driven confidence (recency + sample count)
        3. Generate recommendations — skip if confidence too low
        """
        try:
            decisions = []
            congested_cams = self._get_congested_cameras()

            if not congested_cams:
                logger.info(f"[{self.name}] No congestion detected")
                return []

            logger.info(f"[{self.name}] Found {len(congested_cams)} congested cameras")

            for cam in congested_cams:
                cam_decisions = self._analyze_camera_congestion(cam)
                decisions.extend(cam_decisions)

            logger.info(f"[{self.name}] Generated {len(decisions)} decisions")
            return decisions

        except Exception as e:
            logger.error(f"[{self.name}] Analysis failed: {e}", exc_info=True)
            return []

    def _get_congested_cameras(self) -> List[Dict]:
        """
        Get cameras currently in heavy/congested status (V/C >= 0.75).

        Capacity is estimated as the 90th-percentile vehicle count over 7 days
        (instead of the naive MAX) to avoid outlier spikes inflating capacity and
        artificially deflating the V/C ratio.

        Also returns:
          - recent_sample_count: number of detections in the last 10 minutes
          - minutes_since_update: staleness of the latest reading
          - stddev_7d: spread of historical counts (used to judge confidence)
        """
        query = """
            WITH capacity_calc AS (
                -- 90th-percentile as capacity baseline — robust against outliers
                SELECT
                    camera_id,
                    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_objects) AS capacity_p90,
                    STDDEV(total_objects) AS stddev_7d,
                    COUNT(*) AS hist_sample_count
                FROM camera_detections
                WHERE created_at > NOW() - INTERVAL '7 days'
                GROUP BY camera_id
                HAVING COUNT(*) >= 10          -- need at least 10 pts for a reliable p90
            ),
            recent_window AS (
                SELECT
                    camera_id,
                    MAX(total_objects)    AS latest_objects,
                    MAX(created_at)       AS latest_at,
                    COUNT(*)              AS recent_sample_count
                FROM camera_detections
                WHERE created_at > NOW() - INTERVAL '10 minutes'
                GROUP BY camera_id
            )
            SELECT
                rw.camera_id                                  AS cam_id,
                cd.display_name,
                cd.location,
                rw.latest_objects                             AS total_objects,
                rw.latest_at                                  AS updated_at,
                rw.recent_sample_count,
                EXTRACT(EPOCH FROM (NOW() - rw.latest_at)) / 60
                                                              AS minutes_since_update,
                COALESCE(cap.capacity_p90, 100)               AS capacity,
                COALESCE(cap.stddev_7d, 0)                    AS stddev_7d,
                COALESCE(cap.hist_sample_count, 0)            AS hist_sample_count,
                ROUND(
                    (rw.latest_objects::numeric /
                     NULLIF(COALESCE(cap.capacity_p90, 100), 0))::numeric, 3
                )                                             AS vc_ratio,
                CASE
                    WHEN rw.latest_objects::float /
                         NULLIF(COALESCE(cap.capacity_p90, 100), 0) >= 1.0
                    THEN 'congested'
                    ELSE 'heavy'
                END                                           AS status_current
            FROM recent_window rw
            LEFT JOIN camera_data cd      ON rw.camera_id = cd.cam_id
            LEFT JOIN capacity_calc cap   ON rw.camera_id = cap.camera_id
            WHERE
                rw.recent_sample_count >= %s
                AND rw.latest_objects::float /
                    NULLIF(COALESCE(cap.capacity_p90, 100), 0) >= %s
            ORDER BY vc_ratio DESC
        """
        return self._safe_query(query, (_MIN_SAMPLES_CONGESTION, _VC_MODERATE))

    def _calc_confidence(self, camera: Dict) -> float:
        """
        Blend two independent confidence signals:
          • recency  — how fresh is the latest reading?
          • samples  — how many observations back this up?
        Cap at 90 to express irreducible real-world uncertainty.
        """
        minutes = float(camera.get("minutes_since_update") or 999)
        recent_samples = int(camera.get("recent_sample_count") or 0)

        c_recency = self.confidence_from_recency(
            minutes,
            fresh_threshold=2.0,
            stale_threshold=15.0,
            floor=15.0,
            ceiling=90.0,
        )
        c_samples = self.confidence_from_samples(
            recent_samples,
            reference=10,
            floor=15.0,
            ceiling=90.0,
        )
        return min(90.0, self.blend_confidence(c_recency, c_samples, weights=[0.5, 0.5]))

    def _analyze_camera_congestion(self, camera: Dict) -> List[Dict]:
        """Generate ONE highest-priority decision per congested camera"""
        vc = float(camera.get("vc_ratio") or 0)
        confidence = self._calc_confidence(camera)

        if vc >= _VC_SEVERE:
            d = self._create_deploy_police_decision(camera, confidence)
        elif vc >= _VC_HEAVY:
            d = self._create_signal_timing_decision(camera, confidence)
        else:
            d = self._create_alternate_route_decision(camera, confidence)

        return [d] if d else []

    # ── Decision builders ──────────────────────────────────────────────────

    def _build_evidence(self, camera: Dict, confidence: float) -> Dict:
        return {
            "vc_ratio": float(camera.get("vc_ratio") or 0),
            "total_objects": camera.get("total_objects"),
            "capacity_p90": camera.get("capacity"),
            "stddev_7d": float(camera.get("stddev_7d") or 0),
            "recent_sample_count": int(camera.get("recent_sample_count") or 0),
            "hist_sample_count": int(camera.get("hist_sample_count") or 0),
            "minutes_since_update": float(camera.get("minutes_since_update") or 0),
            "status": camera.get("status_current"),
            "confidence_breakdown": {
                "method": "blend(recency=0.5, samples=0.5)",
                "final": confidence,
            },
        }

    def _create_alternate_route_decision(self, camera: Dict, confidence: float) -> Optional[Dict]:
        vc = float(camera.get("vc_ratio") or 0)
        cam_id = camera["cam_id"]
        name = camera.get("display_name") or cam_id
        loc = camera.get("location") or ""

        return self._create_decision(
            category="congestion",
            title=f"Kích hoạt tuyến thay thế tại {name}",
            recommendation=(
                f"Chuyển hướng phương tiện khỏi {name} ({loc}) sang tuyến thay thế "
                f"để giảm tải V/C = {vc:.0%}."
            ),
            rationale=(
                f"V/C hiện tại {vc:.0%} vượt ngưỡng tải nặng ({_VC_MODERATE:.0%}). "
                f"Dựa trên {int(camera.get('recent_sample_count') or 0)} lần quan sát "
                f"trong 10 phút qua (dữ liệu cách đây "
                f"{float(camera.get('minutes_since_update') or 0):.1f} phút)."
            ),
            score_impact=min(90, int(vc * 100)),
            score_confidence=confidence,
            score_urgency=min(85, int(vc * 95)),
            camera_ids=[cam_id],
            evidence=self._build_evidence(camera, confidence),
            action_items=[
                {"action": "Kích hoạt biển điều hướng tuyến thay thế", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Thông báo qua hệ thống VMS", "actor": "system", "timeToAction": "immediate"},
                {"action": "Theo dõi tải trọng tuyến thay thế", "actor": "technician", "timeToAction": "soon"},
            ],
            effective_until=datetime.now() + timedelta(hours=2),
        )

    def _create_signal_timing_decision(self, camera: Dict, confidence: float) -> Optional[Dict]:
        vc = float(camera.get("vc_ratio") or 0)
        if vc < _VC_HEAVY:
            return None
        cam_id = camera["cam_id"]
        name = camera.get("display_name") or cam_id

        return self._create_decision(
            category="congestion",
            title=f"Điều chỉnh chu kỳ đèn tín hiệu tại {name}",
            recommendation=f"Tăng thời gian pha xanh 20-30% cho hướng tắc nghẽn tại {name}.",
            rationale=(
                f"V/C = {vc:.0%} (≥ {_VC_HEAVY:.0%}). "
                f"Bằng chứng từ {int(camera.get('recent_sample_count') or 0)} mẫu "
                f"trong 10 phút qua, cập nhật cách đây "
                f"{float(camera.get('minutes_since_update') or 0):.1f} phút."
            ),
            score_impact=75,
            score_confidence=confidence,
            score_urgency=90,
            camera_ids=[cam_id],
            evidence=self._build_evidence(camera, confidence),
            action_items=[
                {"action": "Liên hệ trung tâm điều hành đèn tín hiệu", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Tăng pha xanh hướng tải cao lên 20-30%", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Đánh giá hiệu quả sau 15 phút", "actor": "technician", "timeToAction": "soon"},
            ],
            effective_until=datetime.now() + timedelta(hours=1),
        )

    def _create_deploy_police_decision(self, camera: Dict, confidence: float) -> Optional[Dict]:
        vc = float(camera.get("vc_ratio") or 0)
        if vc < _VC_SEVERE:
            return None
        cam_id = camera["cam_id"]
        name = camera.get("display_name") or cam_id
        loc = camera.get("location") or ""

        return self._create_decision(
            category="congestion",
            title=f"Triển khai CSGT tại {name}",
            recommendation=f"Điều lực lượng CSGT đến {name} ({loc}) để phân luồng trực tiếp.",
            rationale=(
                f"V/C = {vc:.0%} vượt ngưỡng ùn tắc nghiêm trọng (≥ {_VC_SEVERE:.0%}). "
                f"Dựa trên {int(camera.get('recent_sample_count') or 0)} quan sát "
                f"gần nhất (cập nhật {float(camera.get('minutes_since_update') or 0):.1f} phút trước). "
                "Cần can thiệp thủ công ngay."
            ),
            score_impact=95,
            score_confidence=confidence,
            score_urgency=98,
            camera_ids=[cam_id],
            evidence=self._build_evidence(camera, confidence),
            action_items=[
                {"action": "Liên hệ đội CSGT trực ca", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Triển khai 2-3 CSGT tại điểm ùn tắc", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Hỗ trợ điều hướng theo hiện trường", "actor": "technician", "timeToAction": "immediate"},
            ],
            effective_until=datetime.now() + timedelta(hours=3),
        )
