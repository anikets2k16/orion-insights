"""LangGraph orchestrator (FR-1..FR-4, specs/orchestration.md).

Builds the 8-step research state machine with the guardrail-reject retry loop and the
two human decision points. Node order is fixed for determinism (NFR-1).

The two human decisions (source curation, artifact selection) are modelled as explicit
status pauses (`awaiting_user`) rather than graph interrupts so the same graph runs
identically under the API, Celery, or a direct call. `run_pipeline` drives it end to end
when selections are supplied up front (used by tests + the deterministic CLI).
"""
from __future__ import annotations

from typing import Any, Callable

from agents.autoscaler.agent import AutoscalerAgent
from agents.clarification.agent import ClarificationAgent
from agents.confidence_scorer.agent import ConfidenceScorerAgent
from agents.guardrail.agent import GuardrailAgent
from agents.report_builder.agent import ReportBuilderAgent
from config import get_settings
from crews.base_crew import get_crew
from infrastructure.determinism import now_iso, session_id

try:  # LangGraph is optional at import time so unit tests can run without it
    from langgraph.graph import END, StateGraph
    from langgraph.checkpoint.memory import MemorySaver

    _HAS_LANGGRAPH = True
except Exception:  # pragma: no cover
    _HAS_LANGGRAPH = False


# ── node implementations ────────────────────────────────────────────────────
async def node_intake(state: dict[str, Any]) -> dict[str, Any]:
    cfg = state.get("agent_config", {})
    sid = state.get("session_id") or session_id(state["topic"], state["persona"], cfg)
    crew = get_crew(state["persona"], cfg)
    return {
        **state,
        "session_id": sid,
        "analysis_focus": crew.analysis_focus(),
        "report_template": crew.report_template,
        "default_artifacts": crew.default_artifacts(),
        "created_at": state.get("created_at") or now_iso(),
        "guardrail_attempts": 0,
        "status": "intake",
        "progress": 0.05,
    }


async def node_clarify(state: dict[str, Any]) -> dict[str, Any]:
    out = await ClarificationAgent(state.get("agent_config", {}).get("clarification_model")).run(state)
    out["progress"] = 0.15
    return out


async def node_retrieve(state: dict[str, Any]) -> dict[str, Any]:
    crew = get_crew(state["persona"], state.get("agent_config", {}))
    out = await crew.retriever.run(state)
    out["progress"] = 0.35
    return out


async def node_score(state: dict[str, Any]) -> dict[str, Any]:
    out = await ConfidenceScorerAgent().run(state)
    # default selection = sources above threshold (UI lets the human override, FR-2)
    if not out.get("selected_sources"):
        out["selected_sources"] = [s for s in out["scored_sources"] if s.get("above_threshold")]
    out["progress"] = 0.45
    return out


async def node_analyse(state: dict[str, Any]) -> dict[str, Any]:
    crew = get_crew(state["persona"], state.get("agent_config", {}))
    out = await crew.analyst.run(state)
    out["progress"] = 0.6
    return out


async def node_insight(state: dict[str, Any]) -> dict[str, Any]:
    crew = get_crew(state["persona"], state.get("agent_config", {}))
    out = await crew.insighter.run(state)
    out["progress"] = 0.75
    return out


async def node_guardrail(state: dict[str, Any]) -> dict[str, Any]:
    out = await GuardrailAgent().run(state)
    out["progress"] = 0.85
    return out


async def node_report(state: dict[str, Any]) -> dict[str, Any]:
    out = await ReportBuilderAgent(state.get("agent_config", {}).get("report_model")).run(state)
    out["status"] = "complete"
    out["progress"] = 1.0
    return out


async def node_failed(state: dict[str, Any]) -> dict[str, Any]:
    return {**state, "status": "failed", "error": "guardrail_failed", "progress": 1.0}


# ── conditional routing ─────────────────────────────────────────────────────
def route_guardrail(state: dict[str, Any]) -> str:
    """pass → report · block & attempts<max → retrieve · else → failed (FR-3)."""
    if state.get("guardrail_passed"):
        return "report"
    if state.get("guardrail_attempts", 0) < get_settings().max_guardrail_retries:
        return "retrieve"
    return "failed"


# ── graph assembly ──────────────────────────────────────────────────────────
def build_graph():
    """Compile the LangGraph state machine (requires langgraph installed)."""
    if not _HAS_LANGGRAPH:
        raise RuntimeError("langgraph not installed; use run_pipeline() for the lite path.")
    from core.state import ResearchState

    g = StateGraph(ResearchState)
    g.add_node("intake", node_intake)
    g.add_node("clarify", node_clarify)
    g.add_node("retrieve", node_retrieve)
    g.add_node("score", node_score)
    g.add_node("analyse", node_analyse)
    g.add_node("insight", node_insight)
    g.add_node("guardrail", node_guardrail)
    g.add_node("report", node_report)
    g.add_node("failed", node_failed)

    g.set_entry_point("intake")
    g.add_edge("intake", "clarify")
    g.add_edge("clarify", "retrieve")
    g.add_edge("retrieve", "score")
    g.add_edge("score", "analyse")
    g.add_edge("analyse", "insight")
    g.add_edge("insight", "guardrail")
    g.add_conditional_edges(
        "guardrail", route_guardrail,
        {"report": "report", "retrieve": "retrieve", "failed": "failed"},
    )
    g.add_edge("report", END)
    g.add_edge("failed", END)
    return g.compile(checkpointer=MemorySaver())


# ── framework-free driver (deterministic, used by tests + CLI) ──────────────
_NODES: list[tuple[str, Callable]] = [
    ("intake", node_intake),
    ("clarify", node_clarify),
    ("retrieve", node_retrieve),
    ("score", node_score),
    ("analyse", node_analyse),
    ("insight", node_insight),
    ("guardrail", node_guardrail),
]


async def run_pipeline(state: dict[str, Any]) -> dict[str, Any]:
    """Run the full pipeline without LangGraph, honouring the guardrail retry loop.

    Selections may be pre-seeded in `state['selected_sources']` /
    `state['selected_artifacts']`; otherwise the defaults from node_score apply.
    """
    for _, fn in _NODES:
        state = await fn(state)
    while True:
        route = route_guardrail(state)
        if route == "report":
            return await node_report(state)
        if route == "failed":
            return await node_failed(state)
        # retry: re-run retrieve→guardrail
        for name, fn in _NODES:
            if name in ("intake", "clarify"):
                continue
            state = await fn(state)
