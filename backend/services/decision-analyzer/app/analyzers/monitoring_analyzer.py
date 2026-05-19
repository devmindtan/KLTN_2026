"""
System Monitoring Analyzer
Monitors system health, camera connectivity, and data quality
"""

from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)


class MonitoringAnalyzer(BaseAnalyzer):
    """Analyzes system health and monitoring data"""

    async def analyze(self) -> List[Dict]:
        """
        Analyze system monitoring:
        1. Check camera connectivity (missing data)
        2. Verify data consistency (outliers)
        3. Check camera calibration
        4. Generate maintenance/investigation recommendations
        """
        try:
            decisions = []
            
            # Get system issues
            system_issues = self._get_system_issues()
            
            if not system_issues:
                logger.info(f"[{self.name}] System health is good")
                return []
            
            logger.info(f"[{self.name}] Found {len(system_issues)} system issues")
            
            # Generate monitoring decisions
            for issue in system_issues:
                issue_decisions = self._analyze_system_issue(issue)
                decisions.extend(issue_decisions)
            
            logger.info(f"[{self.name}] Generated {len(decisions)} decisions")
            return decisions
            
        except Exception as e:
            logger.error(f"[{self.name}] Analysis failed: {e}", exc_info=True)
            return []

    def _get_system_issues(self) -> List[Dict]:
        """Get cameras with monitoring issues"""
        issues = []
        
        # Check 1: Missing cameras (no detection for >30 min)
        missing_cams = self._check_missing_cameras()
        issues.extend(missing_cams)
        
        # Check 2: Data inconsistency between adjacent cameras
        inconsistent_cams = self._check_data_consistency()
        issues.extend(inconsistent_cams)
        
        # Check 3: Extreme detection counts (likely calibration issues)
        calibration_issues = self._check_calibration()
        issues.extend(calibration_issues)
        
        return issues

    def _check_missing_cameras(self) -> List[Dict]:
        """Check for cameras with no recent data (>30 minutes)"""
        query = """
            SELECT
                cd.cam_id,
                cd.display_name,
                cd.location,
                MAX(det.created_at) AS last_update,
                EXTRACT(EPOCH FROM (NOW() - MAX(det.created_at))) / 60 AS minutes_since_update
            FROM camera_data cd
            LEFT JOIN camera_detections det ON cd.cam_id = det.camera_id
            GROUP BY cd.cam_id, cd.display_name, cd.location
            HAVING MAX(det.created_at) IS NULL
                OR MAX(det.created_at) < NOW() - INTERVAL '30 minutes'
            ORDER BY last_update ASC NULLS FIRST
            LIMIT 10
        """
        results = self._safe_query(query)
        return [{"type": "missing_data", "data": r} for r in results]

    def _check_data_consistency(self) -> List[Dict]:
        """Check for inconsistent detection counts between adjacent cameras"""
        # TODO: Implement consistency check
        # - Get adjacent cameras
        # - Compare vehicle counts
        # - Identify outliers
        return []

    def _check_calibration(self) -> List[Dict]:
        """Check for potential calibration issues"""
        # TODO: Implement calibration check
        # - Identify extreme detection counts
        # - Compare with historical baseline
        # - Recommend verification
        return []

    def _analyze_system_issue(self, issue: Dict) -> List[Dict]:
        """Generate decisions for a specific system issue"""
        decisions = []
        issue_type = issue.get("type")
        
        if issue_type == "missing_data":
            # Decision: Investigate missing camera
            investigation_decision = self._create_investigation_decision(issue)
            if investigation_decision:
                decisions.append(investigation_decision)
        
        elif issue_type == "inconsistent_data":
            # Decision: Verify calibration
            calibration_decision = self._create_calibration_verification_decision(issue)
            if calibration_decision:
                decisions.append(calibration_decision)
        
        elif issue_type == "calibration_issue":
            # Decision: Review data labeling
            labeling_decision = self._create_labeling_review_decision(issue)
            if labeling_decision:
                decisions.append(labeling_decision)
        
        return decisions

    def _create_investigation_decision(self, issue: Dict) -> Optional[Dict]:
        """Khuyến nghị điều tra camera mất tín hiệu"""
        cam_data = issue.get("data", {})
        cam_id = cam_data.get("cam_id") or "unknown"
        name = cam_data.get("display_name") or cam_id
        loc = cam_data.get("location") or ""
        minutes = cam_data.get("minutes_since_update")
        last_update = cam_data.get("last_update")

        if minutes is not None:
            since_str = f"{int(float(minutes))} phút trước"
        elif last_update is None:
            since_str = "chưa từng ghi nhận"
        else:
            since_str = "không xác định"

        return self._create_decision(
            category="monitoring",
            title=f"Điều tra mất tín hiệu camera {name}",
            recommendation=f"Camera {name} ({loc}) không có dữ liệu trong {since_str}. Kiểm tra kết nối và phần cứng.",
            rationale=f"Cập nhật cuối: {last_update or 'N/A'}. Thiếu dữ liệu ảnh hưởng độ chính xác toàn hệ thống.",
            score_impact=80,
            score_confidence=95,
            score_urgency=85,
            camera_ids=[cam_id],
            evidence={
                "last_update": str(last_update) if last_update else None,
                "minutes_since_update": float(minutes) if minutes is not None else None,
                "location": loc,
            },
            action_items=[
                {"action": "Kiểm tra kết nối mạng và nguồn điện camera", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Xác minh service image-process đang chạy", "actor": "technician", "timeToAction": "immediate"},
                {"action": "Liên hệ kỹ thuật viên hiện trường nếu cần", "actor": "technician", "timeToAction": "soon"},
            ],
            effective_until=datetime.now() + timedelta(hours=4),
        )

    def _create_calibration_verification_decision(self, issue: Dict) -> Optional[Dict]:
        """Xác minh hiệu chỉnh camera – bỏ qua khi chưa có dữ liệu tham chiếu"""
        return None

    def _create_labeling_review_decision(self, issue: Dict) -> Optional[Dict]:
        """Xem xét nhãn dữ liệu huấn luyện – bỏ qua khi chưa có pipeline tham chiếu"""
        return None
