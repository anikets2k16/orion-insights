# ORION — Deployment Checklist

One page. Pick local for dev, or Render for hosted. **Single repo**
[`orion-researcher`](https://github.com/anikets2k16/orion-researcher) — Python backend at
the root, React frontend in `frontend/`.

---

## A. Local (one machine)

**Prereqs:** Python 3.11+, Node 20, Docker (optional), real API keys.

```bash
# fastest: the deployment console (pure stdlib, no install needed)
./deploy.sh                       # opens http://127.0.0.1:8900 — click through steps 1–6

# or by hand:
cp .env.example .env              # add OPENAI_API_KEY, ANTHROPIC_API_KEY, TAVILY_API_KEY
make install                      # python venv + frontend npm install
make api                          # http://localhost:8000/api/docs
make frontend                     # http://localhost:3000
```

- [ ] Prereqs green in the console
- [ ] `.env` has the 3 LLM keys
- [ ] API health OK: `curl localhost:8000/api/health`
- [ ] `make test` → 23 passing · `make verify-determinism` → identical hash

---

## B. Whole app → Render (single repo, one blueprint)

- [ ] Render → **New → Blueprint** → connect `orion-researcher` (auth your GitHub if asked)
- [ ] Render reads `render.yaml` → creates **api + frontend (static) + worker + redis + postgres**.
      Fill the `sync: false` secrets: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`
- [ ] First deploy → note the API URL, e.g. `https://orion-api.onrender.com`
- [ ] Verify API: open `https://orion-api.onrender.com/api/health` → `{"status":"ok"}`
- [ ] (optional) CI-gated deploys: add repo secret `RENDER_DEPLOY_HOOK_URL` (a Render deploy
      hook) so the `deploy-render` job ships only after tests + the determinism gate pass.

---

## C. Wire the frontend ↔ backend

- [ ] Set the **`orion-frontend`** service's **`VITE_API_URL`** = the `orion-api` URL → redeploy it
- [ ] Set **`ORION_CORS_ORIGINS`** on **`orion-api`** = the frontend URL
      (e.g. `https://orion-frontend.onrender.com`) → redeploy api
- [ ] Open the frontend URL · sign up · run a research session

> **Prefer Lovable for the frontend?** Import this repo into Lovable with
> **root directory = `frontend`**, set `VITE_API_URL`, and add the Lovable URL to
> `ORION_CORS_ORIGINS`. The backend still comes from B.

---

## Environment variables (reference)

| Var | Where | Required | Notes |
|-----|-------|----------|-------|
| `OPENAI_API_KEY` | backend | ✅ | real LLMs (NFR-2) |
| `ANTHROPIC_API_KEY` | backend | ✅ | real LLMs (NFR-2) |
| `TAVILY_API_KEY` | backend | ✅ | web retrieval |
| `JWT_SECRET` | backend | ✅ | Render `generateValue` handles it |
| `ORION_CORS_ORIGINS` | backend | ✅ (hosted) | must include the Lovable URL |
| `ORION_TASK_BACKEND` | backend | — | `celery` in prod, `background` local |
| `ORION_SESSION_BACKEND` | backend | — | `redis` in prod, `memory` local |
| `ORION_LLM_CACHE_MODE` | backend | — | `read_write` / `read_only` / `refresh` |
| `REDIS_URL`, `DATABASE_URL` | backend | — | wired by `render.yaml` |
| `VITE_API_URL` | frontend | ✅ (hosted) | the Render API URL |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Frontend calls fail / CORS error in console | Add the Lovable URL to `ORION_CORS_ORIGINS`, redeploy API |
| `RuntimeError: OPENAI_API_KEY missing` | Set the LLM keys (the live path hard-fails by design, NFR-2) |
| Research stuck "queued" | Worker not running — ensure the `orion-worker` service is up (Render) |
| Determinism gate differs | Re-baseline cache: `ORION_LLM_CACHE_MODE=refresh` with valid keys |
| `gh repo create` denied | `gh auth login` first |
