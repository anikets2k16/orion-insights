"""Report routes (FR-21, FR-22) — generate + fetch phase/validation reports."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from api import session_store
from reports.generator import generate_validation_report

router = APIRouter()


@router.get("/{sid}/validation", response_class=HTMLResponse)
async def validation(sid: str) -> HTMLResponse:
    state = session_store.get(sid)
    if state is None:
        raise HTTPException(404, "session not found")
    out = Path("reports/phases") / sid / "validation_executive.html"
    generate_validation_report(
        {"topic": state.get("topic"), "persona": state.get("persona"), "status": state.get("status")},
        state.get("audit_log", []),
        out,
    )
    return HTMLResponse(out.read_text("utf-8"))


@router.get("/{sid}/view", response_class=HTMLResponse)
async def view(sid: str) -> HTMLResponse:
    state = session_store.get(sid)
    if state is None or not state.get("report_url"):
        raise HTTPException(404, "report not ready")
    path = Path(state["report_url"])
    if not path.exists():
        raise HTTPException(404, "report file missing")
    return HTMLResponse(path.read_text("utf-8"))
