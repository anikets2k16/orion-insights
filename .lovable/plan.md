## Goal

Two small, additive changes — no functional rewrites, easy to revert via chat history if either misbehaves.

1. **Post‑SSO refresh fix (frontend)** — after Google sign-in, the protected pages load empty until a manual refresh, because their data fetches run once on mount (before Supabase finishes setting the session) and never re-run.
2. **Pydantic‑structured report (backend)** — the report rendered below the insights is currently a free‑form LLM string. Replace it with a validated Pydantic schema and render the structured fields in the HTML template.

Both changes are isolated; the previous wiring (ORION API client, polling, source curation, report HTML embed) stays exactly as it is.

---

## Part 1 — Fix: data loads only after manual refresh post-SSO

### Diagnosis
- `src/routes/__root.tsx` already listens to `onAuthStateChange` and calls `router.invalidate()` on `SIGNED_IN`, but the affected pages (`_authenticated/index.tsx`, `history.tsx`, `profile.tsx`, `agents.tsx`) and `useProfile()` fetch via `useEffect(() => …, [])` — `router.invalidate()` does not re-run a `useEffect` whose deps haven't changed.
- When the lovable OAuth callback hits `/`, the `_authenticated` `beforeLoad` runs once with `getUser()` (succeeds, the gate passes), components mount, and their `useEffect`s fire — but at that exact moment `supabase.auth.getUser()` inside the page's own fetch can race the persisted-session write, returning null → empty UI until refresh.

### Fix (minimal, non-breaking)
- **`src/lib/profile.ts`** — make `useProfile()` subscribe to `onAuthStateChange` and refetch on `SIGNED_IN` / `USER_UPDATED`. Same hook signature, so all callers keep working.
- **`src/routes/_authenticated/history.tsx`** — extract `load()` (already exists) and add a one-time `onAuthStateChange` subscription that calls `load()` again on `SIGNED_IN`.
- **`src/routes/__root.tsx`** — on `SIGNED_IN` also call `queryClient.invalidateQueries()` (cheap, future-proof; today we have no Query consumers, but it costs nothing).
- No change to `_authenticated/route.tsx` (managed gate), no change to the Lovable OAuth flow.

### Rollback
Single chat-history revert restores all three files. None of the changes touch types, routes, or the API client.

---

## Part 2 — Pydantic-structured report below insights

### Current shape
`agents/report_builder/agent.py` asks the LLM for a free-form executive summary string and stuffs it into `session.executive_summary`. The Jinja template renders that string verbatim. Insights are already structured (list of `Insight` Pydantic models). The *report* section is the unstructured part.

### New shape — `core/models.py`
Add (do not modify existing models):

```python
class KeyFinding(BaseModel):
    title: str
    detail: str
    confidence: float = 0.5
    citations: list[int] = Field(default_factory=list)

class ReportSection(BaseModel):
    title: str
    body: str
    citations: list[int] = Field(default_factory=list)

class Recommendation(BaseModel):
    action: str
    rationale: str
    priority: Literal["low", "medium", "high"] = "medium"

class RiskOrGap(BaseModel):
    description: str
    citations: list[int] = Field(default_factory=list)

class StructuredReport(BaseModel):
    executive_summary: str
    key_findings: list[KeyFinding] = Field(default_factory=list)
    sections: list[ReportSection] = Field(default_factory=list)
    recommendations: list[Recommendation] = Field(default_factory=list)
    risks_and_gaps: list[RiskOrGap] = Field(default_factory=list)
```

### Builder change — `agents/report_builder/agent.py`
- Ask the LLM for **JSON only**, parse with `StructuredReport.model_validate_json(...)`.
- On any parse/validation error, fall back to the existing free-form summary path so the pipeline never breaks (backwards-compatible rollback path baked in).
- Pass `structured_report=report.model_dump()` into the Jinja context alongside the existing `executive_summary` (kept for the header) so old templates still work.

### Template change — `reports/templates/research_output.html`
Add a new block below the existing Insights / Sources sections that renders the structured report when present (`{% if session.structured_report %}`), with subsections for Key Findings, Sections, Recommendations, Risks & Gaps. Existing markup (executive summary card, synthesis, insights, sources) is untouched, so any session that fell back to the free-form path still renders correctly.

### Frontend
No changes. The frontend embeds the backend's HTML via `dangerouslySetInnerHTML`, so the new section appears automatically.

### Rollback
- Revert the two Python files and the template via chat history.
- The fallback branch in `ReportBuilderAgent.run` means even without revert, a bad LLM response degrades gracefully to today's behavior — it won't break any working session.

---

## Out of scope (explicit)
- No change to the ORION API client, polling, curation, or session route.
- No change to auth providers, the `_authenticated` gate, or `attachSupabaseAuth`.
- No DB migrations.
- No change to other agents, orchestration graph, or guardrails.

## Verification
1. Sign in with Google in an incognito window → land on `/` → New / History / Profile show data immediately, no refresh needed.
2. Run a research session end-to-end → report HTML below insights now contains "Key Findings", "Sections", "Recommendations", "Risks & Gaps" subsections populated from the validated Pydantic object.
3. Force a bad LLM response (or run with cache) → fallback path renders the old free-form summary; nothing 500s.
