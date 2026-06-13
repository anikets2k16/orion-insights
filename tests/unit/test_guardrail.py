"""FR-10 — guardrail checks."""
import pytest

from agents.guardrail.agent import GuardrailAgent


@pytest.fixture
def agent():
    return GuardrailAgent()


def test_bias_flags_obvious(agent):
    r = agent._check_bias("everyone knows this is obviously always true and never wrong")
    assert not r["passed"]


def test_bias_passes_neutral(agent):
    r = agent._check_bias("Research suggests adoption varies across industries.")
    assert r["passed"]


def test_policy_blocks_attack(agent):
    r = agent._check_policy("This is a personal attack on the competitor.")
    assert not r["passed"]


def test_hallucination_grounded(agent):
    content = "AI is transforming research significantly."
    sources = [{"content": "AI is transforming research and science broadly."}]
    assert agent._check_hallucination(content, sources)["passed"]
