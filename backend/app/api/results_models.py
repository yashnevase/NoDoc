from __future__ import annotations

from pydantic import BaseModel, field_validator


class ZipRequest(BaseModel):
    paths: list[str]

    @field_validator("paths")
    @classmethod
    def non_empty(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("paths must not be empty")
        return value


class JobStatusResponse(BaseModel):
    id: str
    kind: str
    status: str
    progress: int
    message: str
    result: dict | None = None
    error: str | None = None
    created_at: str
    updated_at: str
