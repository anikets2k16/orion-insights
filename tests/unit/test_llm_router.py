"""FR-14, NFR-1/2 — router model policy + caching."""
import pytest

from infrastructure.llm_router import (
    DeterministicLLM,
    ModelPolicyError,
    get_best_model_for,
    get_llm,
)


def test_rejects_floating_alias():
    with pytest.raises(ModelPolicyError):
        get_llm("gpt-4o")  # not a dated snapshot


def test_accepts_snapshot():
    llm = get_llm("gpt-4o-2024-08-06")
    assert llm.provider == "openai"


def test_anthropic_snapshot_routes_to_anthropic():
    assert get_llm("claude-3-5-sonnet-20241022").provider == "anthropic"


def test_recommendation():
    assert get_best_model_for("insight").endswith("20250219")


def test_completion_is_cached_and_deterministic(tmp_path, monkeypatch):
    monkeypatch.setenv("ORION_LLM_CACHE_MODE", "read_write")
    llm = get_llm("gpt-4o-mini-2024-07-18")
    msgs = [{"role": "system", "content": "x"}, {"role": "user", "content": "y"}]
    first = llm.complete(msgs)
    second = llm.complete(msgs)
    assert first == second  # deterministic replay
