"""Environment-aware configuration. Secrets come from env vars only (NFR-5).

Determinism knobs (NFR-1) live here so every component reads one source of truth.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # ── App ──
    app_name: str = "ORION Researcher"
    app_version: str = "2.0.0"
    environment: Literal["local", "staging", "production"] = "local"
    debug: bool = False

    # ── Determinism (NFR-1) ──
    deterministic: bool = Field(default=True, validation_alias="ORION_DETERMINISTIC")
    llm_seed: int = Field(default=42, validation_alias="ORION_LLM_SEED")
    llm_temperature: float = 0.0
    llm_top_p: float = 1.0
    # read_write = replay-or-call+store · read_only = replay-only (CI) · refresh = overwrite
    llm_cache_mode: Literal["read_write", "read_only", "refresh"] = Field(
        default="read_write", validation_alias="ORION_LLM_CACHE_MODE"
    )
    llm_cache_dir: str = ".cache/llm"
    # Frozen epoch (UTC ISO) used for IDs/timestamps when deterministic=True.
    deterministic_epoch: str = "2026-01-01T00:00:00+00:00"

    # ── LLM models (swappable per agent · snapshot IDs only, ADR-009) ──
    retriever_model: str = "gpt-4o-mini-2024-07-18"
    analysis_model: str = "claude-3-5-sonnet-20241022"
    insight_model: str = "claude-3-7-sonnet-20250219"
    report_model: str = "gpt-4o-2024-08-06"
    clarification_model: str = "gpt-4o-mini-2024-07-18"
    guardrail_model: str = "gpt-4o-mini-2024-07-18"

    # ── API keys ──
    openai_api_key: str = Field(default="", validation_alias="OPENAI_API_KEY")
    anthropic_api_key: str = Field(default="", validation_alias="ANTHROPIC_API_KEY")
    tavily_api_key: str = Field(default="", validation_alias="TAVILY_API_KEY")
    serpapi_key: str = Field(default="", validation_alias="SERPAPI_KEY")

    # ── Database / cache ──
    supabase_url: str = Field(default="", validation_alias="SUPABASE_URL")
    supabase_key: str = Field(default="", validation_alias="SUPABASE_KEY")
    database_url: str = Field(
        default="postgresql://orion:orion_dev@localhost:5432/orion",
        validation_alias="DATABASE_URL",
    )
    redis_url: str = Field(
        default="redis://localhost:6379/0", validation_alias="REDIS_URL"
    )

    # ── Auth ──
    jwt_secret: str = Field(default="dev-insecure-change-me-32chars-min", validation_alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # ── Integrations (optional) ──
    github_token: str = Field(default="", validation_alias="GITHUB_TOKEN")
    jira_url: str = Field(default="", validation_alias="JIRA_URL")
    jira_token: str = Field(default="", validation_alias="JIRA_TOKEN")
    jira_email: str = Field(default="", validation_alias="JIRA_EMAIL")
    confluence_url: str = Field(default="", validation_alias="CONFLUENCE_URL")
    confluence_token: str = Field(default="", validation_alias="CONFLUENCE_TOKEN")

    # ── Observability ──
    langfuse_public_key: str = Field(default="", validation_alias="LANGFUSE_PUBLIC_KEY")
    langfuse_secret_key: str = Field(default="", validation_alias="LANGFUSE_SECRET_KEY")
    langfuse_host: str = Field(
        default="https://cloud.langfuse.com", validation_alias="LANGFUSE_HOST"
    )

    # ── Execution backends ──
    # background = FastAPI BackgroundTasks (single process) · celery = Redis-backed workers
    task_backend: Literal["background", "celery"] = Field(
        default="background", validation_alias="ORION_TASK_BACKEND"
    )
    # memory = in-process dict (dev) · redis = shared across API + workers
    session_backend: Literal["memory", "redis"] = Field(
        default="memory", validation_alias="ORION_SESSION_BACKEND"
    )

    # ── Agent defaults ──
    confidence_threshold: float = 0.7
    max_sources: int = 10
    max_clarification_questions: int = 3
    max_guardrail_retries: int = 3
    guardrail_enabled: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
