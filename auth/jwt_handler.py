"""JWT issue/verify (FR-18). Supabase-compatible HS256 bearer tokens."""
from __future__ import annotations

from datetime import timedelta
from typing import Any

from jose import JWTError, jwt

from config import get_settings
from infrastructure.determinism import now


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    s = get_settings()
    expire = now() + timedelta(minutes=s.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire, **(extra or {})}
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    s = get_settings()
    try:
        return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except JWTError as exc:
        raise ValueError(f"Invalid token: {exc}") from exc
