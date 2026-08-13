"""
Per-session token check.

The Tauri host generates settings.auth_token at process start and hands it
to the frontend over its own IPC channel (not over HTTP). Every request to
this API must present it. This is what stops any other local process/tab
from talking to the sidecar even though it's plain HTTP on loopback.
"""
from __future__ import annotations

from fastapi import Header, HTTPException, status

from app.config import settings


async def require_token(x_privatepdf_token: str = Header(default="")) -> None:
    if not secrets_compare(x_privatepdf_token, settings.auth_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")


def secrets_compare(a: str, b: str) -> bool:
    import hmac
    return hmac.compare_digest(a, b)
