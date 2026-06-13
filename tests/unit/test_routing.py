"""FR-3 — guardrail conditional routing."""
from orchestration.graph import route_guardrail


def test_pass_routes_to_report():
    assert route_guardrail({"guardrail_passed": True}) == "report"


def test_block_retries_under_limit():
    assert route_guardrail({"guardrail_passed": False, "guardrail_attempts": 1}) == "retrieve"


def test_block_fails_at_limit():
    assert route_guardrail({"guardrail_passed": False, "guardrail_attempts": 3}) == "failed"
