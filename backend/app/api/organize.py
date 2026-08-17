from __future__ import annotations

from pathlib import Path
from typing import Callable

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, field_validator

from app.auth import require_token
from app.jobs.manager import jobs
from app.services.organize_service import (
    add_image_watermark_file,
    add_text_watermark_file,
    cleanup_job_dir,
    create_upload_job_dir,
    delete_pages_file,
    extract_pages_file,
    images_to_pdf_files,
    merge_files,
    password_protect_file,
    pdf_to_images_file,
    reorder_pages_file,
    repair_pdf_file,
    rotate_pdf_file,
    inspect_signatures_file,
    safe_upload_output_path,
    split_pdf_file,
)
from engines.pdf.convert import render_pdf_preview
from engines.images.to_pdf import ImageEngineError
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


class ConvertResponse(BaseModel):
    output_path: str


class MultiOutputResponse(BaseModel):
    output_paths: list[str]


class SignatureField(BaseModel):
    name: str
    signed: bool
    issues: list[str]
    filter: str
    subfilter: str


class SignatureReport(BaseModel):
    status: str
    document_signed: bool
    signature_count: int
    fields: list[SignatureField]


class PreviewPage(BaseModel):
    page: int
    width: float
    height: float
    image: str


class PreviewResponse(BaseModel):
    pages: list[PreviewPage]


class JobAcceptedResponse(BaseModel):
    job_id: str


def enqueue_job(
    kind: str,
    work: Callable[[Callable[[int, str | None], None]], dict],
) -> JobAcceptedResponse:
    job = jobs.create_job(kind, message="Queued")
    jobs.submit(job.id, work)
    return JobAcceptedResponse(job_id=job.id)


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


@router.post("/merge", response_model=MergeResponse | JobAcceptedResponse)
async def merge(req: MergeRequest, async_job: bool = False) -> MergeResponse | JobAcceptedResponse:
    if async_job:
        input_paths = [Path(p) for p in req.input_paths]
        return enqueue_job(
            "merge",
            lambda progress: {
                "output_path": str(
                    merge_files(
                        input_paths,
                        on_progress=lambda value: progress(value, "Merging PDFs"),
                    )
                )
            },
        )
    try:
        output = merge_files([Path(p) for p in req.input_paths])
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MergeResponse(output_path=str(output))


@router.post("/images-to-pdf", response_model=ConvertResponse | JobAcceptedResponse)
async def images_to_pdf(req: MergeRequest, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if async_job:
        input_paths = [Path(p) for p in req.input_paths]
        return enqueue_job(
            "images_to_pdf",
            lambda progress: {
                "output_path": str(
                    images_to_pdf_files(
                        input_paths,
                        on_progress=lambda value: progress(value, "Converting images"),
                    )
                )
            },
        )
    try:
        output = images_to_pdf_files([Path(p) for p in req.input_paths])
    except ImageEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ConvertResponse(output_path=str(output))


@router.post("/split-pdf", response_model=MultiOutputResponse | JobAcceptedResponse)
async def split_pdf(req: MergeRequest, async_job: bool = False) -> MultiOutputResponse | JobAcceptedResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="split-pdf expects exactly one input PDF")
    if async_job:
        input_path = Path(req.input_paths[0])
        return enqueue_job(
            "split_pdf",
            lambda progress: {
                "output_paths": [
                    str(path)
                    for path in split_pdf_file(
                        input_path,
                        on_progress=lambda value: progress(value, "Splitting pages"),
                    )
                ]
            },
        )
    try:
        output_paths = split_pdf_file(Path(req.input_paths[0]))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MultiOutputResponse(output_paths=[str(path) for path in output_paths])


@router.post("/pdf-to-images", response_model=MultiOutputResponse | JobAcceptedResponse)
async def pdf_to_images(req: MergeRequest, async_job: bool = False) -> MultiOutputResponse | JobAcceptedResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="pdf-to-images expects exactly one input PDF")
    if async_job:
        input_path = Path(req.input_paths[0])
        return enqueue_job(
            "pdf_to_images",
            lambda progress: {
                "output_paths": [
                    str(path)
                    for path in pdf_to_images_file(
                        input_path,
                        on_progress=lambda value: progress(value, "Rendering pages"),
                    )
                ]
            },
        )
    try:
        output_paths = pdf_to_images_file(Path(req.input_paths[0]))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MultiOutputResponse(output_paths=[str(path) for path in output_paths])


