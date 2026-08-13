from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from app.auth import require_token
from app.services.organize_service import merge_files
from engines.pdf.organize import PdfEngineError

router = APIRouter(dependencies=[Depends(require_token)])


class MergeRequest(BaseModel):
    input_paths: list[str]

    @field_validator("input_paths")
    @classmethod
    def non_empty(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("input_paths must not be empty")
        return v


class MergeResponse(BaseModel):
    output_path: str


@router.post("/merge", response_model=MergeResponse)
async def merge(req: MergeRequest) -> MergeResponse:
    try:
        output = merge_files([Path(p) for p in req.input_paths])
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MergeResponse(output_path=str(output))
