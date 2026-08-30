from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from app.auth import require_token
from app.jobs.manager import jobs
from app.api.results_models import CleanupRequest, JobStatusResponse, WorkspacePathsRequest, ZipRequest
from app.services.result_service import allowed_result_path, cleanup_result_paths, save_active_workspace_paths, zip_result_paths

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


@router.post("/cleanup")
async def cleanup(req: CleanupRequest) -> dict[str, int]:
    return {"deleted": cleanup_result_paths(req.paths, release_workspace=req.release_workspace)}


@router.post("/workspace")
async def save_workspace(req: WorkspacePathsRequest) -> dict[str, int]:
    return {"tracked": save_active_workspace_paths(req.paths)}


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def job_status(job_id: str) -> JobStatusResponse:
    payload = jobs.serialize_job(job_id)
    if payload is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="job not found")
    return JobStatusResponse(**payload)


@router.post("/jobs/{job_id}/cancel", response_model=JobStatusResponse)
async def cancel_job(job_id: str) -> JobStatusResponse:
    job = jobs.cancel_job(job_id)
    if job is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="job not found")
    return JobStatusResponse(**jobs.serialize_job(job_id))
