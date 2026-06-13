## What you'll get

A working **ORION Insights** web app running in this Lovable preview, with the same look and flow as the original `frontend/` (Vite/JSX) project — ported into TanStack Start (TS).

The original repo is a Python FastAPI backend + Vite frontend. Lovable's runtime can't host the Python service, so this build focuses on the **frontend**, wired to a mocked research pipeline so the UI is fully clickable end-to-end. Real LLM wiring can be added later via Lovable Cloud + AI Gateway.

## Pages (TanStack routes)

- `/` — Landing / New Research form (topic, persona, confidence threshold, "Start research" CTA).
- `/session/$sid` — Live session view: phase pipeline, progress bar, source curation with checkboxes, links to report + validation.
- `/agents` — Agent model configuration (per-role model selector from the snapshot allowlist).
- `/auth` — Sign in / sign up screen (visual only for now; no real auth this pass).

A persistent top nav with the gradient "ORION" brand and section links.

## Visual design

Carry over the dark space aesthetic from `frontend/src/styles/app.css`:
- Background `#060612`, subtle particle field
- Gradient brand text (blue → purple → cyan)
- Glass cards with thin borders, rounded 14px
- Cyan/blue accent buttons with gradient primary CTA

Implemented through `src/styles.css` semantic tokens (no hard-coded colors in components) plus a `ParticleField` component ported from the original.

## Mock backend

A small in-memory service (`src/lib/research.ts`) simulates the pipeline:
- `startResearch()` returns a session id
- `getStatus(sid)` advances through phases (`intake → clarify → retrieve → score → analyse → insight → guardrail → report`) over ~15s
- `getSources(sid)` returns 6 plausible mock sources with confidence scores
- `curate(sid, urls)` / `submitArtifacts(sid, arts)` accept human-in-the-loop decisions

This lets the entire UX work in the preview without any external services.

## Out of scope for this pass

- The Python backend (`api/`, `agents/`, `orchestration/`) is not run — it remains in the repo unchanged for future GitHub sync.
- Real auth, real LLM calls, real reports. I'll mark these as "Connect Lovable Cloud" follow-ups.

## Technical details

- New files: `src/routes/index.tsx` (replace placeholder), `src/routes/session.$sid.tsx`, `src/routes/agents.tsx`, `src/routes/auth.tsx`, `src/components/Nav.tsx`, `src/components/ParticleField.tsx`, `src/lib/research.ts`, `src/lib/models.ts`.
- Update `src/routes/__root.tsx` to render the nav + `<Outlet />` and add `<ParticleField />`.
- Extend `src/styles.css` with ORION tokens (`--brand-bg`, `--brand-card`, `--brand-blue`, `--brand-purple`, `--brand-cyan`, `--gradient-brand`).
- Per-route `head()` with unique title/description/OG tags.
- No new npm dependencies.

After approval I'll build it in one pass, then verify the preview loads each route.
