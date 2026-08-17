from __future__ import annotations

import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator

from app.auth import require_token
from app.config import settings
from app.jobs.manager import jobs

router = APIRouter(dependencies=[Depends(require_token)])


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


def allowed_result_path(raw_path: str) -> Path:
    path = Path(raw_path).resolve()
    app_data_dir = settings.app_data_dir.resolve()
    if path != app_data_dir and app_data_dir not in path.parents:
        raise HTTPException(status_code=403, detail="result is outside the app data folder")
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="result file not found")
    return path


@router.get("/download")
async def download(path: str) -> FileResponse:
    result_path = allowed_result_path(path)
    return FileResponse(result_path, filename=result_path.name)


@router.post("/zip")
async def download_zip(req: ZipRequest) -> FileResponse:
    result_paths = [allowed_result_path(path) for path in req.paths]
    zip_dir = settings.temp_dir / "downloads"
    zip_dir.mkdir(parents=True, exist_ok=True)
    zip_path = zip_dir / "nodoc-results.zip"

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        used_names: set[str] = set()
        for result_path in result_paths:
            archive_name = result_path.name
            if archive_name in used_names:
                archive_name = f"{result_path.stem}_{len(used_names) + 1}{result_path.suffix}"
            used_names.add(archive_name)
            archive.write(result_path, arcname=archive_name)

    return FileResponse(zip_path, media_type="application/zip", filename="nodoc-results.zip")


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def job_status(job_id: str) -> JobStatusResponse:
    payload = jobs.serialize_job(job_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="job not found")
    return JobStatusResponse(**payload)
