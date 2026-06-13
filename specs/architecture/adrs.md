# Architecture Decision Records

Short, numbered, immutable. Each records one decision and why.

## ADR-001 — LangGraph for orchestration
**Decision:** Use LangGraph `StateGraph` as the orchestrator.
**Why:** Stateful multi-agent graphs with conditional edges, loops, checkpointing, and
human-in-the-loop interrupts — exactly the 8-step pipeline with the guardrail retry loop
and the two human decision points (FR-1..FR-4). Alternatives (raw function calls, CrewAI)
lack first-class conditional-edge + checkpoint semantics.

## ADR-002 — Deterministic LLM wrapper over a content-addressed cache
**Decision:** All model access goes through `infrastructure/llm_router.py`, which enforces
snapshot-only model IDs and wraps calls in a SHA-256 keyed disk cache.
**Why:** Reconciles "real LLMs" (NFR-2) with "deterministic" (NFR-1). Providers don't
guarantee bit-exactness at temp=0; the cache does. See `determinism.md`.

## ADR-003 — Agents are stateless; state lives in the graph
**Decision:** Every agent subclasses `BaseAgent` and implements `async run(state) -> state`.
No agent holds session state between calls.
**Why:** Enables checkpointing, resume, horizontal scaling, and deterministic replay.

## ADR-004 — Crew = typed trio per persona
**Decision:** A `BaseCrew` binds a retrieval + analysis + output agent per persona. The
orchestrator selects the crew at runtime from `state.persona`.
**Why:** Tuned behaviour per use case without forking the pipeline (FR-15/16).

## ADR-005 — FastAPI + Pydantic v2, Celery + Redis for async
**Decision:** FastAPI for the API; Celery/Redis to run pipelines off the request thread.
**Why:** Async REST, OpenAPI for free, background tasks, queue depth as the autoscaler
signal (FR-17, FR-20, FR-13).

## ADR-006 — Supabase (Postgres) + JWT, row-level isolation
**Decision:** Postgres via Supabase; JWT bearer auth; per-user rows.
**Why:** User accounts, history, audit log, integration configs in one managed store
with RLS (FR-18/19, NFR-5).

## ADR-007 — Jinja2 templates, one template → HTML + PDF
**Decision:** Jinja2 renders phase + research reports; WeasyPrint converts the same HTML
to PDF.
**Why:** Single source per report; matches FR-21..23.

## ADR-008 — React + Vite + Three.js frontend
**Decision:** React (Vite) SPA, Three.js for the holographic backdrop, talking to the API
over REST + polling.
**Why:** Matches the documented UI/aesthetic (FR-24/25) and keeps the frontend decoupled.

## ADR-009 — Snapshot-only model policy
**Decision:** The router rejects non-dated model IDs.
**Why:** Determinism (C2) — a floating alias could change outputs server-side.
