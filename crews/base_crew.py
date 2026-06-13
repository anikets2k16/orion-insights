"""Crew contract (ADR-004, FR-15/16).

A crew binds the three persona-tunable agents (retrieval, analysis, output) plus a
persona-specific report template and prompt flavour. The orchestrator picks a crew from
`state.persona` and delegates the tunable steps to it.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from agents.base_agent import BaseAgent
from agents.contextual_retriever.agent import ContextualRetrieverAgent
from agents.critical_analysis.agent import CriticalAnalysisAgent
from agents.insight_generator.agent import InsightGeneratorAgent


class BaseCrew(ABC):
    #: persona key, must match core.models.Persona
    persona: str = "base"
    #: jinja template used by the Report Builder for this persona
    report_template: str = "research_output.html"

    def __init__(self, agent_config: dict | None = None) -> None:
        cfg = agent_config or {}
        self.retriever: BaseAgent = ContextualRetrieverAgent(cfg.get("retriever_model"))
        self.analyst: BaseAgent = CriticalAnalysisAgent(cfg.get("analysis_model"))
        self.insighter: BaseAgent = InsightGeneratorAgent(cfg.get("insight_model"))

    @abstractmethod
    def analysis_focus(self) -> str:
        """One line steering the analysis/insight prompts for this persona."""

    @abstractmethod
    def default_artifacts(self) -> list[str]:
        """Artifacts offered to this persona at the selection step."""


def get_crew(persona: str, agent_config: dict | None = None) -> "BaseCrew":
    from crews.content_creator.crew import ContentCreatorCrew
    from crews.product_manager.crew import ProductManagerCrew
    from crews.researcher.crew import ResearcherCrew

    registry: dict[str, type[BaseCrew]] = {
        "content_creator": ContentCreatorCrew,
        "product_manager": ProductManagerCrew,
        "researcher": ResearcherCrew,
    }
    if persona not in registry:
        raise ValueError(f"Unknown persona '{persona}'. Known: {list(registry)}")
    return registry[persona](agent_config)
