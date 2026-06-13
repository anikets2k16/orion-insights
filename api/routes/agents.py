"""Agent configuration routes (FR-14)."""
from __future__ import annotations

from fastapi import APIRouter

from infrastructure.llm_router import get_best_model_for, list_models

router = APIRouter()


@router.get("/models")
async def models() -> dict:
    return {"models": list_models()}


@router.get("/recommend/{role}")
async def recommend(role: str) -> dict:
    return {"role": role, "recommended_model": get_best_model_for(role)}


@router.post("/config")
async def update_config(config: dict) -> dict:
    # validates snapshot-only ids via the router on next use; persisted per user in prod
    return {"status": "updated", "config": config}
