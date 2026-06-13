"""Confidence Scorer node (FR-7) — deterministic, no LLM.

Thin agent wrapper over infrastructure.confidence_scorer so the orchestrator can treat
scoring as a graph node like any other.
"""
from __future__ import annotations

from typing import Any

from infrastructure.confidence_scorer import rank_sources


class ConfidenceScorerAgent:
    role = "confidence_scorer"

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        sources = state.get("raw_sources") or state.get("scored_sources") or []
        threshold = float(state.get("confidence_threshold", 0.7))
        ranked = rank_sources(sources)
        for s in ranked:
            s["above_threshold"] = s["confidence"] >= threshold
        return {**state, "scored_sources": ranked, "status": "score"}
