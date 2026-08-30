from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends

from app.auth import require_token

from app.services.job_history_service import (
    get_recent_files as load_recent_files,
    list_job_history as load_job_history,
    save_recent_files as store_recent_files,
)

router = APIRouter(
    prefix="/library",
    tags=["library"],
    dependencies=[Depends(require_token)],
)


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
    return RecentFilesResponse(names=load_recent_files())


@router.post("/recent", response_model=RecentFilesResponse)
async def save_recent_files(payload: RecentFilesRequest) -> RecentFilesResponse:
    return RecentFilesResponse(names=store_recent_files(payload.names))


@router.get("/history", response_model=JobHistoryResponse)
async def get_history() -> JobHistoryResponse:
    return JobHistoryResponse(items=[JobHistoryItem(**row) for row in load_job_history()])
