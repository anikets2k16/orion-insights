"""Deterministic LLM router (ADR-002/009, NFR-1/2).

- Snapshot-only model policy: floating aliases are rejected (C2).
- Forces temperature=0, top_p=1, fixed seed (C1).
- Wraps every completion in the content-addressed cache (C3).
- Real providers only; a missing key for a needed provider is a hard error (NFR-2).
"""
from __future__ import annotations

import re
from typing import Any

from config import get_settings
from infrastructure.determinism import LLMCache

# model id -> metadata. Only dated snapshots are listed (ADR-009).
AVAILABLE_MODELS: dict[str, dict[str, Any]] = {
    "gpt-4o-2024-08-06": {"provider": "openai", "tier": "premium", "recommended_for": ["report", "analysis"]},
    "gpt-4o-mini-2024-07-18": {"provider": "openai", "tier": "fast", "recommended_for": ["retrieval", "clarification", "guardrail"]},
    "claude-3-7-sonnet-20250219": {"provider": "anthropic", "tier": "reasoning", "recommended_for": ["insight", "analysis"]},
    "claude-3-5-sonnet-20241022": {"provider": "anthropic", "tier": "premium", "recommended_for": ["analysis", "report"]},
    "claude-3-haiku-20240307": {"provider": "anthropic", "tier": "fast", "recommended_for": ["guardrail"]},
}

# Snapshot ids end in a date: -YYYY-MM-DD (openai) or -YYYYMMDD (anthropic).
_SNAPSHOT_RE = re.compile(r"(\d{4}-\d{2}-\d{2}|\d{8})$")


class ModelPolicyError(ValueError):
    """Raised when a non-snapshot model id is requested (breaks determinism)."""


def _validate(model: str) -> dict[str, Any]:
    if not _SNAPSHOT_RE.search(model):
        raise ModelPolicyError(
            f"Model '{model}' is not a dated snapshot. Determinism (NFR-1) requires "
            "snapshot ids like 'gpt-4o-2024-08-06' or 'claude-3-5-sonnet-20241022'."
        )
    return AVAILABLE_MODELS.get(model, {"provider": _infer_provider(model), "tier": "unknown", "recommended_for": []})


def _infer_provider(model: str) -> str:
    return "anthropic" if model.startswith("claude") else "openai"


class DeterministicLLM:
    """Thin, provider-agnostic chat client with caching. `complete()` takes a list of
    {role, content} messages and returns the assistant text."""

    def __init__(self, model: str) -> None:
        self.settings = get_settings()
        self.meta = _validate(model)
        self.model = model
        self.provider = self.meta["provider"]
        self.cache = LLMCache()
        self._params = {
            "temperature": self.settings.llm_temperature,
            "top_p": self.settings.llm_top_p,
            "seed": self.settings.llm_seed,
        }

    # -- public ---------------------------------------------------------------
    def complete(self, messages: list[dict[str, str]], **overrides: Any) -> str:
        params = {**self._params, **overrides}
        key = self.cache.key(self.provider, self.model, messages, params)
        cached = self.cache.get(key)
        if cached is not None:
            return cached
        text = self._call_provider(messages, params)
        self.cache.put(key, self.provider, self.model, text)
        return text

    # -- providers ------------------------------------------------------------
    def _call_provider(self, messages: list[dict[str, str]], params: dict[str, Any]) -> str:
        if self.provider == "anthropic":
            return self._call_anthropic(messages, params)
        return self._call_openai(messages, params)

    def _call_openai(self, messages: list[dict[str, str]], params: dict[str, Any]) -> str:
        if not self.settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY missing — real LLMs required (NFR-2).")
        from openai import OpenAI

        client = OpenAI(api_key=self.settings.openai_api_key)
        resp = client.chat.completions.create(
            model=self.model,
            messages=messages,  # type: ignore[arg-type]
            temperature=params["temperature"],
            top_p=params["top_p"],
            seed=params["seed"],
        )
        return resp.choices[0].message.content or ""

    def _call_anthropic(self, messages: list[dict[str, str]], params: dict[str, Any]) -> str:
        if not self.settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY missing — real LLMs required (NFR-2).")
        from anthropic import Anthropic

        client = Anthropic(api_key=self.settings.anthropic_api_key)
        system = "\n".join(m["content"] for m in messages if m["role"] == "system")
        convo = [m for m in messages if m["role"] != "system"]
        resp = client.messages.create(
            model=self.model,
            system=system or None,
            messages=convo,  # type: ignore[arg-type]
            temperature=params["temperature"],
            top_p=params["top_p"],
            max_tokens=4096,
        )
        return "".join(block.text for block in resp.content if block.type == "text")


# -- module helpers -----------------------------------------------------------
def get_llm(model: str) -> DeterministicLLM:
    return DeterministicLLM(model)


def get_best_model_for(role: str) -> str:
    for model, meta in AVAILABLE_MODELS.items():
        if role in meta.get("recommended_for", []):
            return model
    return "gpt-4o-mini-2024-07-18"


def list_models() -> list[dict[str, Any]]:
    return [{"name": k, **v} for k, v in AVAILABLE_MODELS.items()]
