"""Integration routes (FR-12) — push a completed session's insights to a target."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agents.integration.agent import IntegrationAgent
from api import session_store

router = APIRouter()


class PushRequest(BaseModel):
    targets: list[str]  # e.g. ["github:org/repo", "jira:PROD"]


@router.post("/{sid}/push")
async def push(sid: str, req: PushRequest) -> dict:
    state = session_store.get(sid)
    if state is None:
        raise HTTPException(404, "session not found")
    state["integration_targets"] = req.targets
    result = await IntegrationAgent().run(state)
    return {"pushed": result.get("integration_results", [])}


@router.get("/status")
async def status() -> dict:
    from config import get_settings

    s = get_settings()
    return {
        "github": bool(s.github_token),
        "jira": bool(s.jira_url and s.jira_token),
        "confluence": bool(s.confluence_url and s.confluence_token),
    }
