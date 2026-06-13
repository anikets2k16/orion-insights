"""LangGraph pipeline state (specs/orchestration.md).

A TypedDict so LangGraph can checkpoint it. Agents read/write keys here; they hold no
state of their own (ADR-003).
"""
from __future__ import annotations

from typing import Any, TypedDict


class ResearchState(TypedDict, total=False):
    # identity / config
    session_id: str
    user_id: str
    topic: str
    persona: str
    agent_config: dict[str, Any]
    confidence_threshold: float
    max_sources: int

    # clarify
    clarification_questions: list[str]
    clarification_answers: list[str]
    brief: str

    # retrieve / score
    raw_sources: list[dict[str, Any]]
    scored_sources: list[dict[str, Any]]
    selected_sources: list[dict[str, Any]]

    # analyse / insight
    analysis: dict[str, Any]
    synthesised_content: str
    insights: list[dict[str, Any]]

    # guardrail
    guardrail_results: dict[str, Any]
    guardrail_passed: bool
    guardrail_attempts: int
    safe_content: str
    audit_entry: dict[str, Any]
    audit_log: list[dict[str, Any]]

    # report / control
    selected_artifacts: list[str]
    report_html: str
    report_url: str
    status: str
    progress: float
    error: str
