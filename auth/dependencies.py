"""FastAPI auth dependency (FR-18)."""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from auth.jwt_handler import decode_token

_bearer = HTTPBearer(auto_error=False)


# Note: Optional[...] (not `X | None`) because FastAPI evaluates this annotation at
# runtime; the union-pipe form fails on Python 3.9. Runtime target is 3.11 (pyproject).
async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)) -> dict:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    try:
        claims = decode_token(creds.credentials)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
    return {"id": claims.get("sub"), "email": claims.get("email", "")}
