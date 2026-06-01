"""
Predictive Intervention Analyzer
Identifies potential future issues from forecast data and recommends proactive interventions

Confidence model
────────────────
  confidence = blend(
      confidence_from_samples(input_sample_count, reference=30),  weight=0.6
      horizon_penalty,                                             weight=0.4
  )

  horizon_penalty: longer forecasts are less reliable.
    ≤ 15 min  →  80
    30 min    →  65
    60 min    →  50

  Hard rule: if input_sample_count < MIN_SAMPLES (5) → suppress decision.
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)

_MIN_INPUT_SAMPLES = 5
_VC_THRESHOLD = 0.75


def _horizon_confidence(horizon_minutes: int) -> float:
    """Longer forecast horizons carry inherently lower confidence."""
    if horizon_minutes <= 15:
        return 80.0
    if horizon_minutes <= 30:
        return 65.0
    return 50.0


class PredictiveAnalyzer(BaseAnalyzer):
    """Analyzes forecast data to predict and prevent issues before they occur"""

    async def analyze(self) -> List[Dict]:
        try:
            decisions = []
            upcoming_congestion = self._get_upcoming_congestion()

            if not upcoming_congestion:
                logger.info(f"[{self.name}] No upcoming congestion detected")
                return []

            logger.info(f"[{self.name}] Found {len(upcoming_congestion)} potential issues")

            for forecast in upcoming_congestion:
                cam_decisions = self._analyze_forecast_issue(forecast)
                decisions.extend(cam_decisions)

            logger.info(f"[{self.name}] Generated {len(decisions)} decisions")
            return decisions

        except Exception as e:
            logger.error(f"[{self.name}] Analysis failed: {e}", exc_info=True)
            return []

    def _get_upcoming_congestion(self) -> List[Dict]:
        """
        Get forecasts predicting congestion (V/C >= 0.75) in next 10-60 minutes.

        Only includes rows with sufficient input_sample_count so that downstream
        confidence calculation has real data to work with.
        Also fetches model_error_rate (avg MAPE for this camera over last 24h) to
        penalise cameras with historically poor model accuracy.
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
            model_quality AS (
                -- Recent MAPE per camera (last 24h) as a model reliability signal
                SELECT
                    camera_id,
                    AVG(
                        CASE WHEN actual_value > 0
                        THEN ABS(actual_value - predicted_value) / actual_value * 100
                        ELSE NULL END
                    ) AS recent_mape
                FROM camera_forecasts
                WHERE actual_value IS NOT NULL
                  AND forecast_for_time > NOW() - INTERVAL '24 hours'
                GROUP BY camera_id
            )
            SELECT
                cf.camera_id                                         AS cam_id,
                cd.display_name,
                cd.location,
                cf.forecast_for_time,
                cf.horizon_minutes,
                cf.predicted_value,
                cf.input_value,
                cf.input_sample_count,
                COALESCE(cap.capacity_p90, 100)                      AS capacity,
                COALESCE(mq.recent_mape, NULL)                       AS model_mape,
                ROUND(
                    (cf.predicted_value / NULLIF(COALESCE(cap.capacity_p90, 100), 0))::numeric, 3
                )                                                    AS predicted_vc,
                CASE
                    WHEN cf.predicted_value / NULLIF(COALESCE(cap.capacity_p90, 100), 0) >= 1.0
                    THEN 'congested'
                    ELSE 'heavy'
                END                                                  AS predicted_status
            FROM camera_forecasts cf
            LEFT JOIN camera_data cd        ON cf.camera_id = cd.cam_id
            LEFT JOIN capacity_calc cap     ON cf.camera_id = cap.camera_id
            LEFT JOIN model_quality mq      ON cf.camera_id = mq.camera_id
            WHERE cf.forecast_for_time BETWEEN NOW() AND NOW() + INTERVAL '60 minutes'
              AND cf.horizon_minutes BETWEEN 10 AND 60
              AND cf.input_sample_count >= %s
              AND cf.predicted_value / NULLIF(COALESCE(cap.capacity_p90, 100), 0) >= %s
            ORDER BY predicted_vc DESC
            LIMIT 15
        """
        return self._safe_query(query, (_MIN_INPUT_SAMPLES, _VC_THRESHOLD))

    def _calc_confidence(self, forecast: Dict) -> float:
        """
        Blend sample-based confidence with horizon penalty and model quality.
        If the camera has a known recent MAPE, penalise proportionally.
        """
        samples = int(forecast.get("input_sample_count") or 0)
        horizon = int(forecast.get("horizon_minutes") or 60)
        model_mape = forecast.get("model_mape")  # may be None if no actuals yet

        c_samples = self.confidence_from_samples(samples, reference=30, floor=20.0, ceiling=85.0)
        c_horizon = _horizon_confidence(horizon)

        blended = self.blend_confidence(c_samples, c_horizon, weights=[0.6, 0.4])

        # Penalise for poor model accuracy: each 10% MAPE above 20% costs 5 confidence pts
        if model_mape is not None:
            excess_mape = max(0.0, float(model_mape) - 20.0)
            penalty = (excess_mape / 10.0) * 5.0
            blended = max(15.0, blended - penalty)

        return round(min(85.0, blended), 1)

    def _analyze_forecast_issue(self, forecast: Dict) -> List[Dict]:
        """Generate ONE decision per forecasted issue based on horizon urgency"""
        horizon = int(forecast.get("horizon_minutes") or 60)
        if horizon <= 15:
            d = self._create_preclear_decision(forecast)
        else:
            d = self._create_reroute_decision(forecast)
        return [d] if d else []

    def _build_evidence(self, forecast: Dict, confidence: float) -> Dict:
        model_mape = forecast.get("model_mape")
        return {
            "predicted_vc": float(forecast.get("predicted_vc") or 0),
            "horizon_minutes": int(forecast.get("horizon_minutes") or 0),
            "forecast_for_time": str(forecast.get("forecast_for_time") or ""),
            "input_value": forecast.get("input_value"),
            "input_sample_count": int(forecast.get("input_sample_count") or 0),
            "capacity_p90": float(forecast.get("capacity") or 0),
            "model_mape_24h": round(float(model_mape), 1) if model_mape is not None else None,
            "confidence_breakdown": {
                "method": "blend(samples=0.6, horizon=0.4) − mape_penalty",
                "final": confidence,
            },
        }

    def _create_preclear_decision(self, forecast: Dict) -> Optional[Dict]:
        horizon = int(forecast.get("horizon_minutes") or 60)
        if horizon > 15:
            return None
        vc = float(forecast.get("predicted_vc") or 0)
        cam_id = forecast["cam_id"]
        name = forecast.get("display_name") or cam_id
        confidence = self._calc_confidence(forecast)
        samples = int(forecast.get("input_sample_count") or 0)
        mape = forecast.get("model_mape")

        mape_note = (
            f" (Độ chính xác mô hình gần đây: MAPE = {float(mape):.1f}%)"
            if mape is not None else " (Chưa có dữ liệu đánh giá độ chính xác mô hình)"
        )

        return self._create_decision(
            category="predictive",
            title=f"Chuẩn bị giải phóng nút giao {name}",
            recommendation=(
                f"Dự báo V/C = {vc:.0%} tại {name} trong {horizon} phút tới. "
                "Kích hoạt trước biện pháp giải toả."
            ),
            rationale=(
                f"Dự báo ngắn hạn {horizon} phút dựa trên {samples} mẫu đầu vào.{mape_note} "
                "Hành động sớm giúp ngăn leo thang."
            ),
            score_impact=70,
            score_confidence=confidence,
            score_urgency=max(80, 100 - horizon * 2),
            camera_ids=[cam_id],
            evidence=self._build_evidence(forecast, confidence),
            action_items=[
                {"action": f"Kích hoạt điều hướng sớm tại {name}", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Thông báo VMS trên tuyến tiếp cận", "actor": "system", "timeToAction": "immediate"},
                {"action": "Theo dõi liên tục trong 15 phút tới", "actor": "technician", "timeToAction": "soon"},
            ],
            effective_until=datetime.now() + timedelta(minutes=horizon + 30),
        )

    def _create_reroute_decision(self, forecast: Dict) -> Optional[Dict]:
        horizon = int(forecast.get("horizon_minutes") or 60)
        if horizon <= 15:
            return None
        vc = float(forecast.get("predicted_vc") or 0)
        cam_id = forecast["cam_id"]
        name = forecast.get("display_name") or cam_id
        confidence = self._calc_confidence(forecast)
        samples = int(forecast.get("input_sample_count") or 0)
        mape = forecast.get("model_mape")

        mape_note = (
            f" MAPE gần đây = {float(mape):.1f}%."
            if mape is not None else ""
        )

        return self._create_decision(
            category="predictive",
            title=f"Lập kế hoạch phân luồng trước cho {name}",
            recommendation=(
                f"Dự báo V/C = {vc:.0%} tại {name} trong {horizon} phút. "
                "Chuẩn bị phương án phân luồng."
            ),
            rationale=(
                f"Dự báo {horizon} phút dựa trên {samples} mẫu đầu vào.{mape_note} "
                "Còn đủ thời gian chuẩn bị — phân luồng chủ động hiệu quả hơn xử lý khi đã tắc."
            ),
            score_impact=60,
            score_confidence=confidence,
            score_urgency=50,
            camera_ids=[cam_id],
            evidence=self._build_evidence(forecast, confidence),
            action_items=[
                {"action": "Xác nhận lịch và năng lực tuyến thay thế", "actor": "technician", "timeToAction": "soon"},
                {"action": "Chuẩn bị VMS và biển báo dự phòng", "actor": "technician", "timeToAction": "soon"},
                {"action": f"Kích hoạt khi còn {horizon // 2} phút trước giờ dự báo", "actor": "technician", "timeToAction": "planned"},
            ],
            effective_until=datetime.now() + timedelta(minutes=horizon + 60),
        )
