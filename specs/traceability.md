# Traceability Matrix (req → design → code → test)

| Req | Design | Code | Test |
|-----|--------|------|------|
| FR-1 pipeline | orchestration.md | `orchestration/graph.py` | `tests/integration/test_pipeline.py` |
| FR-2 2 human decisions | orchestration.md | `orchestration/graph.py` (interrupts) | `tests/integration/test_human_loop.py` |
| FR-3 LangGraph + retry | ADR-001 | `orchestration/graph.py::route_guardrail` | `tests/unit/test_routing.py` |
| FR-4 checkpoint/resume | orchestration.md | `orchestration/graph.py` (saver) | `tests/integration/test_resume.py` |
| FR-5 clarify | agents/clarification.md | `agents/clarification/agent.py` | `tests/unit/test_clarification.py` |
| FR-6 retrieve | agents/retriever.md | `agents/contextual_retriever/agent.py` | `tests/integration/test_pipeline.py` |
| FR-7 score | data-model.md | `infrastructure/confidence_scorer.py` | `tests/unit/test_confidence_scorer.py` |
| FR-8 analyse | agents/analysis.md | `agents/critical_analysis/agent.py` | `tests/unit/test_analysis.py` |
| FR-9 insight | agents/insight.md | `agents/insight_generator/agent.py` | `tests/unit/test_insight.py` |
| FR-10 guardrail | guardrails.md | `agents/guardrail/agent.py` | `tests/unit/test_guardrail.py` |
| FR-11 report | ADR-007 | `reports/generator.py` + templates | `tests/unit/test_reports.py` |
| FR-12 integrations | ADR-005 | `integrations/*.py` | `tests/unit/test_integrations.py` |
| FR-14 model swap | ADR-002/009 | `infrastructure/llm_router.py` | `tests/unit/test_llm_router.py` |
| FR-15 crews | ADR-004 | `crews/*` | `tests/unit/test_crews.py` |
| FR-17 API | ADR-005 | `api/main.py`, `api/routes/*` | `tests/integration/test_api.py` |
| FR-18 auth | ADR-006 | `auth/*` | `tests/integration/test_auth.py` |
| FR-21 phase reports | ADR-007 | `reports/generator.py`, `scripts/generate_all_phase_reports.py` | `tests/unit/test_reports.py` |
| FR-22 validation report | guardrails.md | `reports/generator.py::generate_validation_report` | `tests/unit/test_reports.py` |
| FR-24 frontend | ADR-008 | `frontend/src/*` | manual / Playwright (stretch) |
| NFR-1 determinism | determinism.md | `infrastructure/determinism.py`, `llm_router.py` | `tests/unit/test_determinism.py` |
| NFR-2 real LLMs | determinism.md | `llm_router.py` (hard-fail on missing key) | `tests/unit/test_llm_router.py` |
| NFR-5 security | data-model.md | `scripts/schema.sql` (RLS), `auth/*` | `tests/integration/test_auth.py` |
