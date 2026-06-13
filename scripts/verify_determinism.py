#!/usr/bin/env python3
"""NFR-1 gate — run the same session twice, assert identical report hashes.

Exits non-zero if outputs diverge. Uses the LLM cache so it needs no network after the
first baseline. Wired to `make verify-determinism` and CI.
"""
from __future__ import annotations

import asyncio
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from config import get_settings  # noqa: E402
from infrastructure.determinism import stable_hash  # noqa: E402
from infrastructure.offline_llm import install_offline_llm  # noqa: E402
from orchestration.graph import run_pipeline  # noqa: E402

# The gate runs in CI without keys: replay deterministically through the offline provider.
# With real keys present, the real provider + cache path is exercised instead.
_s = get_settings()
if not (_s.openai_api_key and _s.anthropic_api_key):
    install_offline_llm()

_SRC = {
    "url": "https://arxiv.org/abs/1", "title": "AI in care",
    "content": "AI adoption is accelerating across the studied domains in healthcare research.",
    "source_type": "academic", "confidence": 0.9, "query": "AI",
}


def _seed() -> dict:
    return {
        "session_id": "determinism-check",
        "topic": "AI trends in healthcare 2026",
        "persona": "researcher",
        "agent_config": {},
        "confidence_threshold": 0.0,
        "max_sources": 5,
        "raw_sources": [dict(_SRC)],
        "selected_sources": [dict(_SRC)],
    }


async def main() -> int:
    a = await run_pipeline(_seed())
    b = await run_pipeline(_seed())
    ha = stable_hash({"insights": a["insights"], "audit": a["audit_entry"]["content_hash"]})
    hb = stable_hash({"insights": b["insights"], "audit": b["audit_entry"]["content_hash"]})
    if ha == hb:
        print(f"✓ deterministic — identical output hash {ha[:16]}")
        return 0
    print(f"✗ NON-DETERMINISTIC — {ha[:16]} != {hb[:16]}")
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
