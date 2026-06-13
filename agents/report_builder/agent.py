"""Report Builder (FR-11) — renders the persona report from state via Jinja2."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from agents.base_agent import BaseAgent
from core.models import StructuredReport
from reports.generator import generate_research_report

SYSTEM = (
    "You are ORION's Report Builder. Write a concise executive summary (120-200 words) "
    "of the research, grounded strictly in the provided synthesis and insights. No new facts."
)

STRUCTURED_SYSTEM = (
    "You are ORION's Report Builder. Return ONLY a single JSON object (no prose, no "
    "markdown fences) matching this schema exactly:\n"
    "{\n"
    '  "executive_summary": str (120-200 words),\n'
    '  "key_findings": [{"title": str, "detail": str, "confidence": float 0..1, '
    '"citations": [int]}],\n'
    '  "sections": [{"title": str, "body": str, "citations": [int]}],\n'
    '  "recommendations": [{"action": str, "rationale": str, '
    '"priority": "low"|"medium"|"high"}],\n'
    '  "risks_and_gaps": [{"description": str, "citations": [int]}]\n'
    "}\n"
    "Citations are 1-based indices into the provided source list. Ground every "
    "statement strictly in the synthesis, insights, and sources — no new facts."
)


def _parse_structured(raw: str) -> StructuredReport | None:
    """Best-effort JSON extraction + Pydantic validation. Returns None on failure."""
    if not raw:
        return None
    text = raw.strip()
    # Strip ```json ... ``` fences if the model added them despite instructions.
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    # If the model wrapped JSON in prose, grab the first {...} block.
    if not text.startswith("{"):
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if not m:
            return None
        text = m.group(0)
    try:
        return StructuredReport.model_validate_json(text)
    except Exception:
        try:
            return StructuredReport.model_validate(json.loads(text))
        except Exception:
            return None


class ReportBuilderAgent(BaseAgent):
    role = "report"

    def _default_model(self) -> str:
        return self.settings.report_model

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        synthesis = state.get("safe_content") or state.get("synthesised_content", "")
        insights = state.get("insights", [])
        sources = state.get("selected_sources") or state.get("scored_sources", [])
        source_list = "\n".join(
            f"[{i + 1}] {s.get('title') or s.get('url', '')} — {s.get('url', '')}"
            for i, s in enumerate(sources)
        )
        insight_list = "\n".join(
            f"- {i.get('title')}: {i.get('summary', '')}" for i in insights
        )

        # Try structured Pydantic output first; on any failure, fall back to the
        # original free-form summary path so the pipeline keeps working.
        structured: StructuredReport | None = None
        try:
            raw = self._ask(
                STRUCTURED_SYSTEM,
                f"TOPIC: {state.get('topic', '')}\n"
                f"PERSONA: {state.get('persona', '')}\n\n"
                f"SYNTHESIS:\n{synthesis}\n\n"
                f"INSIGHTS:\n{insight_list}\n\n"
                f"SOURCES:\n{source_list}",
            )
            structured = _parse_structured(raw)
        except Exception:
            structured = None

        if structured is not None:
            summary = structured.executive_summary
        else:
            summary = self._ask(
                SYSTEM,
                f"SYNTHESIS:\n{synthesis}\n\n"
                f"INSIGHTS:\n{[i.get('title') for i in insights]}",
            )

        template = state.get("report_template", "research_output.html")
        out = Path("reports/phases") / state["session_id"] / "output.html"
        session_view = {
            "topic": state["topic"],
            "persona": state["persona"],
            "executive_summary": summary,
            "synthesis": synthesis,
            "insights": insights,
            "sources": sources,
            "audit_log": state.get("audit_log", []),
            "selected_artifacts": state.get("selected_artifacts", []),
            "structured_report": structured.model_dump() if structured else None,
        }
        generate_research_report(session_view, out, template=template)
        return {
            **state,
            "report_url": str(out),
            "executive_summary": summary,
            "structured_report": structured.model_dump() if structured else None,
            "status": "report",
        }
