"""Content Creator crew (FR-15)."""
from __future__ import annotations

from crews.base_crew import BaseCrew


class ContentCreatorCrew(BaseCrew):
    persona = "content_creator"
    report_template = "content_creator.html"

    def analysis_focus(self) -> str:
        return "Frame findings for audience engagement, narrative hooks, and shareability."

    def default_artifacts(self) -> list[str]:
        return ["research_brief", "social_captions", "content_calendar", "executive_summary"]
