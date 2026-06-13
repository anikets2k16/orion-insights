# ORION DeepSearch

> Deterministic, multi-agent research platform — same input, byte-identical output, every time.

[![Stack](https://img.shields.io/badge/stack-LangGraph%20%2B%20TanStack%20Start-7c9cff)](#tech-stack)
[![Determinism](https://img.shields.io/badge/NFR--1-deterministic-5ee0c1)](#determinism-nfr-1)
[![License](https://img.shields.io/badge/license-Proprietary-lightgrey)](#license)

ORION orchestrates 9 specialized AI agents through an 8-step LangGraph pipeline to produce reproducible, citation-backed research reports. Built on FastAPI + Celery on the server and TanStack Start v1 (React 19) on the client.

👉 **Full report:** [`docs/TECH_REPORT.html`](./docs/TECH_REPORT.html)

---

## Table of Contents

- [Highlights](#highlights)
- [LLMs](#llms)
- [Tech Stack](#tech-stack)
- [Agent Pipeline](#agent-pipeline)
- [Determinism (NFR-1)](#determinism-nfr-1)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Documentation](#documentation)
- [Skills](#skills)
- [License](#license)

---

## Highlights

- 🧠 **9 specialized agents** orchestrated by LangGraph
- 🔁 **Byte-identical reproducibility** via SHA-256 completion cache + snapshot-pinned models
- 🔌 **Multi-LLM**: OpenAI + Anthropic in production, Google Gemini at the edge
- 👥 **3 persona crews**: Researcher, Analyst, Reporter
- 🔗 **Connectors**: GitHub, Jira, Confluence, Tavily, Arxiv, SerpAPI
- 🛡️ **Privacy**: Microsoft Presidio for PII redaction
- 📄 **PDF reports** via Jinja2 + WeasyPrint

---

## LLMs

### Production Backend (Python) — snapshot-pinned, no floating aliases

| Role | Provider | Model |
| --- | --- | --- |
| Premium / Report | OpenAI | `gpt-4o-2024-08-06` |
| Fast / Retrieval | OpenAI | `gpt-4o-mini-2024-07-18` |
| Reasoning | Anthropic | `claude-3-7-sonnet-20250219` |
| Premium (alt) | Anthropic | `claude-3-5-sonnet-20241022` |
| Guardrail | Anthropic | `claude-3-haiku-20240307` |

### Frontend / Edge — Lovable AI Gateway

- Chat: `google/gemini-3-flash-preview`
- Images: `openai/gpt-image-2`
- Embeddings: `google/gemini-embedding-001`

No user API key required for Gateway models.

---

## Tech Stack

**Backend** — LangGraph `0.2.45`, FastAPI, Pydantic, Celery, Redis, Supabase (Postgres + JWT + RLS), Tavily, Arxiv, SerpAPI, Presidio, Jinja2, WeasyPrint, LangFuse, PyGithub, Jira, Confluence, pytest.

**Frontend** — TanStack Start v1, React 19, TanStack Router + Query, Vite 7, Tailwind CSS v4, Radix UI + shadcn/ui, Supabase Auth, Three.js, React Hook Form + Zod, Recharts, Lucide React.

**Infra** — Docker Compose, pgvector, Render, KEDA/Kubernetes (scaffolded), GitHub Actions.

---

## Agent Pipeline

```text
Client → FastAPI → LangGraph
        ├─ PlannerAgent
        ├─ RetrievalAgent      ─┐
        ├─ WebSearchAgent       │ parallel
        ├─ AcademicAgent       ─┘
        ├─ SynthesisAgent
        ├─ CritiqueAgent
        ├─ GuardrailAgent
        ├─ ReportAgent
        └─ MemoryAgent
      → Celery worker → Supabase + Redis
```

---

## Determinism (NFR-1)

The headline non-functional requirement. Every run is reproducible byte-for-byte:

- SHA-256 **content-addressed completion cache**
- `temperature=0` and fixed `seed` on every LLM call
- **Snapshot-only model enforcement** — CI fails on floating aliases
- Sorted tool outputs and stable JSON serialization

See [`specs/determinism.md`](./specs/determinism.md) for the full contract.

---

## Project Structure

```text
.
├── backend/            # FastAPI + LangGraph + Celery
│   ├── agents/         # 9 BaseAgent subclasses
│   ├── llm_router.py   # Model selection & snapshot pinning
│   └── models.ts       # Shared model registry
├── frontend/           # TanStack Start v1 (React 19)
├── specs/              # Requirements, ADRs, data model
├── docs/               # Reports & generated docs
│   └── TECH_REPORT.html
└── docker-compose.yml
```

---

## Getting Started

### Prerequisites

- Node 20+ and `bun` (frontend)
- Python 3.11+ (backend)
- Docker + Docker Compose (recommended)

### Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

The frontend will be at `http://localhost:5173` and the API at `http://localhost:8000`.

### Manual

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
bun install
bun dev
```

---

## Documentation

All design docs live in [`specs/`](./specs/):

| File | Contents |
| --- | --- |
| `requirements.md` | 25 FR + 7 NFR |
| `adrs.md` | 9 Architecture Decision Records |
| `determinism.md` | NFR-1 implementation contract |
| `data-model.md` | Postgres schema & RLS policies |
| `orchestration.md` | LangGraph topology & agent contracts |
| `traceability.md` | FR/NFR → code mapping |
| `DEPLOYMENT.md` | Render + Docker rollout |

---

## Skills

The skill extension points (`.workspace/skills/` and `.agents/skills/`) are currently **empty** — none active yet.

---

## License

Proprietary — © 2026 ORION DeepSearch. All rights reserved.