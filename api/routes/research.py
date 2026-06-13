"""Research routes (FR-1, FR-2, FR-4) — start, poll, curate sources, pick artifacts."""
from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from api import session_store
from config import get_settings
from infrastructure.determinism import now_iso, session_id
from orchestration import graph

router = APIRouter()


class ResearchRequest(BaseModel):
    topic: str
    persona: Literal["content_creator", "product_manager", "researcher"]
    context_urls: list[str] = []
    confidence_threshold: float = 0.7
    max_sources: int = 10
    selected_agent_models: dict[str, str] = {}
    integration_targets: list[str] = []


class ResearchResponse(BaseModel):
    session_id: str
    status: str
    progress: float = 0.0
    current_phase: str = "intake"
    report_url: Optional[str] = None


def _seed_state(req: ResearchRequest) -> dict:
    cfg = req.selected_agent_models
    sid = session_id(req.topic, req.persona, cfg)
    return {
        "session_id": sid,
        "user_id": "anonymous",
        "topic": req.topic,
        "persona": req.persona,
        "agent_config": cfg,
        "confidence_threshold": req.confidence_threshold,
        "max_sources": req.max_sources,
        "integration_targets": req.integration_targets,
        "status": "queued",
        "progress": 0.0,
        "created_at": now_iso(),
    }


async def _run(sid: str) -> None:
    state = session_store.get(sid)
    if state is None:
        return
    final = await graph.run_pipeline(state)
    session_store.save(sid, final)


@router.post("/start", response_model=ResearchResponse)
async def start(req: ResearchRequest, background: BackgroundTasks) -> ResearchResponse:
    state = _seed_state(req)
    session_store.save(state["session_id"], state)
    if get_settings().task_backend == "celery":
        # Dispatch to a Redis-backed worker (FR-20). Requires session_backend=redis.
        from observability.tasks import run_research_task

        run_research_task.delay(state)
    else:
        background.add_task(_run, state["session_id"])
    return ResearchResponse(session_id=state["session_id"], status="queued")


@router.get("/{sid}/status", response_model=ResearchResponse)
async def status(sid: str) -> ResearchResponse:
    state = session_store.get(sid)
    if state is None:
        raise HTTPException(404, "session not found")
    return ResearchResponse(
        session_id=sid,
        status=state.get("status", "running"),
        progress=state.get("progress", 0.0),
        current_phase=state.get("status", "running"),
        report_url=state.get("report_url"),
    )


@router.get("/{sid}/sources")
async def sources(sid: str) -> dict:
    state = session_store.get(sid)
    if state is None:
        raise HTTPException(404, "session not found")
    return {"sources": state.get("scored_sources", [])}


class CurationRequest(BaseModel):
    selected_urls: list[str]


@router.post("/{sid}/curate")
async def curate(sid: str, req: CurationRequest) -> dict:
    """Human decision #1 — pick which sources to include (FR-2)."""
    state = session_store.get(sid)
    if state is None:
        raise HTTPException(404, "session not found")
    chosen = [s for s in state.get("scored_sources", []) if s["url"] in req.selected_urls]
    state["selected_sources"] = chosen
    session_store.save(sid, state)
    return {"selected": len(chosen)}


class ArtifactRequest(BaseModel):
    artifacts: list[str]


@router.post("/{sid}/artifacts")
async def artifacts(sid: str, req: ArtifactRequest) -> dict:
    """Human decision #2 — pick output artifacts (FR-2)."""
    state = session_store.get(sid)
    if state is None:
        raise HTTPException(404, "session not found")
    state["selected_artifacts"] = req.artifacts
    session_store.save(sid, state)
    return {"artifacts": req.artifacts}


@router.get("/{sid}/report")
async def report(sid: str) -> dict:
    state = session_store.get(sid)
    if state is None:
        raise HTTPException(404, "session not found")
    return {"report_url": state.get("report_url"), "status": state.get("status")}
