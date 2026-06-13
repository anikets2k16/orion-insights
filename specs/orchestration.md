# ORION — Orchestration Spec (LangGraph)

State object: `core/state.py :: ResearchState` (a `TypedDict`).

## Nodes (each maps to an agent's `run`)
1. `intake`      — normalise request, seed state, deterministic `session_id`.
2. `clarify`     — Clarification Agent. May `interrupt` for user answers (≤3 Qs).
3. `retrieve`    — Contextual Retriever. Multi-source.
4. `score`       — Confidence Scorer (deterministic). Then `interrupt` for human
                   source curation (the 1st human decision, FR-2).
5. `analyse`     — Critical Analysis.
6. `insight`     — Insight Generator.
7. `guardrail`   — Guardrail Agent. Gate.
8. `report`      — Report Builder. Then `interrupt` for artifact selection
                   (the 2nd human decision).

## Edges
```
intake → clarify → retrieve → score → [human curate] → analyse → insight → guardrail
guardrail --pass--> report → [human artifacts] → complete
guardrail --block & attempts<3--> retrieve         (retry with narrowed scope)
guardrail --block & attempts==3--> failed          (status=guardrail_failed)
```

## Conditional routing
- After `score`: if 0 sources clear threshold → back to `retrieve` (broaden), else human curate.
- After `guardrail`: `route_guardrail(state)` returns `"report" | "retrieve" | "failed"`.

## Checkpointing
`MemorySaver` locally; `PostgresSaver` (sessions.state jsonb) in prod. `thread_id =
session_id`, so a session resumes from its last node (FR-4).

## Human-in-the-loop
LangGraph `interrupt()` at curate + artifacts. The API surfaces the interrupt as session
status `awaiting_user`; the client resumes via `POST /research/{id}/resume` with the choice.

## Determinism
Node order is fixed. All LLM nodes use the deterministic router. `attempts` counter and any
narrowing are pure functions of state. Replaying a session from checkpoint with the same
cache yields identical results (NFR-1).
