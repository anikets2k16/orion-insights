# ORION — Requirements Specification

> Source of truth. Every code artifact traces to a requirement ID here. Derived
> from `architecture-docs.html` and `usage-docs.html`. See `traceability.md`.

Status legend: `MUST` (this build), `SHOULD` (best-effort), `STRETCH` (scaffolded).

---

## 1. Functional Requirements (FR)

### 1.1 Research pipeline
- **FR-1** `MUST` — An 8-step research pipeline: Intake → Clarify → Retrieve → Score →
  Analyse → Insight → Guardrail → Report. (`usage-docs` "Running a Research Session")
- **FR-2** `MUST` — The user makes exactly two decisions: **source curation** (step 5)
  and **artifact selection** (steps 6–8). All other steps are automated.
- **FR-3** `MUST` — Orchestration is a stateful LangGraph state machine with conditional
  edges and a guardrail-reject → retry-retrieve loop (max 3 attempts).
- **FR-4** `MUST` — Pipeline state is checkpointed so a session can resume.

### 1.2 Agents (9)
- **FR-5** `MUST` — Clarification Agent: ≤3 targeted questions, context-aware slot filling.
- **FR-6** `MUST` — Contextual Retriever: multi-source parallel retrieval (Tavily + Arxiv,
  SerpAPI fallback), returns sources with provenance.
- **FR-7** `MUST` — Confidence Scorer: deterministic 4-axis score
  (recency × authority × relevance × cross-validation). No LLM.
- **FR-8** `MUST` — Critical Analysis: synthesis, contradiction detection, claim→evidence
  linking with citations, source credibility scoring.
- **FR-9** `MUST` — Insight Generator: chain-of-thought hypotheses, trend extrapolation,
  hallucination self-check before output.
- **FR-10** `MUST` — Guardrail Agent: hallucination check, PII redaction (Presidio),
  bias detection, topic policy, audit entry with SHA-256 content hash.
- **FR-11** `MUST` — Report Builder: persona-templated HTML report + PDF, inline citations.
- **FR-12** `MUST` — Integration Agent: push findings to GitHub / Jira / Confluence (write).
- **FR-13** `SHOULD` — Autoscaler Agent: emits scaling signals from queue depth/latency.
- **FR-14** `MUST` — Every agent's LLM model is hot-swappable per session and per user.

### 1.3 Personas / crews
- **FR-15** `MUST` — Three persona crews: content_creator, product_manager, researcher,
  each a typed trio (retrieval + analysis + output) subclassing `BaseCrew`.
- **FR-16** `SHOULD` — Adding a persona = 3 agents + a `BaseCrew` subclass + registration.

### 1.4 API & accounts
- **FR-17** `MUST` — FastAPI app exposing /auth, /research, /agents, /integrations, /reports.
- **FR-18** `MUST` — JWT auth (Supabase-compatible); per-user research history & config.
- **FR-19** `MUST` — `UserProfile` + `AgentConfig` persisted (Postgres / Supabase).
- **FR-20** `SHOULD` — Celery + Redis run research as background tasks.

### 1.5 Reports
- **FR-21** `MUST` — Generate 5 SDLC phase HTML reports: Design, Plan, Build, Test, Validate.
- **FR-22** `MUST` — Validation report: audit trail + traceability matrix + SHA-256 signature.
- **FR-23** `SHOULD` — PDF export via WeasyPrint.

### 1.6 Frontend
- **FR-24** `MUST` — React UI: auth, new-research, live session view, source-curation
  decision UI, artifact selection, report viewer, agent model-swap settings.
- **FR-25** `SHOULD` — Three.js holographic backdrop matching the docs' aesthetic.

---

## 2. Non-Functional Requirements (NFR)

- **NFR-1 Determinism** `MUST` — Given identical inputs + config + model snapshots, a
  research run produces byte-identical agent outputs and reports. Achieved via
  `temperature=0`, pinned model snapshot IDs, fixed `seed`, a content-addressed
  response cache, deterministic IDs/timestamps in deterministic mode, and seeded
  scoring. See `determinism.md`. This NFR overrides convenience everywhere.
- **NFR-2 Real LLMs** `MUST` — Production path calls real OpenAI/Anthropic; no mock
  fallback at runtime. Missing keys = hard fail with a clear message.
- **NFR-3 Reproducible builds** `MUST` — Pinned dependency versions; idempotent scaffold.
- **NFR-4 Observability** `SHOULD` — LangFuse traces + Prometheus metrics.
- **NFR-5 Security** `MUST` — Secrets from env only; PII redacted pre-store; audit log
  append-only; per-user row-level isolation.
- **NFR-6 Testability** `MUST` — Unit + integration + E2E; deterministic tests need no keys
  (they hit the cache / deterministic layer, never the network).
- **NFR-7 Portability** `SHOULD` — Docker compose for local; K8s + KEDA manifests for prod.

---

## 3. Out of scope (this build)
Real KEDA scale-to-zero on a live cluster; Supabase Vault encryption; team real-time
co-edit; webhook ingestion. These are scaffolded (manifests/specs) but not run live.
