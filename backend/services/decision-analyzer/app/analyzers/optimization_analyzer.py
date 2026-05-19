"""
Route Optimization Analyzer
Identifies route performance gaps and recommends route changes
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)


class OptimizationAnalyzer(BaseAnalyzer):
    """Analyzes route performance and recommends optimizations"""

    async def analyze(self) -> List[Dict]:
        """
        Analyze route optimization opportunities:
        1. Compare alternate route performance (historical data)
        2. Identify persistent bottlenecks
        3. Detect time-dependent routing opportunities
        4. Generate infrastructure/routing recommendations
        """
        try:
            decisions = []
            
            # Get routes with performance issues
            problem_routes = self._get_problem_routes()
            
            if not problem_routes:
                logger.info(f"[{self.name}] No route optimization opportunities detected")
                return []
            
            logger.info(f"[{self.name}] Found {len(problem_routes)} route issues")
            
            # Generate optimization decisions
            for route in problem_routes:
                route_decisions = self._analyze_route(route)
                decisions.extend(route_decisions)
            
            logger.info(f"[{self.name}] Generated {len(decisions)} decisions")
            return decisions
            
        except Exception as e:
            logger.error(f"[{self.name}] Analysis failed: {e}", exc_info=True)
            return []

    def _get_problem_routes(self) -> List[Dict]:
        """Lấy các camera có tải cao liên tục trong giờ cao điểm (7 ngày qua)"""
        query = """
            WITH capacity_calc AS (
                SELECT
                    camera_id,
                    MAX(total_objects) AS capacity_7d
                FROM camera_detections
                WHERE created_at > NOW() - INTERVAL '7 days'
                GROUP BY camera_id
            ),
            peak_load AS (
                SELECT
                    det.camera_id AS cam_id,
                    cd.display_name,
                    cd.location,
                    EXTRACT(HOUR FROM det.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS hour_of_day,
                    ROUND(
                        AVG(det.total_objects::float / NULLIF(COALESCE(cap.capacity_7d, 100), 0))::numeric,
                        3
                    ) AS avg_vc,
                    COUNT(*) AS sample_count
                FROM camera_detections det
                LEFT JOIN camera_data cd ON det.camera_id = cd.cam_id
                LEFT JOIN capacity_calc cap ON det.camera_id = cap.camera_id
                WHERE det.created_at > NOW() - INTERVAL '7 days'
                  AND EXTRACT(HOUR FROM det.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') BETWEEN 6 AND 20
                GROUP BY det.camera_id, cd.display_name, cd.location,
                         EXTRACT(HOUR FROM det.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
                HAVING COUNT(*) >= 10
                   AND AVG(det.total_objects::float / NULLIF(COALESCE(cap.capacity_7d, 100), 0)) >= 0.4
            )
            SELECT cam_id, display_name, location, hour_of_day, avg_vc, sample_count
            FROM peak_load
            ORDER BY avg_vc DESC
            LIMIT 10
        """
        return self._safe_query(query)

    def _analyze_route(self, route: Dict) -> List[Dict]:
        """Generate decisions for a specific route problem"""
        decisions = []
        
        # Decision 1: Change default route recommendation
        route_change_decision = self._create_route_change_decision(route)
        if route_change_decision:
            decisions.append(route_change_decision)
        
        # Decision 2: Create time-dependent route
        time_routing_decision = self._create_time_routing_decision(route)
        if time_routing_decision:
            decisions.append(time_routing_decision)
        
        # Decision 3: Recommend infrastructure improvement
        infra_decision = self._create_infrastructure_decision(route)
        if infra_decision:
            decisions.append(infra_decision)
        
        return decisions

    def _create_route_change_decision(self, route: Dict) -> Optional[Dict]:
        """Đề xuất tối ưu hoá chu kỳ đèn tín hiệu dựa trên mô hình tải cao lịch sử"""
        cam_id = route["cam_id"]
        name = route.get("display_name") or cam_id
        avg_vc = float(route.get("avg_vc") or 0)
        hour = int(float(route.get("hour_of_day") or 0))

        return self._create_decision(
            category="optimization",
            title=f"Tối ưu hoá chu kỳ đèn giờ cao điểm tại {name}",
            recommendation=(
                f"Camera {name} có V/C trung bình {avg_vc:.0%} trong khung "
                f"{hour:02d}:00-{hour+1:02d}:00 (7 ngày qua). "
                "Xem xét điều chỉnh chu kỳ đèn cho khung giờ này."
            ),
            rationale=(
                f"Tải cao kéo dài {avg_vc:.0%} trong giờ {hour:02d}:00 là tín hiệu "
                "cần tối ưu lại pha đèn hoặc tăng cường biện pháp phân luồng."
            ),
            score_impact=65,
            score_confidence=80,
            score_urgency=40,
            camera_ids=[cam_id],
            evidence={
                "avg_vc": avg_vc,
                "hour_of_day": hour,
                "sample_count": int(route.get("sample_count") or 0),
                "location": route.get("location") or "",
            },
            action_items=[
                {"action": f"Phân tích chi tiết lưu lượng khung {hour:02d}:00-{hour+1:02d}:00", "actor": "technician", "timeToAction": "planned"},
                {"action": "Điều chỉnh chu kỳ đèn theo phân tích giờ cao điểm", "actor": "technician", "timeToAction": "planned"},
                {"action": "Theo dõi V/C trung bình sau khi áp dụng thay đổi", "actor": "system", "timeToAction": "planned"},
            ],
            effective_until=datetime.now() + timedelta(days=7),
        )

    def _create_time_routing_decision(self, route: Dict) -> Optional[Dict]:
        """Tuyến định tuyến theo giờ – bỏ qua khi chưa có dữ liệu tuyến đường"""
        return None

    def _create_infrastructure_decision(self, route: Dict) -> Optional[Dict]:
        """Đề xuất cải tạo hạ tầng – bỏ qua khi chưa có baseline chi phí"""
        return None
