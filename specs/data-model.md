# ORION — Data Model

## Pydantic models (`core/models.py`)

```
Persona        = Literal["content_creator", "product_manager", "researcher"]
PipelinePhase  = Literal["intake","clarify","retrieve","score","analyse",
                         "insight","guardrail","report","complete","failed"]
Tier           = Literal["free","pro","enterprise"]

AgentConfig:
  retriever_model: str = "gpt-4o-mini-2024-07-18"
  analysis_model:  str = "claude-3-5-sonnet-20241022"
  insight_model:   str = "claude-3-7-sonnet-20250219"
  report_model:    str = "gpt-4o-2024-08-06"
  clarification_model: str = "gpt-4o-mini-2024-07-18"
  confidence_threshold: float = 0.7
  max_sources: int = 10

Source:
  url, title, content, source_type, published_date?, confidence: float = 0.0,
  cross_validation_score: float = 0.5, selected: bool = False

Insight:
  title, summary, type: Literal["hypothesis","trend","opportunity","finding"],
  confidence: float, evidence: list[str], sources: list[Source],
  acceptance_criteria: list[str] = []

GuardrailResult: name, passed: bool, detail: dict
AuditEntry: timestamp, session_id, content_hash, results: list[GuardrailResult],
            overall_passed: bool, model_versions: dict

ResearchSession:
  id, user_id, topic, persona, status: PipelinePhase, progress: float,
  agent_config: AgentConfig, sources: list[Source], selected_sources: list[Source],
  insights: list[Insight], audit_log: list[AuditEntry],
  report_url?, created_at, updated_at

UserProfile:
  id, email, display_name, default_persona: Persona, tier: Tier,
  agent_config: AgentConfig, created_at
```

## Postgres schema (`scripts/schema.sql`)
- `users(id uuid pk, email unique, display_name, default_persona, tier, agent_config jsonb, created_at)`
- `sessions(id uuid pk, user_id fk, topic, persona, status, progress, state jsonb, created_at, updated_at)`
- `audit_log(id bigserial pk, session_id fk, ts, content_hash, entry jsonb)` — append-only
  (no UPDATE/DELETE grant; enforced by trigger)
- `integration_configs(user_id fk, provider, config jsonb, encrypted bool)`

RLS: every table keyed by `user_id`; policy `user_id = auth.uid()`.
