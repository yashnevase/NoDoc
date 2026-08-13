from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, field_validator

from app.auth import require_token
from app.services.organize_service import (
    cleanup_job_dir,
    create_upload_job_dir,
    delete_pages_file,
    extract_pages_file,
    images_to_pdf_files,
    merge_files,
    password_protect_file,
    pdf_to_images_file,
    remove_metadata_file,
    rotate_pdf_file,
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


class PreviewPage(BaseModel):
    page: int
    image: str


class PreviewResponse(BaseModel):
    pages: list[PreviewPage]


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


@router.post("/merge", response_model=MergeResponse)
async def merge(req: MergeRequest) -> MergeResponse:
    try:
        output = merge_files([Path(p) for p in req.input_paths])
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MergeResponse(output_path=str(output))


@router.post("/images-to-pdf", response_model=ConvertResponse)
async def images_to_pdf(req: MergeRequest) -> ConvertResponse:
    try:
        output = images_to_pdf_files([Path(p) for p in req.input_paths])
    except ImageEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ConvertResponse(output_path=str(output))


@router.post("/split-pdf", response_model=MultiOutputResponse)
async def split_pdf(req: MergeRequest) -> MultiOutputResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="split-pdf expects exactly one input PDF")
    try:
        output_paths = split_pdf_file(Path(req.input_paths[0]))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MultiOutputResponse(output_paths=[str(path) for path in output_paths])


@router.post("/pdf-to-images", response_model=MultiOutputResponse)
async def pdf_to_images(req: MergeRequest) -> MultiOutputResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="pdf-to-images expects exactly one input PDF")
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


@router.post("/extract-pages", response_model=ConvertResponse)
async def extract_pages(req: MergeRequest, pages: str = "") -> ConvertResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="extract-pages expects exactly one input PDF")
    try:
        output = extract_pages_file(Path(req.input_paths[0]), parse_page_ranges(pages))
    except (PdfEngineError, IndexError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ConvertResponse(output_path=str(output))


@router.post("/delete-pages", response_model=ConvertResponse)
async def delete_pages(req: MergeRequest, pages: str = "") -> ConvertResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="delete-pages expects exactly one input PDF")
    try:
        output = delete_pages_file(Path(req.input_paths[0]), parse_page_ranges(pages))
    except (PdfEngineError, IndexError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ConvertResponse(output_path=str(output))


@router.post("/rotate-pdf", response_model=ConvertResponse)
async def rotate_pdf(req: MergeRequest, degrees: int, pages: str = "") -> ConvertResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="rotate-pdf expects exactly one input PDF")
    page_indices = parse_page_ranges(pages) if pages.strip() else None
    try:
        output = rotate_pdf_file(Path(req.input_paths[0]), degrees, page_indices)
    except (PdfEngineError, IndexError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ConvertResponse(output_path=str(output))


@router.post("/password-protect", response_model=ConvertResponse)
async def password_protect(req: MergeRequest, password: str) -> ConvertResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="password-protect expects exactly one input PDF")
    try:
        output = password_protect_file(Path(req.input_paths[0]), password)
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ConvertResponse(output_path=str(output))


@router.post("/remove-metadata", response_model=ConvertResponse)
async def remove_metadata(req: MergeRequest) -> ConvertResponse:
    if len(req.input_paths) != 1:
        raise HTTPException(status_code=400, detail="remove-metadata expects exactly one input PDF")
    try:
        output = remove_metadata_file(Path(req.input_paths[0]))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ConvertResponse(output_path=str(output))


@router.post("/merge-upload", response_model=MergeResponse)
async def merge_upload(files: list[UploadFile] = File(...)) -> MergeResponse:
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
        output = merge_files_to_output(input_paths, output_path)
        return MergeResponse(output_path=str(output))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/images-to-pdf-upload", response_model=ConvertResponse)
async def images_to_pdf_upload(files: list[UploadFile] = File(...)) -> ConvertResponse:
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
        output = images_to_pdf_files_to_output(input_paths, output_path)
        return ConvertResponse(output_path=str(output))
    except ImageEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/split-pdf-upload", response_model=MultiOutputResponse)
async def split_pdf_upload(files: list[UploadFile] = File(...)) -> MultiOutputResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="split-pdf-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        output_paths = split_pdf_file(target_path)
        return MultiOutputResponse(output_paths=[str(path) for path in output_paths])
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/pdf-to-images-upload", response_model=MultiOutputResponse)
async def pdf_to_images_upload(files: list[UploadFile] = File(...)) -> MultiOutputResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="pdf-to-images-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
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


@router.post("/extract-pages-upload", response_model=ConvertResponse)
async def extract_pages_upload(
    files: list[UploadFile] = File(...),
    pages: str = Form(...),
) -> ConvertResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="extract-pages-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        output = extract_pages_file(target_path, parse_page_ranges(pages))
        return ConvertResponse(output_path=str(output))
    except (PdfEngineError, IndexError) as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/delete-pages-upload", response_model=ConvertResponse)
async def delete_pages_upload(
    files: list[UploadFile] = File(...),
    pages: str = Form(...),
) -> ConvertResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="delete-pages-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        output = delete_pages_file(target_path, parse_page_ranges(pages))
        return ConvertResponse(output_path=str(output))
    except (PdfEngineError, IndexError) as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/rotate-pdf-upload", response_model=ConvertResponse)
async def rotate_pdf_upload(
    files: list[UploadFile] = File(...),
    degrees: int = Form(...),
    pages: str = Form(""),
) -> ConvertResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="rotate-pdf-upload expects exactly one PDF")

    page_indices = parse_page_ranges(pages) if pages.strip() else None
    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        output = rotate_pdf_file(target_path, degrees, page_indices)
        return ConvertResponse(output_path=str(output))
    except (PdfEngineError, IndexError) as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/password-protect-upload", response_model=ConvertResponse)
async def password_protect_upload(
    files: list[UploadFile] = File(...),
    password: str = Form(...),
) -> ConvertResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="password-protect-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        output = password_protect_file(target_path, password)
        return ConvertResponse(output_path=str(output))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/remove-metadata-upload", response_model=ConvertResponse)
async def remove_metadata_upload(files: list[UploadFile] = File(...)) -> ConvertResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="remove-metadata-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        upload = files[0]
        target_path = job_dir / (upload.filename or "input.pdf")
        target_path.write_bytes(await upload.read())
        output = remove_metadata_file(target_path)
        return ConvertResponse(output_path=str(output))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def merge_files_to_output(input_paths: list[Path], output_path: Path) -> Path:
    from engines.pdf.organize import merge as engine_merge

    return engine_merge(input_paths, output_path)


def images_to_pdf_files_to_output(input_paths: list[Path], output_path: Path) -> Path:
    from engines.images.to_pdf import images_to_pdf as engine_images_to_pdf

    return engine_images_to_pdf(input_paths, output_path)
