"""FR-20 — Celery worker path.

Runs the real `run_research_task` in Celery *eager* mode (synchronous, no broker), with
the offline LLM provider (conftest) and the in-memory session backend. This exercises the
exact code a worker runs, and stays deterministic + offline (NFR-6).

Note: this is a SYNC test on purpose — the task calls asyncio.run() internally, which
must not run inside an already-running event loop.
"""
from __future__ import annotations

import pytest

_SRC = {
    "url": "https://arxiv.org/abs/1", "title": "AI in care",
    "content": "AI adoption is accelerating across the studied domains in healthcare research.",
    "source_type": "academic", "confidence": 0.9, "query": "AI",
}


@pytest.fixture
def eager_celery():
    from observability.celery_app import celery_app

    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = True
    yield
    celery_app.conf.task_always_eager = False


def _seed():
    return {
        "session_id": "celery-sess",
        "user_id": "anonymous",
        "topic": "AI trends in healthcare 2026",
        "persona": "researcher",
        "agent_config": {},
        "confidence_threshold": 0.0,
        "max_sources": 5,
        "raw_sources": [dict(_SRC)],
        "selected_sources": [dict(_SRC)],
    }


def test_worker_task_completes_and_persists(eager_celery):
    from api import session_store
    from observability.tasks import run_research_task

    state = _seed()
    session_store.save(state["session_id"], state)

    result = run_research_task.delay(state)  # eager → runs in-process now
    payload = result.get()

    assert payload["status"] == "complete"
    stored = session_store.get("celery-sess")
    assert stored is not None
    assert stored["status"] == "complete"
    assert stored.get("report_url")
    assert stored.get("insights")
