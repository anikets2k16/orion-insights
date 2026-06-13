"""FastAPI application entrypoint (FR-17)."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import agents, auth, integrations, reports, research
from config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(research.router, prefix="/api/research", tags=["research"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(integrations.router, prefix="/api/integrations", tags=["integrations"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])


@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "version": settings.app_version,
        "env": settings.environment,
        "deterministic": settings.deterministic,
        "llm_cache_mode": settings.llm_cache_mode,
    }
