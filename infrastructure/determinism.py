"""Determinism primitives (NFR-1, see specs/determinism.md).

Provides: stable hashing, a frozen-or-real clock, deterministic session IDs, and a
content-addressed disk cache for LLM completions — the authoritative determinism
boundary (control C3).
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from config import get_settings

# Stable UUID namespace for ORION session IDs (control C4).
_ORION_NS = uuid.UUID("6f1c0e2a-0000-4000-8000-000000000001")


def stable_hash(payload: Any) -> str:
    """SHA-256 of a canonical JSON encoding. Order-stable, whitespace-stable."""
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def now() -> datetime:
    """Frozen epoch in deterministic mode, real wall-clock otherwise (C4)."""
    s = get_settings()
    if s.deterministic:
        return datetime.fromisoformat(s.deterministic_epoch)
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now().isoformat()


def session_id(topic: str, persona: str, config: dict[str, Any]) -> str:
    """Deterministic (UUIDv5) id from inputs, or random when non-deterministic (C4)."""
    s = get_settings()
    if not s.deterministic:
        return str(uuid.uuid4())
    seed = stable_hash({"topic": topic.strip().lower(), "persona": persona, "config": config})
    return str(uuid.uuid5(_ORION_NS, seed))


class LLMCache:
    """Content-addressed completion cache (control C3).

    key = sha256(provider|model|seed|temperature|top_p|json(messages))
    Modes: read_write (default) · read_only (raise on miss) · refresh (overwrite).
    """

    def __init__(self) -> None:
        s = get_settings()
        self.mode = s.llm_cache_mode
        self.dir = Path(s.llm_cache_dir)
        self.dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def key(provider: str, model: str, messages: Any, params: dict[str, Any]) -> str:
        return stable_hash(
            {
                "provider": provider,
                "model": model,
                "messages": messages,
                "seed": params.get("seed"),
                "temperature": params.get("temperature"),
                "top_p": params.get("top_p"),
            }
        )

    def _path(self, key: str) -> Path:
        return self.dir / f"{key}.json"

    def get(self, key: str) -> str | None:
        if self.mode == "refresh":
            return None
        p = self._path(key)
        if p.exists():
            return json.loads(p.read_text("utf-8"))["completion"]
        if self.mode == "read_only":
            raise KeyError(
                f"LLM cache miss in read_only mode for key {key[:12]}…. "
                "Re-baseline with ORION_LLM_CACHE_MODE=refresh and valid API keys."
            )
        return None

    def put(self, key: str, provider: str, model: str, completion: str) -> None:
        if self.mode == "read_only":
            return
        self._path(key).write_text(
            json.dumps(
                {"provider": provider, "model": model, "completion": completion},
                ensure_ascii=False,
                indent=2,
            ),
            "utf-8",
        )