@router.post("/preview-pdf", response_model=PreviewResponse)
async def preview_pdf(req: MergeRequest) -> PreviewResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="preview-pdf expects exactly one input PDF")
    try:
        pages = render_pdf_preview(Path(req.input_paths[0]))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PreviewResponse(pages=[PreviewPage(**page) for page in pages])


@router.post("/extract-pages", response_model=ConvertResponse | JobAcceptedResponse)
async def extract_pages(req: MergeRequest, pages: str = "", async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="extract-pages expects exactly one input PDF")
    page_indices = parse_page_ranges(pages)
    if async_job:
        input_path = Path(req.input_paths[0])
        return enqueue_job(
            "extract_pages",
            lambda progress: {
                "output_path": str(
                    extract_pages_file(
                        input_path,
                        page_indices,
                    )
                )
            },
        )
    try:
        output = extract_pages_file(Path(req.input_paths[0]), page_indices)
    except (PdfEngineError, IndexError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ConvertResponse(output_path=str(output))


@router.post("/delete-pages", response_model=ConvertResponse | JobAcceptedResponse)
async def delete_pages(req: MergeRequest, pages: str = "", async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="delete-pages expects exactly one input PDF")
    page_indices = parse_page_ranges(pages)
    if async_job:
        input_path = Path(req.input_paths[0])
        return enqueue_job(
            "delete_pages",
            lambda progress: {
                "output_path": str(delete_pages_file(input_path, page_indices))
            },
        )
    try:
        output = delete_pages_file(Path(req.input_paths[0]), page_indices)
    except (PdfEngineError, IndexError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ConvertResponse(output_path=str(output))


@router.post("/rotate-pdf", response_model=ConvertResponse | JobAcceptedResponse)
async def rotate_pdf(req: MergeRequest, degrees: int, pages: str = "", async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="rotate-pdf expects exactly one input PDF")
    page_indices = parse_page_ranges(pages) if pages.strip() else None
    if async_job:
        input_path = Path(req.input_paths[0])
        return enqueue_job(
            "rotate_pdf",
            lambda progress: {
                "output_path": str(rotate_pdf_file(input_path, degrees, page_indices))
            },
        )
    try:
        output = rotate_pdf_file(Path(req.input_paths[0]), degrees, page_indices)
    except (PdfEngineError, IndexError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ConvertResponse(output_path=str(output))


@router.post("/reorder-pages", response_model=ConvertResponse | JobAcceptedResponse)
async def reorder_pages(req: MergeRequest, order: str = "", async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="reorder-pages expects exactly one input PDF")
    page_indices = parse_page_order(order)
    if async_job:
        input_path = Path(req.input_paths[0])
        return enqueue_job(
            "reorder_pages",
            lambda progress: {
                "output_path": str(reorder_pages_file(input_path, page_indices))
            },
        )
    try:
        output = reorder_pages_file(Path(req.input_paths[0]), page_indices)
    except (PdfEngineError, IndexError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ConvertResponse(output_path=str(output))


@router.post("/password-protect", response_model=ConvertResponse | JobAcceptedResponse)
async def password_protect(req: MergeRequest, password: str, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="password-protect expects exactly one input PDF")
    if async_job:
        input_path = Path(req.input_paths[0])
        return enqueue_job(
            "password_protect",
            lambda progress: {
                "output_path": str(password_protect_file(input_path, password))
            },
        )
    try:
        output = password_protect_file(Path(req.input_paths[0]), password)
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ConvertResponse(output_path=str(output))


@router.post("/signature-report", response_model=SignatureReport)
async def signature_report(req: MergeRequest) -> SignatureReport:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="signature-report expects exactly one input PDF")
    try:
        report = inspect_signatures_file(Path(req.input_paths[0]))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return SignatureReport(
        status=str(report["status"]),
        document_signed=bool(report["document_signed"]),
        signature_count=int(report["signature_count"]),
        fields=[SignatureField(**field) for field in report["fields"]],
    )


@router.post("/repair-pdf", response_model=ConvertResponse | JobAcceptedResponse)
async def repair_pdf(req: MergeRequest, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="repair-pdf expects exactly one input PDF")
    if async_job:
        input_path = Path(req.input_paths[0])
        return enqueue_job(
            "repair_pdf",
            lambda progress: {
                "output_path": str(repair_pdf_file(input_path))
            },
        )
    try:
        output = repair_pdf_file(Path(req.input_paths[0]))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ConvertResponse(output_path=str(output))


@router.post("/watermark-text", response_model=ConvertResponse | JobAcceptedResponse)
async def watermark_text(
    req: MergeRequest,
    text: str,
    mode: str = "text",
    preset: str = "verified",
    pages: str = "",
    position: str = "center",
    angle: float = -45.0,
    size: float = 48.0,
    opacity: float = 0.22,
    color: str = "#b02730",
    async_job: bool = False,
) -> ConvertResponse | JobAcceptedResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="watermark-text expects exactly one input PDF")
    page_indices = parse_page_ranges(pages) if pages.strip() else None
    if async_job:
        input_path = Path(req.input_paths[0])
        return enqueue_job(
            "watermark_text",
            lambda progress: {
                "output_path": str(
                    add_text_watermark_file(
                        input_path,
                        text,
                        mode=mode,
                        preset=preset,
                        page_indices=page_indices,
                        position=position,
                        angle=angle,
                        size=size,
                        opacity=opacity,
                        color=color,
                        on_progress=lambda value: progress(value, "Applying watermark"),
                    )
                )
            },
        )
    try:
        output = add_text_watermark_file(
            Path(req.input_paths[0]),
            text,
            mode=mode,
            preset=preset,
            page_indices=page_indices,
            position=position,
            angle=angle,
            size=size,
            opacity=opacity,
            color=color,
        )
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ConvertResponse(output_path=str(output))


@router.post("/merge-upload", response_model=MergeResponse | JobAcceptedResponse)
async def merge_upload(files: list[UploadFile] = File(...), async_job: bool = False) -> MergeResponse | JobAcceptedResponse:
    if not files:
        raise HTTPException(status_code=400, detail="no files uploaded")

    job_dir = create_upload_job_dir()
    input_paths: list[Path] = []
    try:
        for index, upload in enumerate(files):
            filename = upload.filename or f"upload-{index + 1}.pdf"
            target_path = job_dir / filename
            target_path.parent.mkdir(parents=True, exist_ok=True)
            contents = await upload.read()
            target_path.write_bytes(contents)
            input_paths.append(target_path)

        output_path = safe_upload_output_path(job_dir, files[0].filename or "merged.pdf", "merged")
        if async_job:
            return enqueue_job(
                "merge_upload",
                lambda progress: {
                    "output_path": str(
                        merge_files_to_output(
                            input_paths,
                            output_path,
                            on_progress=lambda value: progress(value, "Merging PDFs"),
                        )
                    )
                },
            )
        output = merge_files_to_output(input_paths, output_path)
        return MergeResponse(output_path=str(output))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/images-to-pdf-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def images_to_pdf_upload(files: list[UploadFile] = File(...), async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if not files:
        raise HTTPException(status_code=400, detail="no files uploaded")

    job_dir = create_upload_job_dir()
    input_paths: list[Path] = []
    try:
        for index, upload in enumerate(files):
            filename = upload.filename or f"image-{index + 1}"
            target_path = job_dir / filename
            target_path.parent.mkdir(parents=True, exist_ok=True)
            contents = await upload.read()
            target_path.write_bytes(contents)
            input_paths.append(target_path)

        output_path = safe_upload_output_path(job_dir, files[0].filename or "images.pdf", "images")
        if async_job:
            return enqueue_job(
                "images_to_pdf_upload",
                lambda progress: {
                    "output_path": str(
                        images_to_pdf_files_to_output(
                            input_paths,
                            output_path,
                            on_progress=lambda value: progress(value, "Converting images"),
                        )
                    )
                },
            )
        output = images_to_pdf_files_to_output(input_paths, output_path)
        return ConvertResponse(output_path=str(output))
    except ImageEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/split-pdf-upload", response_model=MultiOutputResponse | JobAcceptedResponse)
async def split_pdf_upload(files: list[UploadFile] = File(...), async_job: bool = False) -> MultiOutputResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="split-pdf-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        if async_job:
            return enqueue_job(
                "split_pdf_upload",
                lambda progress: {
                    "output_paths": [
                        str(path)
                        for path in split_pdf_file(
                            target_path,
                            on_progress=lambda value: progress(value, "Splitting pages"),
                        )
                    ]
                },
            )
        output_paths = split_pdf_file(target_path)
        return MultiOutputResponse(output_paths=[str(path) for path in output_paths])
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/pdf-to-images-upload", response_model=MultiOutputResponse | JobAcceptedResponse)
async def pdf_to_images_upload(files: list[UploadFile] = File(...), async_job: bool = False) -> MultiOutputResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="pdf-to-images-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        if async_job:
            return enqueue_job(
                "pdf_to_images_upload",
                lambda progress: {
                    "output_paths": [
                        str(path)
                        for path in pdf_to_images_file(
                            target_path,
                            on_progress=lambda value: progress(value, "Rendering pages"),
                        )
                    ]
                },
            )
        output_paths = pdf_to_images_file(target_path)
        return MultiOutputResponse(output_paths=[str(path) for path in output_paths])
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/preview-pdf-upload", response_model=PreviewResponse)
async def preview_pdf_upload(files: list[UploadFile] = File(...)) -> PreviewResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="preview-pdf-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        pages = render_pdf_preview(target_path)
        return PreviewResponse(pages=[PreviewPage(**page) for page in pages])
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/extract-pages-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def extract_pages_upload(
    files: list[UploadFile] = File(...),
    pages: str = Form(...),
    async_job: bool = False,
) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="extract-pages-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        page_indices = parse_page_ranges(pages)
        if async_job:
            return enqueue_job(
                "extract_pages_upload",
                lambda progress: {"output_path": str(extract_pages_file(target_path, page_indices))},
            )
        output = extract_pages_file(target_path, page_indices)
        return ConvertResponse(output_path=str(output))
    except (PdfEngineError, IndexError) as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/delete-pages-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def delete_pages_upload(
    files: list[UploadFile] = File(...),
    pages: str = Form(...),
    async_job: bool = False,
) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="delete-pages-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        page_indices = parse_page_ranges(pages)
        if async_job:
            return enqueue_job(
                "delete_pages_upload",
                lambda progress: {"output_path": str(delete_pages_file(target_path, page_indices))},
            )
        output = delete_pages_file(target_path, page_indices)
        return ConvertResponse(output_path=str(output))
    except (PdfEngineError, IndexError) as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/rotate-pdf-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def rotate_pdf_upload(
    files: list[UploadFile] = File(...),
    degrees: int = Form(...),
    pages: str = Form(""),
    async_job: bool = False,
) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="rotate-pdf-upload expects exactly one PDF")

    page_indices = parse_page_ranges(pages) if pages.strip() else None
    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        if async_job:
            return enqueue_job(
                "rotate_pdf_upload",
                lambda progress: {"output_path": str(rotate_pdf_file(target_path, degrees, page_indices))},
            )
        output = rotate_pdf_file(target_path, degrees, page_indices)
        return ConvertResponse(output_path=str(output))
    except (PdfEngineError, IndexError) as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/reorder-pages-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def reorder_pages_upload(
    files: list[UploadFile] = File(...),
    order: str = Form(...),
    async_job: bool = False,
) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="reorder-pages-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        page_indices = parse_page_order(order)
        if async_job:
            return enqueue_job(
                "reorder_pages_upload",
                lambda progress: {"output_path": str(reorder_pages_file(target_path, page_indices))},
            )
        output = reorder_pages_file(target_path, page_indices)
        return ConvertResponse(output_path=str(output))
    except (PdfEngineError, IndexError) as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/password-protect-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def password_protect_upload(
    files: list[UploadFile] = File(...),
    password: str = Form(...),
    async_job: bool = False,
) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="password-protect-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        if async_job:
            return enqueue_job(
                "password_protect_upload",
                lambda progress: {"output_path": str(password_protect_file(target_path, password))},
            )
        output = password_protect_file(target_path, password)
        return ConvertResponse(output_path=str(output))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/signature-report-upload", response_model=SignatureReport)
async def signature_report_upload(files: list[UploadFile] = File(...)) -> SignatureReport:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="signature-report-upload expects exactly one input PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        report = inspect_signatures_file(target_path)
        return SignatureReport(
            status=str(report["status"]),
            document_signed=bool(report["document_signed"]),
            signature_count=int(report["signature_count"]),
            fields=[SignatureField(**field) for field in report["fields"]],
        )
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/repair-pdf-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def repair_pdf_upload(files: list[UploadFile] = File(...), async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="repair-pdf-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        if async_job:
            return enqueue_job(
                "repair_pdf_upload",
                lambda progress: {"output_path": str(repair_pdf_file(target_path))},
            )
        output = repair_pdf_file(target_path)
        return ConvertResponse(output_path=str(output))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/watermark-text-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def watermark_text_upload(
    files: list[UploadFile] = File(...),
    text: str = Form(...),
    mode: str = Form("text"),
    preset: str = Form("verified"),
    pages: str = Form(""),
    position: str = Form("center"),
    angle: float = Form(-45.0),
    size: float = Form(48.0),
    opacity: float = Form(0.22),
    color: str = Form("#b02730"),
    async_job: bool = False,
) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="watermark-text-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        page_indices = parse_page_ranges(pages) if pages.strip() else None
        if async_job:
            return enqueue_job(
                "watermark_text_upload",
                lambda progress: {
                    "output_path": str(
                        add_text_watermark_file(
                            target_path,
                            text,
                            mode=mode,
                            preset=preset,
                            page_indices=page_indices,
                            position=position,
                            angle=angle,
                            size=size,
                            opacity=opacity,
                            color=color,
                            on_progress=lambda value: progress(value, "Applying watermark"),
                        )
                    )
                },
            )
        output = add_text_watermark_file(
            target_path,
            text,
            mode=mode,
            preset=preset,
            page_indices=page_indices,
            position=position,
            angle=angle,
            size=size,
            opacity=opacity,
            color=color,
        )
        return ConvertResponse(output_path=str(output))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/watermark-image-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def watermark_image_upload(
    files: list[UploadFile] | None = File(None),
    image: UploadFile = File(...),
    input_path: str = Form(""),
    pages: str = Form(""),
    position: str = Form("center"),
    angle: float = Form(-45.0),
    size: float = Form(48.0),
    opacity: float = Form(0.22),
    async_job: bool = False,
) -> ConvertResponse | JobAcceptedResponse:
    if not input_path.strip() and len(files or []) != 1:
        raise HTTPException(status_code=400, detail="watermark-image-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        if input_path.strip():
            target_path = Path(input_path)
        else:
            upload = (files or [])[0]
            target_path = job_dir / (upload.filename or "input.pdf")
            target_path.write_bytes(await upload.read())

        image_path = job_dir / (image.filename or "watermark-image")
        image_path.write_bytes(await image.read())
        page_indices = parse_page_ranges(pages) if pages.strip() else None
        if async_job:
            return enqueue_job(
                "watermark_image_upload",
                lambda progress: {
                    "output_path": str(
                        add_image_watermark_file(
                            target_path,
                            image_path,
                            page_indices=page_indices,
                            position=position,
                            angle=angle,
                            size=size,
                            opacity=opacity,
                            on_progress=lambda value: progress(value, "Applying image mark"),
                        )
                    )
                },
            )
        output = add_image_watermark_file(
            target_path,
            image_path,
            page_indices=page_indices,
            position=position,
            angle=angle,
            size=size,
            opacity=opacity,
        )
        return ConvertResponse(output_path=str(output))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def merge_files_to_output(
    input_paths: list[Path],
    output_path: Path,
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    from engines.pdf.organize import merge as engine_merge

    return engine_merge(input_paths, output_path, on_progress=on_progress)


def images_to_pdf_files_to_output(
    input_paths: list[Path],
    output_path: Path,
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    from engines.images.to_pdf import images_to_pdf as engine_images_to_pdf

    return engine_images_to_pdf(input_paths, output_path, on_progress=on_progress)
