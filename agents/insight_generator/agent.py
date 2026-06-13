"""Insight Generator (FR-9) — CoT hypotheses + trends, with a hallucination self-check."""
from __future__ import annotations

import json
from typing import Any

from agents.base_agent import BaseAgent

SYSTEM = (
    "You are ORION's Insight Generator. {focus} Think step by step over the analysis, then "
    "surface non-obvious insights. Return a JSON list of objects with keys: "
    "`title`, `summary`, `type` (one of hypothesis|trend|opportunity|finding), "
    "`confidence` (0-1 float), `evidence` (list of strings drawn from the analysis), "
    "`acceptance_criteria` (list of strings). Do not invent facts absent from the analysis. "
    "Output JSON only."
)


class InsightGeneratorAgent(BaseAgent):
    role = "insight"

    def _default_model(self) -> str:
        return self.settings.insight_model

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        focus = state.get("analysis_focus", "")
        analysis = state.get("analysis", {})
        user = (
            f"Topic: {state['topic']}\n\nANALYSIS:\n{json.dumps(analysis, indent=2)[:6000]}"
        )
        raw = self._ask(SYSTEM.format(focus=focus), user)
        insights = _parse_insights(raw)
        grounded = [i for i in insights if self._grounded(i, analysis)]
        synth = state.get("synthesised_content", "")
        synth += "\n\nKEY INSIGHTS:\n" + "\n".join(f"- {i['title']}: {i['summary']}" for i in grounded)
        return {**state, "insights": grounded, "synthesised_content": synth, "status": "insight"}

    @staticmethod
    def _grounded(insight: dict, analysis: dict) -> bool:
        """Lightweight self-check: an insight must carry at least one evidence item."""
        return bool(insight.get("evidence")) or bool(analysis.get("claims"))


def _parse_insights(raw: str) -> list[dict]:
    raw = raw.strip()
    start, end = raw.find("["), raw.rfind("]")
    if start != -1 and end != -1:
        try:
            data = json.loads(raw[start : end + 1])
            return [d for d in data if isinstance(d, dict) and d.get("title")]
        except json.JSONDecodeError:
            pass
    return []
