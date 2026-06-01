"""
Base Analyzer class for all decision analyzers
Provides common utilities and interface
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional
import logging
import math
from datetime import datetime, timedelta
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

# ── Confidence model constants ─────────────────────────────────────────────
# Minimum samples required before we emit any decision at all
MIN_SAMPLES_TO_EMIT = 5

# Score below which we suppress a decision as "not credible"
MIN_CONFIDENCE_TO_EMIT = 45


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

    # ── Score helpers ─────────────────────────────────────────────────────

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

    def confidence_from_samples(
        self,
        sample_count: int,
        *,
        reference: int = 30,
        floor: float = 20.0,
        ceiling: float = 90.0,
    ) -> float:
        """
        Derive a confidence score from the number of data samples using a
        logarithmic growth curve so that:
          - 0  samples  →  floor   (e.g. 20)
          - ref samples →  ~75
          - ∞  samples  →  ceiling (e.g. 90)

        Args:
            sample_count: Number of raw observations driving this decision.
            reference:    Sample count that should yield ~75% confidence.
            floor:        Minimum possible confidence (data exists but very thin).
            ceiling:      Maximum possible confidence (asymptote).

        Returns:
            Confidence score in [floor, ceiling].
        """
        if sample_count <= 0:
            return floor
        # log-scale growth: score = floor + (ceiling - floor) * log(n+1) / log(ref+1)
        ratio = math.log(sample_count + 1) / math.log(reference + 1)
        raw = floor + (ceiling - floor) * ratio
        return round(min(ceiling, max(floor, raw)), 1)

    def confidence_from_recency(
        self,
        last_seen_minutes: float,
        *,
        fresh_threshold: float = 5.0,
        stale_threshold: float = 60.0,
        floor: float = 10.0,
        ceiling: float = 95.0,
    ) -> float:
        """
        Derive confidence from how fresh the underlying data is.

        Args:
            last_seen_minutes:  Minutes since most recent observation.
            fresh_threshold:    Below this → ceiling confidence.
            stale_threshold:    Above this → floor confidence.
        """
        if last_seen_minutes <= fresh_threshold:
            return ceiling
        if last_seen_minutes >= stale_threshold:
            return floor
        # Linear decay between fresh and stale
        decay = (last_seen_minutes - fresh_threshold) / (stale_threshold - fresh_threshold)
        raw = ceiling - decay * (ceiling - floor)
        return round(max(floor, min(ceiling, raw)), 1)

    def blend_confidence(self, *scores: float, weights: List[float] = None) -> float:
        """
        Weighted average of multiple confidence signals.
        If weights is None, equal weighting is applied.
        """
        if not scores:
            return 0.0
        w = weights if weights and len(weights) == len(scores) else [1.0] * len(scores)
        total_w = sum(w)
        blended = sum(s * wi for s, wi in zip(scores, w)) / total_w
        return round(blended, 1)

    # ── Decision factory ──────────────────────────────────────────────────

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
        # ── NEW: credibility guard ──────────────────────────────────────
        min_confidence: float = MIN_CONFIDENCE_TO_EMIT,
    ) -> Optional[Dict]:
        """
        Helper to create a decision dict.

        Returns None (suppresses the decision) when score_confidence is below
        min_confidence, making it easy to call without extra if-guards.
        """
        if score_confidence < min_confidence:
            logger.info(
                f"[{self.name}] Suppressed decision '{title}' — "
                f"confidence {score_confidence:.1f} < threshold {min_confidence}"
            )
            return None

        if camera_ids is None:
            camera_ids = []
        if evidence is None:
            evidence = {}
        if action_items is None:
            action_items = []

        compound_score = self.calculate_compound_score(
            score_impact, score_confidence, score_urgency
        )

        # Always stamp evidence with generation metadata for auditability
        evidence.setdefault("_generated_at", datetime.now().isoformat())
        evidence.setdefault("_analyzer", self.name)
        evidence.setdefault("_confidence_score", score_confidence)

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

    # ── DB helpers ────────────────────────────────────────────────────────

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
