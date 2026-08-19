from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from app.auth import require_token
from app.jobs.manager import jobs
from app.api.results_models import JobStatusResponse, ZipRequest
from app.services.result_service import allowed_result_path, zip_result_paths

router = APIRouter(dependencies=[Depends(require_token)])


@router.get("/download")
async def download(path: str) -> FileResponse:
    result_path = allowed_result_path(path)
    return FileResponse(result_path, filename=result_path.name)


@router.post("/zip")
async def download_zip(req: ZipRequest) -> FileResponse:
    result_paths = [allowed_result_path(path) for path in req.paths]
    zip_path = zip_result_paths(result_paths)
    return FileResponse(zip_path, media_type="application/zip", filename="nodoc-results.zip")


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def job_status(job_id: str) -> JobStatusResponse:
    payload = jobs.serialize_job(job_id)
    if payload is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="job not found")
    return JobStatusResponse(**payload)
