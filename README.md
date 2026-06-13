# ORION — Multi-Agent AI Deep Researcher

[![CI](https://github.com/anikets2k16/orion-researcher/actions/workflows/ci.yml/badge.svg)](https://github.com/anikets2k16/orion-researcher/actions/workflows/ci.yml)
![tests](https://img.shields.io/badge/tests-23%20passing-06ffa5)
![determinism](https://img.shields.io/badge/NFR--1-deterministic-00d4ff)
![python](https://img.shields.io/badge/python-3.11%2B-8b5cf6)
![license](https://img.shields.io/badge/license-MIT-7c85a0)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/anikets2k16/orion-researcher)

Spec-driven, **deterministic** implementation of the ORION architecture (Hackathon 2026,
Group 8). Real LLM calls (OpenAI/Anthropic) engineered for byte-identical reproducibility.
**Single repo:** Python backend at the root, React + Three.js frontend in [`frontend/`](frontend).

Built from the source docs in the parent folder (`architecture-docs.html`,
`usage-docs.html`, `bootstrap.sh`). Every component traces to a requirement in
[`specs/requirements.md`](specs/requirements.md) — see [`specs/traceability.md`](specs/traceability.md).

## How "deterministic + real LLMs" coexist (NFR-1)
LLMs are stochastic; providers don't promise bit-exactness even at `temperature=0`. ORION
closes that gap with a **content-addressed completion cache** that is the authoritative
determinism boundary. Full rationale: [`specs/determinism.md`](specs/determinism.md).

| Control | Where |
|---|---|
| `temperature=0`, `top_p=1`, fixed `seed` | `infrastructure/llm_router.py` |
| Snapshot-only model ids (no floating aliases) | `llm_router._validate` |
| SHA-256 keyed completion cache (replay) | `infrastructure/determinism.py::LLMCache` |
| Deterministic session ids + frozen clock | `infrastructure/determinism.py` |
| Seeded, stable-sorted scoring | `infrastructure/confidence_scorer.py` |
| Retrieval isolation (capture once, replay) | `agents/contextual_retriever/agent.py` |

`make verify-determinism` runs a session twice and asserts identical output hashes.

## Architecture
```
        Clarify → Retrieve → Score →[human curate]→ Analyse → Insight → Guardrail →[gate]→ Report →[human artifacts]
                                                                              │ block (<3) ↺ Retrieve
```
- **Orchestrator** — `orchestration/graph.py` (LangGraph state machine + framework-free
  `run_pipeline` driver used by tests/CLI).
- **9 agents** — `agents/*` (all subclass `BaseAgent`, stateless; ADR-003).
- **3 persona crews** — `crews/*` (ADR-004).
- **API** — FastAPI, `api/main.py` + `api/routes/*` (auth, research, agents, integrations, reports).
- **Frontend** — React + Vite + Three.js, `frontend/`.
- **Reports** — Jinja2 → HTML (+ WeasyPrint PDF), `reports/`.

## Quick start
```bash
# 1. Python deps + frontend deps
make install

# 2. Configure keys (real LLMs required — NFR-2)
cp .env.example .env   # add OPENAI_API_KEY, ANTHROPIC_API_KEY, TAVILY_API_KEY

# 3. Run API + frontend
make api          # http://localhost:8000/api/docs
make frontend     # http://localhost:3000

# Or one deterministic run from the CLI:
python scripts/run_research.py "AI in drug discovery" --persona researcher
```

## One-click deployment console
A styled local control panel (no dependencies — pure Python stdlib) that runs every step
with live streamed output: prerequisites, `.env` editor, install, tests, the determinism
gate, start API/frontend/Docker, and **create + push the GitHub repo**.

```bash
./deploy.sh           # or: python3 deploy/console.py   (double-click deploy.command on macOS)
# opens http://127.0.0.1:8900
```

Publishing to GitHub from the console needs a one-time `gh auth login` first; then the
"Create repo & push" button runs `gh repo create orion-researcher --private --source=. --push`.

## Cloud deploy (single repo → Render)
One `render.yaml` blueprint deploys the **whole app** from this single repo: `orion-api`
(FastAPI) + `orion-frontend` (static build of `frontend/`) + `orion-worker` (Celery) +
redis + postgres.

- Render → **New → Blueprint** → pick this repo → fill the `sync: false` keys
  (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`).
- After the API deploys, set the frontend service's `VITE_API_URL` to the `orion-api` URL,
  and add the frontend URL to `ORION_CORS_ORIGINS` on `orion-api`.
- CI-gated deploys: set repo secret `RENDER_DEPLOY_HOOK_URL` so the `deploy-render` job
  ships only after tests + the determinism gate pass.

**Prefer Lovable for the frontend?** Import this repo into Lovable with **root directory =
`frontend`** and set `VITE_API_URL` to your backend URL. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Tests (offline, no keys — NFR-6)
```bash
make test                 # 22 tests; provider call is patched, cache/agents/graph run real
make verify-determinism   # NFR-1 gate: same input → same output hash
```
The suite never touches the network: `tests/conftest.py` patches the provider boundary
only. The deterministic core (scoring, routing, hashing, reports) runs for real.

## Project layout
```
specs/            requirements, ADRs, data-model, orchestration, determinism, traceability
core/             pydantic models + LangGraph state
infrastructure/   determinism (cache/clock/ids), llm_router, confidence_scorer
agents/           9 agents
crews/            3 persona crews
orchestration/    LangGraph graph + run_pipeline
api/              FastAPI app, routes, session store
auth/             JWT issue/verify + dependency
integrations/     github, jira, confluence
reports/          generator + Jinja templates
frontend/         React + Vite + Three.js SPA
k8s/              deployment, HPA, KEDA scale-to-zero
scripts/          run_research, verify_determinism, generate_all_phase_reports, schema.sql
tests/            unit + integration (+ determinism gate)
```

## Status / honest scope
- ✅ Runs end-to-end deterministically offline (tests) and against real LLMs with keys.
- ✅ All 9 agents, orchestrator, crews, guardrails, API, reports, frontend, CI.
- ⚠️ KEDA scale-to-zero, Supabase Vault, real-time co-edit, webhook ingest are
  **scaffolded** (manifests/specs) but not exercised live — see `specs/requirements.md` §3.
```
