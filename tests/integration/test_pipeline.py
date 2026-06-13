"""FR-1 — full pipeline runs end to end and is deterministic (offline, see conftest)."""
import pytest

from infrastructure.determinism import stable_hash
from orchestration.graph import run_pipeline


# Content grounds the deterministic synthesis from conftest so the hallucination check passes.
_GROUNDING = "AI adoption is accelerating across the studied domains in healthcare research."


def _seed():
    src = {
        "url": "https://arxiv.org/abs/1", "title": "AI in care", "content": _GROUNDING,
        "source_type": "academic", "confidence": 0.9, "query": "AI",
    }
    return {
        "session_id": "test-sess",
        "topic": "AI trends in healthcare 2026",
        "persona": "researcher",
        "agent_config": {},
        "confidence_threshold": 0.0,  # accept all so analysis has sources offline
        "max_sources": 5,
        # pre-seed captured sources so retrieval replays deterministically (no network).
        "raw_sources": [dict(src)],
        "selected_sources": [dict(src)],
    }


@pytest.mark.asyncio
async def test_pipeline_completes():
    out = await run_pipeline(_seed())
    assert out["status"] == "complete"
    assert out["report_url"]
    assert out["insights"], "expected at least one insight"
    assert out["guardrail_passed"] is True


@pytest.mark.asyncio
async def test_pipeline_is_deterministic():
    a = await run_pipeline(_seed())
    b = await run_pipeline(_seed())
    # same synthesis + insights => same audit content hash
    assert stable_hash(a["insights"]) == stable_hash(b["insights"])
    assert a["audit_entry"]["content_hash"] == b["audit_entry"]["content_hash"]
