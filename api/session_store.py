"""Session store (FR-4, FR-19).

Two interchangeable backends, selected by `settings.session_backend`:
- "memory": in-process dict (dev / single-process API).
- "redis":  JSON at key `orion:session:{id}` — shared between the API and Celery workers.

Ordering stays deterministic and ids are deterministic (infrastructure.determinism).
"""
from __future__ import annotations

import json
from typing import Any

from config import get_settings

_PREFIX = "orion:session:"
_INDEX = "orion:sessions"  # set of known ids (redis backend)
_MEM: dict[str, dict[str, Any]] = {}


def _redis():
    import redis  # lazy import so memory mode needs no redis package

    return redis.Redis.from_url(get_settings().redis_url, decode_responses=True)


def _use_redis() -> bool:
    return get_settings().session_backend == "redis"


def save(session_id: str, state: dict[str, Any]) -> None:
    if _use_redis():
        r = _redis()
        r.set(_PREFIX + session_id, json.dumps(state, default=str))
        r.sadd(_INDEX, session_id)
    else:
        _MEM[session_id] = state


def get(session_id: str) -> dict[str, Any] | None:
    if _use_redis():
        raw = _redis().get(_PREFIX + session_id)
        return json.loads(raw) if raw else None
    return _MEM.get(session_id)


def list_for_user(user_id: str) -> list[dict[str, Any]]:
    if _use_redis():
        r = _redis()
        ids = r.smembers(_INDEX)
        out = [get(sid) for sid in ids]
        return [s for s in out if s and s.get("user_id") == user_id]
    return [s for s in _MEM.values() if s.get("user_id") == user_id]


def delete(session_id: str) -> bool:
    if _use_redis():
        r = _redis()
        r.srem(_INDEX, session_id)
        return bool(r.delete(_PREFIX + session_id))
    return _MEM.pop(session_id, None) is not None
