from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter

from app.db import store

router = APIRouter(prefix="/library", tags=["library"])


class RecentFilesRequest(BaseModel):
    names: list[str] = Field(default_factory=list)


class RecentFilesResponse(BaseModel):
    names: list[str]


class JobHistoryItem(BaseModel):
    id: str
    kind: str
    input_path: str | None = None
    output_path: str | None = None
    created_at: str
    status: str


class JobHistoryResponse(BaseModel):
    items: list[JobHistoryItem]


@router.get("/recent", response_model=RecentFilesResponse)
async def get_recent_files() -> RecentFilesResponse:
    return RecentFilesResponse(names=store.get_recent_files())


@router.post("/recent", response_model=RecentFilesResponse)
async def save_recent_files(payload: RecentFilesRequest) -> RecentFilesResponse:
    return RecentFilesResponse(names=store.save_recent_files(payload.names))


@router.get("/history", response_model=JobHistoryResponse)
async def get_history() -> JobHistoryResponse:
    return JobHistoryResponse(items=[JobHistoryItem(**row) for row in store.list_job_history()])

