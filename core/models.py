"""Pydantic v2 domain models (see specs/data-model.md)."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Persona = Literal["content_creator", "product_manager", "researcher"]
PipelinePhase = Literal[
    "intake", "clarify", "retrieve", "score", "analyse",
    "insight", "guardrail", "report", "awaiting_user", "complete", "failed",
]
Tier = Literal["free", "pro", "enterprise"]
InsightType = Literal["hypothesis", "trend", "opportunity", "finding"]


class AgentConfig(BaseModel):
    retriever_model: str = "gpt-4o-mini-2024-07-18"
    analysis_model: str = "claude-3-5-sonnet-20241022"
    insight_model: str = "claude-3-7-sonnet-20250219"
    report_model: str = "gpt-4o-2024-08-06"
    clarification_model: str = "gpt-4o-mini-2024-07-18"
    confidence_threshold: float = 0.7
    max_sources: int = 10


class Source(BaseModel):
    url: str
    title: str
    content: str = ""
    source_type: str = "web"
    published_date: Optional[str] = None
    query: str = ""
    confidence: float = 0.0
    cross_validation_score: float = 0.5
    selected: bool = False


class Insight(BaseModel):
    title: str
    summary: str
    type: InsightType = "finding"
    confidence: float = 0.5
    evidence: list[str] = Field(default_factory=list)
    sources: list[Source] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)


class GuardrailResult(BaseModel):
    name: str
    passed: bool
    detail: dict = Field(default_factory=dict)


class AuditEntry(BaseModel):
    timestamp: str
    session_id: str
    content_hash: str
    results: list[GuardrailResult] = Field(default_factory=list)
    overall_passed: bool = True
    model_versions: dict = Field(default_factory=dict)


class ResearchSession(BaseModel):
    id: str
    user_id: str = "anonymous"
    topic: str
    persona: Persona
    status: PipelinePhase = "intake"
    progress: float = 0.0
    agent_config: AgentConfig = Field(default_factory=AgentConfig)
    sources: list[Source] = Field(default_factory=list)
    selected_sources: list[Source] = Field(default_factory=list)
    insights: list[Insight] = Field(default_factory=list)
    audit_log: list[AuditEntry] = Field(default_factory=list)
    report_url: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""


class UserProfile(BaseModel):
    id: str
    email: str
    display_name: str = ""
    default_persona: Persona = "researcher"
    tier: Tier = "free"
    agent_config: AgentConfig = Field(default_factory=AgentConfig)
    created_at: str = ""
