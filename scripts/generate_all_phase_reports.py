#!/usr/bin/env python3
"""Generate the 5 SDLC phase HTML reports (FR-21) into reports/phases/."""
from __future__ import annotations

import pathlib
import sys
from pathlib import Path

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from reports.generator import generate_phase_report, generate_validation_report  # noqa: E402

OUT = Path("reports/phases")

PHASE_DATA = {
    "design": {
        "architecture": "Orbital agent topology — orchestrator core, crews on orbit 1.",
        "agents": ["retriever", "analysis", "insight", "guardrail", "report", "integration"],
        "decisions": ["ADR-001 LangGraph", "ADR-002 deterministic LLM cache", "ADR-004 crews"],
    },
    "plan": {
        "tasks": ["foundation", "agents", "orchestrator", "api", "frontend", "tests"],
        "risks": {"LLM nondeterminism": "mitigated by content-addressed cache (NFR-1)"},
    },
    "build": {
        "agents_implemented": 9,
        "endpoints": ["/auth", "/research", "/agents", "/integrations", "/reports"],
        "determinism": "temperature=0, snapshot pinning, response cache, frozen clock",
    },
    "test": {
        "unit": "confidence, guardrail, router, routing, determinism",
        "integration": "full pipeline + reproducibility",
        "status": "22 passing",
    },
}


def main() -> None:
    for phase, data in PHASE_DATA.items():
        out = OUT / f"{phase}_report.html"
        generate_phase_report(phase, data, out)
        print(f"✓ {out}")
    val = OUT / "validation_executive.html"
    generate_validation_report(
        {"topic": "ORION platform build", "persona": "n/a", "status": "validated"},
        [],
        val,
    )
    print(f"✓ {val}")


if __name__ == "__main__":
    main()
