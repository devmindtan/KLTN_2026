"""
Base Analyzer class for all decision analyzers
Provides common utilities and interface
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional
import logging
from datetime import datetime, timedelta
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)


class BaseAnalyzer(ABC):
    """Abstract base class for all decision analyzers"""

    def __init__(self, db_conn):
        self.db_conn = db_conn
        self.name = self.__class__.__name__

    @abstractmethod
    async def analyze(self) -> List[Dict]:
        """
        Run analysis and generate decisions
        Returns: List of Decision objects (dicts)
        """
        pass

    def calculate_compound_score(
        self, 
        impact: float, 
        confidence: float, 
        urgency: float
    ) -> float:
        """
        Calculate compound score (0-100 scale)
        Formula: (Impact × 0.4) + (Confidence × 0.35) + (Urgency × 0.25)
        """
        score = (impact * 0.4) + (confidence * 0.35) + (urgency * 0.25)
        return round(score, 2)

    def _create_decision(
        self,
        category: str,
        title: str,
        recommendation: str,
        rationale: str,
        score_impact: float,
        score_confidence: float,
        score_urgency: float,
        camera_ids: List[str] = None,
        route_id: Optional[str] = None,
        evidence: Dict = None,
        action_items: List[Dict] = None,
        effective_until: Optional[datetime] = None,
    ) -> Dict:
        """Helper to create decision dict"""
        
        if camera_ids is None:
            camera_ids = []
        if evidence is None:
            evidence = {}
        if action_items is None:
            action_items = []

        compound_score = self.calculate_compound_score(
            score_impact, score_confidence, score_urgency
        )

        return {
            "category": category,
            "title": title,
            "recommendation": recommendation,
            "rationale": rationale,
            "score_impact": score_impact,
            "score_confidence": score_confidence,
            "score_urgency": score_urgency,
            "score_compound": compound_score,
            "camera_ids": camera_ids,
            "route_id": route_id,
            "evidence": evidence,
            "action_items": action_items,
            "effective_until": effective_until,
        }

    def _safe_query(self, query: str, params: tuple = ()) -> List[Dict]:
        """Safe database query wrapper – always returns list of dicts"""
        try:
            cursor = self.db_conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(query, params)
            results = cursor.fetchall()
            cursor.close()
            return [dict(row) for row in results] if results else []
        except Exception as e:
            logger.error(f"[{self.name}] Query failed: {e}")
            return []

    def _safe_scalar(self, query: str, params: tuple = ()) -> Optional[float]:
        """Safe scalar query wrapper"""
        try:
            cursor = self.db_conn.cursor()
            cursor.execute(query, params)
            result = cursor.fetchone()
            cursor.close()
            return result[0] if result else None
            
        except Exception as e:
            logger.error(f"[{self.name}] Scalar query failed: {e}")
            return None
