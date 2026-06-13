"""Celery tasks (FR-20). The research pipeline as a background job.

The pipeline is async; we drive it with asyncio.run inside the sync task. Final state is
persisted via the (Redis-backed) session store so the API can read status/report. The
session backend must be 'redis' for the worker and API to share state.
"""
from __future__ import annotations

import asyncio
from typing import Any

from observability.celery_app import celery_app


@celery_app.task(name="orion.run_research", bind=True)
def run_research_task(self, state: dict[str, Any]) -> dict[str, Any]:
    from api import session_store
    from orchestration.graph import run_pipeline

    sid = state["session_id"]
    state["status"] = "running"
    session_store.save(sid, state)
    try:
        final = asyncio.run(run_pipeline(state))
    except Exception as exc:  # pragma: no cover - runtime/LLM dependent
        final = {**state, "status": "failed", "error": str(exc), "progress": 1.0}
    session_store.save(sid, final)
    return {"session_id": sid, "status": final.get("status")}
