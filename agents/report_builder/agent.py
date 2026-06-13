"""Report Builder (FR-11) — renders the persona report from state via Jinja2."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from agents.base_agent import BaseAgent
from reports.generator import generate_research_report

SYSTEM = (
    "You are ORION's Report Builder. Write a concise executive summary (120-200 words) "
    "of the research, grounded strictly in the provided synthesis and insights. No new facts."
)


class ReportBuilderAgent(BaseAgent):
    role = "report"

    def _default_model(self) -> str:
        return self.settings.report_model

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        summary = self._ask(
            SYSTEM,
            f"SYNTHESIS:\n{state.get('safe_content') or state.get('synthesised_content','')}\n\n"
            f"INSIGHTS:\n{[i.get('title') for i in state.get('insights', [])]}",
        )
        template = state.get("report_template", "research_output.html")
        out = Path("reports/phases") / state["session_id"] / "output.html"
        session_view = {
            "topic": state["topic"],
            "persona": state["persona"],
            "executive_summary": summary,
            "synthesis": state.get("safe_content") or state.get("synthesised_content", ""),
            "insights": state.get("insights", []),
            "sources": state.get("selected_sources") or state.get("scored_sources", []),
            "audit_log": state.get("audit_log", []),
            "selected_artifacts": state.get("selected_artifacts", []),
        }
        generate_research_report(session_view, out, template=template)
        return {
            **state,
            "report_url": str(out),
            "executive_summary": summary,
            "status": "report",
        }
