"""
Predictive Intervention Analyzer
Identifies potential future issues from forecast data and recommends proactive interventions
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)


class PredictiveAnalyzer(BaseAnalyzer):
    """Analyzes forecast data to predict and prevent issues before they occur"""

    async def analyze(self) -> List[Dict]:
        """
        Analyze forecast patterns:
        1. Get forecast data (5m, 10m, 15m, 30m, 60m)
        2. Identify predicted heavy/congested status in near future
        3. Calculate confidence in prediction
        4. Generate proactive recommendations (pre-clear, reroute, etc.)
        """
        try:
            decisions = []
            
            # Get forecasts showing upcoming congestion
            upcoming_congestion = self._get_upcoming_congestion()
            
            if not upcoming_congestion:
                logger.info(f"[{self.name}] No upcoming congestion detected")
                return []
            
            logger.info(f"[{self.name}] Found {len(upcoming_congestion)} potential issues")
            
            # Generate preventive decisions
            for forecast in upcoming_congestion:
                cam_decisions = self._analyze_forecast_issue(forecast)
                decisions.extend(cam_decisions)
            
            logger.info(f"[{self.name}] Generated {len(decisions)} decisions")
            return decisions
            
        except Exception as e:
            logger.error(f"[{self.name}] Analysis failed: {e}", exc_info=True)
            return []

    def _get_upcoming_congestion(self) -> List[Dict]:
        """Get forecasts predicting congestion (V/C >= 0.85) in next 10-60 minutes"""
        query = """
            WITH capacity_calc AS (
                SELECT
                    camera_id,
                    MAX(total_objects) AS capacity_7d
                FROM camera_detections
                WHERE created_at > NOW() - INTERVAL '7 days'
                GROUP BY camera_id
            )
            SELECT
                cf.camera_id AS cam_id,
                cd.display_name,
                cd.location,
                cf.forecast_for_time,
                cf.horizon_minutes,
                cf.predicted_value,
                cf.input_value,
                cf.input_sample_count,
                COALESCE(cap.capacity_7d, 100) AS capacity,
                ROUND(
                    (cf.predicted_value / NULLIF(COALESCE(cap.capacity_7d, 100), 0))::numeric, 3
                ) AS predicted_vc,
                CASE
                    WHEN cf.predicted_value / NULLIF(COALESCE(cap.capacity_7d, 100), 0) >= 1.0 THEN 'congested'
                    ELSE 'heavy'
                END AS predicted_status
            FROM camera_forecasts cf
            LEFT JOIN camera_data cd ON cf.camera_id = cd.cam_id
            LEFT JOIN capacity_calc cap ON cf.camera_id = cap.camera_id
            WHERE cf.forecast_for_time BETWEEN NOW() AND NOW() + INTERVAL '60 minutes'
              AND cf.horizon_minutes BETWEEN 10 AND 60
              AND cf.predicted_value / NULLIF(COALESCE(cap.capacity_7d, 100), 0) >= 0.75
            ORDER BY predicted_vc DESC
            LIMIT 15
        """
        return self._safe_query(query)

    def _analyze_forecast_issue(self, forecast: Dict) -> List[Dict]:
        """Generate ONE decision per forecasted issue based on horizon urgency"""
        horizon = int(forecast.get("horizon_minutes") or 60)
        # Short horizon (<= 15 min): emergency pre-clear
        if horizon <= 15:
            d = self._create_preclear_decision(forecast)
            return [d] if d else []
        # Longer horizon: planned reroute
        d = self._create_reroute_decision(forecast)
        return [d] if d else []

    def _create_preclear_decision(self, forecast: Dict) -> Optional[Dict]:
        """Chuẩn bị giải phóng nút giao khi dự báo tắc nghẽn <= 15 phút tới"""
        horizon = int(forecast.get("horizon_minutes") or 60)
        if horizon > 15:
            return None
        vc = float(forecast.get("predicted_vc") or 0)
        cam_id = forecast["cam_id"]
        name = forecast.get("display_name") or cam_id
        samples = int(forecast.get("input_sample_count") or 0)

        return self._create_decision(
            category="predictive",
            title=f"Chuẩn bị giải phóng nút giao {name}",
            recommendation=f"Dự báo V/C = {vc:.0%} tại {name} trong {horizon} phút tới. Kích hoạt trước biện pháp giải toả.",
            rationale=f"Dự báo ngắn hạn {horizon} phút cho thấy nguy cơ tắc nghẽn. Hành động sớm giúp ngăn leo thang.",
            score_impact=70,
            score_confidence=min(80, max(40, samples * 5)),
            score_urgency=max(80, 100 - horizon * 2),
            camera_ids=[cam_id],
            evidence={
                "predicted_vc": vc,
                "horizon_minutes": horizon,
                "forecast_for_time": str(forecast.get("forecast_for_time") or ""),
                "input_value": forecast.get("input_value"),
                "input_sample_count": samples,
            },
            action_items=[
                {"action": f"Kích hoạt điều hướng sớm tại {name}", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Thông báo VMS trên tuyến tiếp cận", "actor": "system", "timeToAction": "immediate"},
                {"action": "Theo dõi liên tục trong 15 phút tới", "actor": "technician", "timeToAction": "soon"},
            ],
            effective_until=datetime.now() + timedelta(minutes=horizon + 30),
        )

    def _create_reroute_decision(self, forecast: Dict) -> Optional[Dict]:
        """Lập kế hoạch phân luồng khi dự báo tắc nghẽn 30-60 phút tới"""
        horizon = int(forecast.get("horizon_minutes") or 60)
        if horizon <= 15:
            return None
        vc = float(forecast.get("predicted_vc") or 0)
        cam_id = forecast["cam_id"]
        name = forecast.get("display_name") or cam_id
        samples = int(forecast.get("input_sample_count") or 0)

        return self._create_decision(
            category="predictive",
            title=f"Lập kế hoạch phân luồng trước cho {name}",
            recommendation=f"Dự báo V/C = {vc:.0%} tại {name} trong {horizon} phút. Chuẩn bị phương án phân luồng.",
            rationale=f"Dự báo {horizon} phút tới còn đủ thời gian chuẩn bị. Phân luồng chủ động hiệu quả hơn xử lý khi đã tắc.",
            score_impact=60,
            score_confidence=min(75, max(35, samples * 4)),
            score_urgency=50,
            camera_ids=[cam_id],
            evidence={
                "predicted_vc": vc,
                "horizon_minutes": horizon,
                "forecast_for_time": str(forecast.get("forecast_for_time") or ""),
            },
            action_items=[
                {"action": "Xác nhận lịch và năng lực tuyến thay thế", "actor": "technician", "timeToAction": "soon"},
                {"action": "Chuẩn bị VMS và biển báo dự phòng", "actor": "technician", "timeToAction": "soon"},
                {"action": f"Kích hoạt khi còn {horizon // 2} phút trước giờ dự báo", "actor": "technician", "timeToAction": "planned"},
            ],
            effective_until=datetime.now() + timedelta(minutes=horizon + 60),
        )

    def _create_incident_investigation_decision(self, forecast: Dict) -> Optional[Dict]:
        """Phát hiện sự cố từ dự báo – bỏ qua khi thiếu dữ liệu lịch sử"""
        return None
