# ORION — Determinism Specification (NFR-1)

The headline non-functional requirement. "Deterministic" here means:

> Given the **same inputs**, the **same configuration**, and the **same pinned model
> snapshots**, a research run yields **byte-identical** agent outputs and reports.

We still call **real** LLMs (NFR-2). Determinism is engineered around them.

## Controls

### C1 — Sampling pinned to argmax
Every LLM request sets `temperature=0`, `top_p=1`. OpenAI requests also set a fixed
integer `seed` (`settings.llm_seed`, default `42`). This removes sampling variance to
the extent the providers allow.

### C2 — Model snapshots, never aliases
Only dated snapshot IDs are allowed (e.g. `gpt-4o-2024-08-06`,
`claude-3-5-sonnet-20241022`). Floating aliases like `gpt-4o` are rejected by the
LLM router so a provider-side model swap can never silently change outputs.

### C3 — Content-addressed response cache (the real guarantee)
Providers do **not** promise bit-exact determinism even at `temperature=0`. So every
LLM call is wrapped by a cache keyed on:

```
sha256( provider | model | seed | temperature | top_p | json(messages) )
```

On a cache hit the stored completion is returned without a network call. The cache is
the authoritative determinism boundary:
- First run with keys populates the cache (`.cache/llm/<key>.json`).
- Every subsequent run — and all deterministic tests — replay from cache, byte-identical,
  and need no network or keys.
- `ORION_LLM_CACHE_MODE`:
  - `read_write` (default) — replay if present, else call + store.
  - `read_only` — replay only; a miss raises (used in CI / offline tests).
  - `refresh` — ignore existing entries, call and overwrite (re-baseline).

### C4 — Deterministic identifiers & time
When `settings.deterministic=true`:
- `session_id = sha256(topic | persona | sorted(config))[:32]` (UUIDv5 form), not random.
- Timestamps come from `clock.now()`; in deterministic mode the clock is frozen to
  `settings.deterministic_epoch` so report hashes are stable. Real wall-clock in prod.

### C5 — Seeded non-LLM logic
Confidence scoring, source ordering, and any sampling use stable sorts and the fixed
seed. Source lists are sorted by `(confidence desc, url asc)` to break ties stably.

### C6 — Reproducible dependencies
All Python and Node deps are version-pinned. The scaffold is idempotent (re-runnable).

## Verification
`tests/` run in `read_only` cache mode: they assert that re-running a fixed input
reproduces a known output hash. CI never touches the network. A `make verify-determinism`
target runs the same session twice and diffs the report hashes.

## Where determinism is NOT guaranteed
Live web retrieval (Tavily/Arxiv results change over time). We isolate this: retrieval
results are captured into the session state and cached per session, so re-running an
*existing* session is deterministic even though a *fresh* search may differ. Fresh
searches are the one non-deterministic input and are logged as such in the audit trail.
