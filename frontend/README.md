# ORION Frontend

React + Vite + Three.js UI for ORION. Part of the single `orion-researcher` repo — the
Python backend lives one level up. This app talks to it over `VITE_API_URL`.

## Local dev
```bash
npm install
npm run dev          # http://localhost:3000
```
With no `VITE_API_URL`, the Vite dev proxy forwards `/api` → `http://localhost:8000`
(the local backend). Set `VITE_API_URL` to call a hosted backend instead.

## Deploy
- **Render (recommended, one repo):** the root `render.yaml` includes a `orion-frontend`
  static service built from this `frontend/` subdir. Set its `VITE_API_URL` to the
  `orion-api` URL after the API's first deploy.
- **Lovable:** point Lovable's GitHub import at this repo with **root directory = `frontend`**
  (Lovable's project settings allow a subdirectory), then set `VITE_API_URL`.

| Var | Purpose |
|-----|---------|
| `VITE_API_URL` | Base URL of the ORION backend. Blank = local Vite proxy. |
