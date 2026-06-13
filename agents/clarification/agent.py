"""Clarification Agent (FR-5) — asks ≤3 targeted questions, context-aware."""
from __future__ import annotations

import json
from typing import Any

from agents.base_agent import BaseAgent

SYSTEM = (
    "You are ORION's Clarification Agent. Given a research topic and any context, return "
    "ONLY the minimum questions (0 to {maxq}) needed to make the brief unambiguous. "
    "Skip anything the context already answers. Respond as a JSON list of strings, e.g. "
    '["Which region?", "What time horizon?"]. Return [] if the brief is already clear.'
)


class ClarificationAgent(BaseAgent):
    role = "clarification"

    def _default_model(self) -> str:
        return self.settings.clarification_model

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        maxq = self.settings.max_clarification_questions
        ctx = state.get("brief") or ""
        user = f"Topic: {state['topic']}\nPersona: {state['persona']}\nContext: {ctx or '(none)'}"
        raw = self._ask(SYSTEM.format(maxq=maxq), user)
        questions = _parse_questions(raw)[:maxq]
        return {**state, "clarification_questions": questions, "status": "clarify"}


def _parse_questions(raw: str) -> list[str]:
    raw = raw.strip()
    start, end = raw.find("["), raw.rfind("]")
    if start != -1 and end != -1:
        try:
            data = json.loads(raw[start : end + 1])
            return [str(q) for q in data if isinstance(q, (str, int))]
        except json.JSONDecodeError:
            pass
    # fallback: line-split
    return [ln.strip("-• ").strip() for ln in raw.splitlines() if ln.strip()][:3]
