"""Deterministic offline provider for tests + the CI determinism gate (NFR-1/6).

This patches ONLY the network boundary (`DeterministicLLM._call_provider`) with a pure
function of the input messages. The cache, router policy, agents, orchestration, scoring,
and report rendering all run for real. The real provider code path is untouched in
production — this is installed explicitly, never by default.
"""
from __future__ import annotations

import json

from infrastructure.determinism import stable_hash


def fake_completion(messages: list[dict], params: dict | None = None) -> str:
    system = next((m["content"] for m in messages if m["role"] == "system"), "")
    s = system.lower()
    if "clarification agent" in s:
        return "[]"
    if "critical analysis agent" in s:
        return json.dumps({
            "synthesis": "AI adoption is accelerating across the studied domains.",
            "contradictions": [],
            "claims": [{"claim": "Adoption is rising", "evidence": "multiple sources agree",
                        "source_url": "https://arxiv.org/abs/1"}],
        })
    if "insight generator" in s:
        return json.dumps([{
            "title": "Adoption inflection point",
            "summary": "Evidence points to a near-term inflection in adoption.",
            "type": "trend", "confidence": 0.82,
            "evidence": ["multiple sources agree"], "acceptance_criteria": ["validate with Q3 data"],
        }])
    if "report builder" in s:
        return "Executive summary: adoption is accelerating; one key trend identified."
    return f"OK:{stable_hash({'m': messages})[:8]}"


def install_offline_llm() -> None:
    """Monkeypatch the provider boundary in-process (idempotent)."""
    from infrastructure import llm_router

    llm_router.DeterministicLLM._call_provider = (  # type: ignore[method-assign]
        lambda self, messages, params: fake_completion(messages, params)
    )
