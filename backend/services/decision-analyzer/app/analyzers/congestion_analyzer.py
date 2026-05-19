"""
Congestion Management Analyzer
Detects heavy/congested traffic situations and recommends interventions
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)


class CongestionAnalyzer(BaseAnalyzer):
    """Analyzes traffic congestion patterns and generates intervention recommendations"""

    async def analyze(self) -> List[Dict]:
        """
        Analyze congestion situations:
        1. Find cameras with heavy/congested status lasting >10 min
        2. Check forecast for continuation
        3. Identify route alternatives
        4. Generate recommendations (activate alt route, adjust signals, deploy police)
        """
        try:
            decisions = []
            
            # Get currently congested cameras (LOS: heavy or congested)
            congested_cams = self._get_congested_cameras()
            
            if not congested_cams:
                logger.info(f"[{self.name}] No congestion detected")
                return []
            
            logger.info(f"[{self.name}] Found {len(congested_cams)} congested cameras")
            
            # For each congestion situation, generate decisions
            for cam in congested_cams:
                cam_decisions = self._analyze_camera_congestion(cam)
                decisions.extend(cam_decisions)
            
            logger.info(f"[{self.name}] Generated {len(decisions)} decisions")
            return decisions
            
        except Exception as e:
            logger.error(f"[{self.name}] Analysis failed: {e}", exc_info=True)
            return []

    def _get_congested_cameras(self) -> List[Dict]:
        """Get cameras currently in heavy/congested status (V/C >= 0.85)"""
        query = """
            WITH latest_detection AS (
                SELECT
                    camera_id,
                    total_objects,
                    created_at,
                    ROW_NUMBER() OVER (PARTITION BY camera_id ORDER BY created_at DESC) AS rn
                FROM camera_detections
                WHERE created_at > NOW() - INTERVAL '10 minutes'
            ),
            capacity_calc AS (
                SELECT
                    camera_id,
                    MAX(total_objects) AS capacity_7d
                FROM camera_detections
                WHERE created_at > NOW() - INTERVAL '7 days'
                GROUP BY camera_id
            )
            SELECT
                ld.camera_id AS cam_id,
                cd.display_name,
                cd.location,
                ld.total_objects,
                ld.created_at AS updated_at,
                COALESCE(cap.capacity_7d, 100) AS capacity,
                ROUND(
                    (ld.total_objects::numeric / NULLIF(COALESCE(cap.capacity_7d, 100), 0))::numeric, 3
                ) AS vc_ratio,
                CASE
                    WHEN ld.total_objects::float / NULLIF(COALESCE(cap.capacity_7d, 100), 0) >= 1.0 THEN 'congested'
                    ELSE 'heavy'
                END AS status_current
            FROM latest_detection ld
            LEFT JOIN camera_data cd ON ld.camera_id = cd.cam_id
            LEFT JOIN capacity_calc cap ON ld.camera_id = cap.camera_id
            WHERE ld.rn = 1
              AND ld.total_objects::float / NULLIF(COALESCE(cap.capacity_7d, 100), 0) >= 0.75
            ORDER BY vc_ratio DESC
        """
        return self._safe_query(query)

    def _analyze_camera_congestion(self, camera: Dict) -> List[Dict]:
        """Generate ONE highest-priority decision per congested camera"""
        vc = float(camera.get("vc_ratio") or 0)
        # Severe: V/C >= 1.0 → deploy police (highest priority)
        if vc >= 1.0:
            d = self._create_deploy_police_decision(camera)
            return [d] if d else []
        # Heavy: V/C >= 0.85 → adjust signal timing
        if vc >= 0.85:
            d = self._create_signal_timing_decision(camera)
            return [d] if d else []
        # Moderate: V/C >= 0.75 → activate alternate route
        d = self._create_alternate_route_decision(camera)
        return [d] if d else []

    def _create_alternate_route_decision(self, camera: Dict) -> Optional[Dict]:
        """Khuyến nghị kích hoạt tuyến đường thay thế khi tải cao"""
        vc = float(camera.get("vc_ratio") or 0)
        cam_id = camera["cam_id"]
        name = camera.get("display_name") or cam_id
        loc = camera.get("location") or ""

        return self._create_decision(
            category="congestion",
            title=f"Kích hoạt tuyến thay thế tại {name}",
            recommendation=f"Chuyển hướng phương tiện khỏi {name} ({loc}) sang tuyến thay thế để giảm tải V/C = {vc:.0%}.",
            rationale=f"Tỉ lệ V/C hiện tại {vc:.0%} vượt ngưỡng tải nặng. Kích hoạt biển báo điều hướng giảm áp lực nút giao.",
            score_impact=min(90, int(vc * 100)),
            score_confidence=75,
            score_urgency=min(85, int(vc * 95)),
            camera_ids=[cam_id],
            evidence={
                "vc_ratio": vc,
                "total_objects": camera.get("total_objects"),
                "capacity": camera.get("capacity"),
                "status": camera.get("status_current"),
            },
            action_items=[
                {"action": "Kích hoạt biển điều hướng tuyến thay thế", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Thông báo qua hệ thống VMS", "actor": "system", "timeToAction": "immediate"},
                {"action": "Theo dõi tải trọng tuyến thay thế", "actor": "technician", "timeToAction": "soon"},
            ],
            effective_until=datetime.now() + timedelta(hours=2),
        )

    def _create_signal_timing_decision(self, camera: Dict) -> Optional[Dict]:
        """Điều chỉnh chu kỳ đèn tín hiệu khi V/C >= 0.85"""
        vc = float(camera.get("vc_ratio") or 0)
        if vc < 0.85:
            return None
        cam_id = camera["cam_id"]
        name = camera.get("display_name") or cam_id

        return self._create_decision(
            category="congestion",
            title=f"Điều chỉnh chu kỳ đèn tín hiệu tại {name}",
            recommendation=f"Tăng thời gian pha xanh 20-30% cho hướng tắc nghẽn tại {name}.",
            rationale=f"V/C = {vc:.0%}. Mở rộng pha xanh hướng tắc nghẽn giúp thoát lưu lượng hiệu quả hơn.",
            score_impact=75,
            score_confidence=80,
            score_urgency=90,
            camera_ids=[cam_id],
            evidence={
                "vc_ratio": vc,
                "total_objects": camera.get("total_objects"),
                "capacity": camera.get("capacity"),
            },
            action_items=[
                {"action": "Liên hệ trung tâm điều hành đèn tín hiệu", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Tăng pha xanh hướng tải cao lên 20-30%", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Đánh giá hiệu quả sau 15 phút", "actor": "technician", "timeToAction": "soon"},
            ],
            effective_until=datetime.now() + timedelta(hours=1),
        )

    def _create_deploy_police_decision(self, camera: Dict) -> Optional[Dict]:
        """Triển khai CSGT tại điểm ùn tắc nghiêm trọng (V/C >= 1.0)"""
        vc = float(camera.get("vc_ratio") or 0)
        if vc < 1.0:
            return None
        cam_id = camera["cam_id"]
        name = camera.get("display_name") or cam_id
        loc = camera.get("location") or ""

        return self._create_decision(
            category="congestion",
            title=f"Triển khai CSGT tại {name}",
            recommendation=f"Điều lực lượng CSGT đến {name} ({loc}) để phân luồng trực tiếp.",
            rationale=f"V/C = {vc:.0%} vượt ngưỡng ùn tắc nghiêm trọng (≥ 100%). Cần can thiệp thủ công ngay.",
            score_impact=95,
            score_confidence=85,
            score_urgency=98,
            camera_ids=[cam_id],
            evidence={
                "vc_ratio": vc,
                "total_objects": camera.get("total_objects"),
                "capacity": camera.get("capacity"),
                "status": "congested",
            },
            action_items=[
                {"action": "Liên hệ đội CSGT trực ca", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Triển khai 2-3 CSGT tại điểm ùn tắc", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Hỗ trợ điều hướng theo hiện trường", "actor": "technician", "timeToAction": "immediate"},
            ],
            effective_until=datetime.now() + timedelta(hours=3),
        )
