"""Base class for all ORION agents (ADR-003).

Agents are stateless: `run(state) -> state`. The LLM is obtained through the
deterministic router, so every agent is reproducible by construction (NFR-1).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from config import get_settings
from infrastructure.llm_router import DeterministicLLM, get_llm


class BaseAgent(ABC):
    #: agent role key (used for model recommendation + audit)
    role: str = "base"

    def __init__(self, model: str | None = None) -> None:
        self.settings = get_settings()
        self.model_name = model or self._default_model()
        self.llm: DeterministicLLM = get_llm(self.model_name)

    @abstractmethod
    def _default_model(self) -> str: ...

    @abstractmethod
    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """Read inputs from `state`, return a (shallow-merged) updated state."""

    def swap_model(self, new_model: str) -> None:
        """Hot-swap the model without recreating the agent (FR-14)."""
        self.model_name = new_model
        self.llm = get_llm(new_model)

    # convenience: a single-shot system+user completion
    def _ask(self, system: str, user: str) -> str:
        return self.llm.complete(
            [{"role": "system", "content": system}, {"role": "user", "content": user}]
        )
