"""Product Manager crew (FR-15)."""
from __future__ import annotations

from crews.base_crew import BaseCrew


class ProductManagerCrew(BaseCrew):
    persona = "product_manager"
    report_template = "product_manager.html"

    def analysis_focus(self) -> str:
        return "Frame findings as product opportunities, risks, and prioritisable bets."

    def default_artifacts(self) -> list[str]:
        return ["research_brief", "competitive_analysis", "prd_insights", "executive_summary"]
