"""Critical Analysis Agent (FR-8) — synthesis, contradiction detection, claim→evidence."""
from __future__ import annotations

import json
from typing import Any

from agents.base_agent import BaseAgent

SYSTEM = (
    "You are ORION's Critical Analysis Agent. {focus} Using ONLY the provided sources, "
    "produce a JSON object with keys: "
    "`synthesis` (string, 2-4 paragraphs grounded in sources), "
    "`contradictions` (list of strings), "
    "`claims` (list of objects {{claim, evidence, source_url}}). "
    "Every claim must cite a source_url that appears in the input. Output JSON only."
)


class CriticalAnalysisAgent(BaseAgent):
    role = "analysis"

    def _default_model(self) -> str:
        return self.settings.analysis_model

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        focus = state.get("analysis_focus", "")
        sources = state.get("selected_sources") or state.get("scored_sources") or []
        corpus = _format_sources(sources)
        user = f"Topic: {state['topic']}\n\nSOURCES:\n{corpus}"
        raw = self._ask(SYSTEM.format(focus=focus), user)
        analysis = _parse_json(raw)
        return {
            **state,
            "analysis": analysis,
            "synthesised_content": analysis.get("synthesis", ""),
            "status": "analyse",
        }


def _format_sources(sources: list[dict]) -> str:
    lines = []
    for i, s in enumerate(sources, 1):
        lines.append(
            f"[{i}] {s.get('title','(untitled)')} — {s.get('url','')}\n"
            f"    confidence={s.get('confidence','?')}\n"
            f"    {(s.get('content','') or '')[:1200]}"
        )
    return "\n\n".join(lines) or "(no sources)"


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end != -1:
        try:
            return json.loads(raw[start : end + 1])
        except json.JSONDecodeError:
            pass
    return {"synthesis": raw, "contradictions": [], "claims": []}
