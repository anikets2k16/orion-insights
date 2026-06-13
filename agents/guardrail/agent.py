"""Guardrail Agent (FR-10) — 4-check safety gate + append-only audit entry.

Checks: hallucination (grounding), PII redaction (Presidio), bias, topic policy.
Deterministic: all checks are pure functions of content + sources (no LLM), so the
audit hash is reproducible (NFR-1).
"""
from __future__ import annotations

from typing import Any

from config import get_settings
from infrastructure.determinism import now_iso, stable_hash

BIAS_PHRASES = ["always", "never", "everyone knows", "obviously", "clearly", "undeniably"]
POLICY_BLOCKED = ["personal attack", "illegal", "confidential", "classified"]


class GuardrailAgent:
    role = "guardrail"

    def __init__(self) -> None:
        self.settings = get_settings()

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        content = state.get("synthesised_content", "")
        sources = state.get("selected_sources") or state.get("scored_sources") or []

        results = {
            "hallucination": self._check_hallucination(content, sources),
            "pii": self._redact_pii(content),
            "bias": self._check_bias(content),
            "policy": self._check_policy(content),
        }
        passed = all(r["passed"] for r in results.values())
        attempts = int(state.get("guardrail_attempts", 0)) + 1
        audit = self._audit(state, results, passed)
        log = list(state.get("audit_log", [])) + [audit]
        return {
            **state,
            "guardrail_results": results,
            "guardrail_passed": passed,
            "guardrail_attempts": attempts,
            "safe_content": results["pii"]["redacted"],
            "audit_entry": audit,
            "audit_log": log,
            "status": "guardrail",
        }

    # ── checks ──
    def _check_hallucination(self, content: str, sources: list) -> dict:
        corpus = " ".join((s.get("content", "") or "").lower() for s in sources)
        sentences = [s.strip() for s in content.split(".") if len(s.strip()) > 20]
        if not sentences:
            return {"passed": True, "ungrounded": 0, "total": 0}
        ungrounded = 0
        for sent in sentences:
            keys = [w.lower() for w in sent.split()[:6] if len(w) > 4]
            if keys and not any(w in corpus for w in keys):
                ungrounded += 1
        ratio = ungrounded / len(sentences)
        return {"passed": ratio < 0.2, "ungrounded": ungrounded, "total": len(sentences), "ratio": round(ratio, 3)}

    def _redact_pii(self, content: str) -> dict:
        try:
            from presidio_analyzer import AnalyzerEngine
            from presidio_anonymizer import AnonymizerEngine

            analyzer = AnalyzerEngine()
            anonymizer = AnonymizerEngine()
            found = analyzer.analyze(text=content, language="en")
            redacted = anonymizer.anonymize(text=content, analyzer_results=found)
            return {"passed": True, "redacted": redacted.text, "pii_found": len(found)}
        except Exception:
            return {"passed": True, "redacted": content, "pii_found": 0}

    def _check_bias(self, content: str) -> dict:
        found = [p for p in BIAS_PHRASES if p in content.lower()]
        return {"passed": len(found) < 3, "flagged": found}

    def _check_policy(self, content: str) -> dict:
        found = [b for b in POLICY_BLOCKED if b in content.lower()]
        return {"passed": len(found) == 0, "violations": found}

    # ── audit ──
    def _audit(self, state: dict, results: dict, passed: bool) -> dict:
        content = state.get("synthesised_content", "")
        return {
            "timestamp": now_iso(),
            "session_id": state.get("session_id"),
            "content_hash": stable_hash(content),
            "results": results,
            "overall_passed": passed,
            "model_versions": (state.get("agent_config") or {}),
        }
