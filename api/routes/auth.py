"""Auth routes (FR-18). Dev-grade signup/login issuing JWTs.

In production these delegate to Supabase Auth; here we issue local HS256 tokens so the
flow is runnable end to end.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr

from auth.dependencies import current_user
from auth.jwt_handler import create_access_token
from infrastructure.determinism import session_id

router = APIRouter()


class Credentials(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str


@router.post("/signup", response_model=TokenResponse)
async def signup(creds: Credentials) -> TokenResponse:
    uid = session_id(creds.email, "user", {})
    return TokenResponse(access_token=create_access_token(uid, {"email": creds.email}), user_id=uid)


@router.post("/login", response_model=TokenResponse)
async def login(creds: Credentials) -> TokenResponse:
    uid = session_id(creds.email, "user", {})
    return TokenResponse(access_token=create_access_token(uid, {"email": creds.email}), user_id=uid)


@router.get("/me")
async def me(user: dict = Depends(current_user)) -> dict:
    return user
