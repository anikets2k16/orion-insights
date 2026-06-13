## Goal

Make the Lovable UI a true client of the Python multi-agent ORION engine in `api/` + `agents/` + `orchestration/`, replacing the mock pipeline (`src/lib/research.ts`) and the local TanStack server-fn shims (`src/lib/research.functions.ts`). The deterministic engine, NeMo guardrails, Celery workers, etc. stay where they belong — in the Python service.

Architecture once done:

```text
Browser (Lovable, TanStack Start)
   │  fetch (Bearer = Supabase JWT)
   ▼
ORION FastAPI on Render  ──► LangGraph + 9 agents + cache (NFR-1)
   │
   └── Postgres (Render) + Redis + Celery worker
```

## Phase 1 — Deploy the Python backend (you do this, outside Lovable)

The repo already ships `render.yaml`, `Dockerfile`, `requirements.txt`. Steps:

1. Push the repo to GitHub (already synced via Lovable).
2. Render → **New → Blueprint** → pick this repo. It provisions `orion-api`, `orion-worker`, `orion-redis`, `orion-db` from `render.yaml`.
3. Fill the `sync: false` secrets in Render: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `ORION_CORS_ORIGINS=https://orion-deepsearch.lovable.app,https://id-preview--e31e5975-3b4c-4d0f-92b5-f95d3047b4c2.lovable.app`.
4. Copy the resulting `https://orion-api-xxxx.onrender.com` URL — you'll paste it back into Lovable as a secret.
5. Confirm `GET /api/health` returns `{"status":"ok","deterministic":true,...}`.

I cannot do any of this from Lovable (no shell to Render, no way to set Render env). If you'd rather not use Render, the same FastAPI also runs via the included `docker-compose.yml` or any host that runs Python 3.11.

## Phase 2 — Frontend rewiring (this is what I'll implement in Lovable)

### 2a. Configuration

- Add secret `ORION_API_URL` via Lovable Cloud secrets (server-side only).
- Add public env `VITE_ORION_API_URL` (same value) for browser polling/streaming.
- Document both in `.env.example`.

### 2b. New typed API client — `src/lib/orion-api.ts`

Thin wrapper around `fetch` against `VITE_ORION_API_URL`, mirroring the FastAPI contract:

```text
POST   /api/research/start          → { session_id }
GET    /api/research/{sid}/status   → { status, progress, current_phase, report_url }
GET    /api/research/{sid}/sources  → { sources[] }
POST   /api/research/{sid}/curate   → { selected_urls[] }      (human decision #1)
POST   /api/research/{sid}/artifacts→ { artifacts[] }          (human decision #2)
GET    /api/reports/{sid}           → markdown/PDF URL
GET    /api/agents/                 → model registry for selector UI
```

Attaches `Authorization: Bearer <supabase-access-token>` from the active Supabase session so the Python side can validate (existing `api/routes/auth.py` already accepts JWT).

### 2c. Replace mocks

- **Delete** `src/lib/research.functions.ts` (all 8 fake server fns) — the Python backend is the source of truth.
- **Replace** `src/lib/research.ts`'s `startResearch` / `getSession` / `updateSession` with passthroughs to the API client (keep the `SessionState`, `Phase`, `Source` types — they already match the FastAPI shapes closely; I'll align field names where they differ, e.g. `scored_sources` ↔ `sources`).
- **Rewrite** `src/routes/_authenticated/index.tsx` to call `orionApi.startResearch(...)` instead of `startResearch()` + the local-only mock. Keep the Supabase `research_sessions` insert as a metadata mirror (so History page still works offline-style).
- **Rewrite** `src/routes/_authenticated/session.$sid.tsx` to:
  - poll `/status` every 1.5s until `complete`,
  - render real `/sources` and let the user submit `/curate`,
  - show the artifact picker after sources are curated and call `/artifacts`,
  - fetch and render the final report from `/reports/{sid}`.
  - drop all `useServerFn(...)` wrappers; remove the `lib/research.functions` imports.
- **Update** `src/routes/_authenticated/history.tsx` to merge Supabase-stored session rows with `/status` for each.
- **Update** `src/routes/_authenticated/agents.tsx` (already exists) to fetch from `/api/agents/` and POST selections back as `selected_agent_models` on session start.

### 2d. CORS / auth

- Backend already has `CORSMiddleware`; you set `ORION_CORS_ORIGINS` to the Lovable origins in Phase 1.
- Browser sends the Supabase access token; backend's `/api/auth` validates it (existing code). No service-role exposure.

### 2e. Determinism truth-in-UI

- Remove the "Deterministic by construction" bullet from the mock copy and reattach it to the live `/api/health` response (`deterministic: true`) and the cache-hit indicator returned by `/status`.

### 2f. Docs

- Update `docs/TECH_REPORT.html` and `README.md`: deployment diagram, two-service split, env-var table, and a "How NFR-1 is enforced (server-side only)" section. Drop any claim that determinism runs in the Lovable bundle.

## Phase 3 — Verification (I'll do once Phase 1 is done and you give me the URL)

1. `curl $ORION_API_URL/api/health` — expect 200 + `deterministic:true`.
2. Open preview → sign in → start a session → confirm `POST /api/research/start` in browser DevTools, `status` polling, sources render, curation persists, report renders.
3. Re-run the same topic + persona — confirm same `session_id` prefix / same content hash (cache hit visible in `/status`).
4. Sign-out / sign-in flow still works through Supabase; backend rejects calls without a bearer.

## What I need from you to start Phase 2

1. Confirm Phase 1 is done and give me the `ORION_API_URL`. If you want, I can implement Phase 2 first against a placeholder URL and you swap the secret later — the UI will just error-toast until the backend is reachable.
2. Confirm the backend should validate the Supabase JWT (preferred), or if you'd rather it issue its own JWT via the existing `/api/auth` endpoints (means a second login).

## Non-goals (explicitly out of scope here)

- Re-implementing agents/guardrails/cache in TypeScript. They live in Python.
- Keeping both `frontend/` (old React app) and `src/` (Lovable) in sync — pick one source of truth for the UI; I recommend retiring `frontend/` or leaving it untouched as a reference and treating Lovable as production.
- Edge functions / Lovable AI Gateway for the pipeline. The Python service owns LLM calls so NFR-1's content-addressed cache still applies.
