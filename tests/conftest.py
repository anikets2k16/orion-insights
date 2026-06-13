"""Test fixtures.

Determinism (NFR-6): tests never hit the network. We patch the *provider* call inside
the deterministic router with a pure function of the input messages (see
`infrastructure/offline_llm.py`). The cache, routing, agents, orchestration, scoring, and
report rendering all run for real — only the network boundary is replaced.
"""
from __future__ import annotations

import pytest

from infrastructure import llm_router
from infrastructure.offline_llm import fake_completion


@pytest.fixture(autouse=True)
def patch_llm(monkeypatch):
    monkeypatch.setattr(
        llm_router.DeterministicLLM, "_call_provider",
        lambda self, messages, params: fake_completion(messages, params),
    )
    yield
