"""Researcher crew (FR-15)."""
from __future__ import annotations

from crews.base_crew import BaseCrew


class ResearcherCrew(BaseCrew):
    persona = "researcher"
    report_template = "researcher.html"

    def analysis_focus(self) -> str:
        return "Prioritise methodological rigour, evidence chains, and hypothesis framing."

    def default_artifacts(self) -> list[str]:
        return ["research_brief", "hypothesis_list", "competitive_analysis", "executive_summary"]
