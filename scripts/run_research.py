#!/usr/bin/env python3
"""Deterministic CLI runner — runs a full research pipeline and prints the report path.

Usage:
    python scripts/run_research.py "AI in drug discovery" --persona researcher

Needs real API keys in .env (NFR-2) unless the LLM cache already holds the entries
(ORION_LLM_CACHE_MODE=read_only replays without keys).
"""
from __future__ import annotations

import argparse
import asyncio
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from infrastructure.determinism import session_id, stable_hash  # noqa: E402
from orchestration.graph import run_pipeline  # noqa: E402


async def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("topic")
    p.add_argument("--persona", default="researcher",
                   choices=["researcher", "product_manager", "content_creator"])
    p.add_argument("--threshold", type=float, default=0.7)
    args = p.parse_args()

    state = {
        "session_id": session_id(args.topic, args.persona, {}),
        "topic": args.topic,
        "persona": args.persona,
        "agent_config": {},
        "confidence_threshold": args.threshold,
        "max_sources": 10,
    }
    final = await run_pipeline(state)
    print(f"status      : {final['status']}")
    print(f"session_id  : {final['session_id']}")
    print(f"report      : {final.get('report_url')}")
    print(f"insights    : {len(final.get('insights', []))}")
    print(f"result hash : {stable_hash(final.get('insights', []))[:16]}")


if __name__ == "__main__":
    asyncio.run(main())
