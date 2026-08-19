from __future__ import annotations

from pathlib import Path
import uuid
from typing import Any, Callable

from fastapi import HTTPException

from app.jobs.manager import jobs
from app.api.organize_models import (
    ConvertResponse,
    JobAcceptedResponse,
    MergeResponse,
    MultiOutputResponse,
    PreviewManifestResponse,
    PreviewPage,
    PreviewPageResponse,
    PreviewResponse,
    SignatureField,
    SignatureReport,
)

JobWork = Callable[[Callable[[int, str | None], None]], dict[str, Any]]

_preview_sessions: dict[str, Path] = {}


def enqueue_job(kind: str, work: JobWork) -> JobAcceptedResponse:
    job = jobs.create_job(kind, message="Queued")
    jobs.submit(job.id, work)
    return JobAcceptedResponse(job_id=job.id)


def register_preview_session(path: Path) -> str:
    preview_id = uuid.uuid4().hex
    _preview_sessions[preview_id] = path
    return preview_id


def resolve_preview_session(preview_id: str | None, path: str | None) -> Path:
    if preview_id:
        preview_path = _preview_sessions.get(preview_id)
        if preview_path is None:
            raise HTTPException(status_code=404, detail="preview session not found")
        return preview_path
    if path:
        return Path(path)
    raise HTTPException(status_code=400, detail="preview_id or path is required")


def parse_page_ranges(value: str) -> list[int]:
    page_indices: list[int] = []
    seen: set[int] = set()
    for raw_part in value.split(","):
        part = raw_part.strip()
        if not part:
            continue
        if "-" in part:
            raw_start, raw_end = part.split("-", 1)
            if not raw_start.strip().isdigit() or not raw_end.strip().isdigit():
                raise HTTPException(status_code=400, detail="pages must look like 1,3-5")
            start = int(raw_start)
            end = int(raw_end)
            if start < 1 or end < start:
                raise HTTPException(status_code=400, detail="page ranges must start at 1 and increase")
            values = range(start, end + 1)
        else:
            if not part.isdigit():
                raise HTTPException(status_code=400, detail="pages must look like 1,3-5")
            page = int(part)
            if page < 1:
                raise HTTPException(status_code=400, detail="page numbers must start at 1")
            values = [page]

        for page in values:
            index = page - 1
            if index not in seen:
                page_indices.append(index)
                seen.add(index)

    if not page_indices:
        raise HTTPException(status_code=400, detail="choose at least one page")
    return page_indices


def parse_page_order(value: str) -> list[int]:
    raw_pages = [part.strip() for part in value.split(",") if part.strip()]
    if not raw_pages:
        raise HTTPException(status_code=400, detail="page order must not be empty")
    if any(not page.isdigit() for page in raw_pages):
        raise HTTPException(status_code=400, detail="page order must look like 3,1,2")

    page_indices = [int(page) - 1 for page in raw_pages]
    if any(index < 0 for index in page_indices):
        raise HTTPException(status_code=400, detail="page numbers must start at 1")
    return page_indices


def require_single_input(input_paths: list[str], detail: str) -> Path:
    if len(input_paths) != 1:
        raise HTTPException(status_code=400, detail=detail)
    return Path(input_paths[0])


def merge_response(output_path: Path) -> MergeResponse:
    return MergeResponse(output_path=str(output_path))


def convert_response(output_path: Path) -> ConvertResponse:
    return ConvertResponse(output_path=str(output_path))


def multi_output_response(output_paths: list[Path]) -> MultiOutputResponse:
    return MultiOutputResponse(output_paths=[str(path) for path in output_paths])


def preview_response(pages: list[dict[str, Any]]) -> PreviewResponse:
    return PreviewResponse(pages=[PreviewPage(**page) for page in pages])


def preview_manifest_response(preview_id: str, pages: list[dict[str, Any]]) -> PreviewManifestResponse:
    return PreviewManifestResponse(preview_id=preview_id, pages=[PreviewPage(**page) for page in pages])


def preview_page_response(page: dict[str, Any]) -> PreviewPageResponse:
    return PreviewPageResponse(page=PreviewPage(**page))


def signature_report_response(report: dict[str, Any]) -> SignatureReport:
    return SignatureReport(
        status=str(report["status"]),
        document_signed=bool(report["document_signed"]),
        signature_count=int(report["signature_count"]),
        fields=[SignatureField(**field) for field in report["fields"]],
    )
