"""
Model Quality Analyzer
Monitors prediction accuracy and recommends model maintenance actions
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)


class QualityAnalyzer(BaseAnalyzer):
    """Analyzes model quality and predicts when retraining is needed"""

    async def analyze(self) -> List[Dict]:
        """
        Analyze model quality:
        1. Check MAPE (Mean Absolute Percentage Error) per camera
        2. Identify degraded models (MAPE > threshold)
        3. Check data quality (sample counts)
        4. Generate retraining/investigation recommendations
        """
        try:
            decisions = []
            
            # Get model quality metrics
            quality_issues = self._get_quality_issues()
            
            if not quality_issues:
                logger.info(f"[{self.name}] Model quality is acceptable")
                return []
            
            logger.info(f"[{self.name}] Found {len(quality_issues)} quality issues")
            
            # Generate quality improvement decisions
            for issue in quality_issues:
                issue_decisions = self._analyze_quality_issue(issue)
                decisions.extend(issue_decisions)
            
            logger.info(f"[{self.name}] Generated {len(decisions)} decisions")
            return decisions
            
        except Exception as e:
            logger.error(f"[{self.name}] Analysis failed: {e}", exc_info=True)
            return []

    def _get_quality_issues(self) -> List[Dict]:
        """Get cameras with high MAPE (>25%) or low sample count in last 24h"""
        query = """
            SELECT
                cf.camera_id AS cam_id,
                cd.display_name,
                cd.location,
                COUNT(*) AS sample_count,
                AVG(
                    CASE WHEN cf.actual_value > 0
                    THEN ABS(cf.actual_value - cf.predicted_value) / cf.actual_value * 100
                    ELSE NULL END
                ) AS mape,
                SQRT(AVG(POWER(cf.actual_value - cf.predicted_value, 2))) AS rmse,
                AVG(cf.input_sample_count) AS avg_input_samples
            FROM camera_forecasts cf
            LEFT JOIN camera_data cd ON cf.camera_id = cd.cam_id
            WHERE cf.actual_value IS NOT NULL
              AND cf.forecast_for_time > NOW() - INTERVAL '24 hours'
            GROUP BY cf.camera_id, cd.display_name, cd.location
            HAVING COUNT(*) >= 3
              AND (
                AVG(
                    CASE WHEN cf.actual_value > 0
                    THEN ABS(cf.actual_value - cf.predicted_value) / cf.actual_value * 100
                    ELSE NULL END
                ) > 25
                OR AVG(cf.input_sample_count) < 10
              )
            ORDER BY mape DESC NULLS LAST
            LIMIT 20
        """
        return self._safe_query(query)

    def _analyze_quality_issue(self, issue: Dict) -> List[Dict]:
        """Generate ONE decision per quality issue: MAPE issue takes precedence over low-sample"""
        mape = float(issue.get("mape") or 0)
        avg_samples = float(issue.get("avg_input_samples") or 0)
        # MAPE-based decision has higher priority
        if mape >= 30:
            d = self._create_retrain_decision(issue)
            return [d] if d else []
        # Low sample count
        if avg_samples < 10:
            d = self._create_data_quality_decision(issue)
            return [d] if d else []
        return []

    def _create_retrain_decision(self, issue: Dict) -> Optional[Dict]:
        """Khuyến nghị huấn luyện lại mô hình khi MAPE > 30%"""
        mape = float(issue.get("mape") or 0)
        if mape < 30:
            return None
        cam_id = issue["cam_id"]
        name = issue.get("display_name") or cam_id

        return self._create_decision(
            category="quality",
            title=f"Huấn luyện lại mô hình dự báo cho {name}",
            recommendation=f"MAPE = {mape:.1f}% vượt ngưỡng. Khởi động quy trình huấn luyện lại mô hình.",
            rationale=f"Sai số dự báo trung bình {mape:.1f}% trong 24 giờ qua. Mô hình cần được cập nhật dữ liệu mới.",
            score_impact=70,
            score_confidence=85,
            score_urgency=60,
            camera_ids=[cam_id],
            evidence={
                "mape": mape,
                "rmse": float(issue.get("rmse") or 0),
                "sample_count": int(issue.get("sample_count") or 0),
            },
            action_items=[
                {"action": "Kiểm tra pipeline dữ liệu huấn luyện", "actor": "technician", "timeToAction": "soon"},
                {"action": "Kích hoạt job huấn luyện lại qua giao diện Models", "actor": "technician", "timeToAction": "planned"},
                {"action": "Đánh giá MAPE sau khi deploy model mới", "actor": "system", "timeToAction": "planned"},
            ],
            effective_until=datetime.now() + timedelta(days=1),
        )

    def _create_data_quality_decision(self, issue: Dict) -> Optional[Dict]:
        """Điều tra chất lượng dữ liệu khi input_sample_count < 10"""
        avg_samples = float(issue.get("avg_input_samples") or 0)
        if avg_samples >= 10:
            return None
        cam_id = issue["cam_id"]
        name = issue.get("display_name") or cam_id

        return self._create_decision(
            category="quality",
            title=f"Điều tra chất lượng dữ liệu camera {name}",
            recommendation=f"Số mẫu đầu vào trung bình ({avg_samples:.1f}) quá thấp. Kiểm tra luồng dữ liệu detection.",
            rationale=f"Input sample count = {avg_samples:.1f} < 10 — mô hình thiếu đủ dữ liệu để dự báo chính xác.",
            score_impact=65,
            score_confidence=80,
            score_urgency=70,
            camera_ids=[cam_id],
            evidence={
                "avg_input_samples": avg_samples,
                "sample_count": int(issue.get("sample_count") or 0),
                "mape": float(issue.get("mape") or 0),
            },
            action_items=[
                {"action": "Kiểm tra luồng detection từ camera", "actor": "technician", "timeToAction": "soon"},
                {"action": "Xác minh service image-process đang chạy", "actor": "technician", "timeToAction": "soon"},
                {"action": "Bổ sung dữ liệu nếu pipeline bị gián đoạn", "actor": "technician", "timeToAction": "planned"},
            ],
            effective_until=datetime.now() + timedelta(days=1),
        )

    def _create_feature_or_swap_decision(self, issue: Dict) -> Optional[Dict]:
        """Đề xuất hoán đổi phiên bản mô hình – bỏ qua khi chưa có model registry"""
        return None
