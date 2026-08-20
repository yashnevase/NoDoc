from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.auth import require_token
from app.api.organize_helpers import (
    convert_response,
    enqueue_job,
    merge_response,
    multi_output_response,
    parse_page_order,
    parse_page_ranges,
    preview_manifest_response,
    preview_response,
    register_preview_session,
    signature_report_response,
)
from app.api.organize_models import (
    ConvertResponse,
    CropRequest,
    JobAcceptedResponse,
    MergeResponse,
    MultiOutputResponse,
    PreviewManifestResponse,
    PreviewResponse,
    MetadataRequest,
    SignatureReport,
)
from app.services.organize_service import (
    add_image_watermark_file,
    add_page_numbers_file,
    add_text_watermark_file,
    crop_pdf_file,
    compress_pdf_file,
    cleanup_job_dir,
    create_upload_job_dir,
    delete_pages_file,
    duplicate_pages_file,
    extract_pages_file,
    images_to_pdf_files_to_output,
    inspect_signatures_file,
    read_metadata_file,
    merge_files_to_output,
    password_protect_file,
    pdf_to_images_file,
    reorder_pages_file,
    repair_pdf_file,
    reverse_pages_file,
    rotate_pdf_file,
    safe_upload_output_path,
    write_metadata_file,
    split_pdf_file,
)
from app.services.upload_service import save_upload, save_uploads
from engines.images.to_pdf import ImageEngineError
from engines.pdf.convert import render_pdf_manifest, render_pdf_preview
from engines.pdf.organize import PdfEngineError

router = APIRouter(dependencies=[Depends(require_token)])


@router.post("/merge-upload", response_model=MergeResponse | JobAcceptedResponse)
async def merge_upload(files: list[UploadFile] = File(...), async_job: bool = False) -> MergeResponse | JobAcceptedResponse:
    if not files:
        raise HTTPException(status_code=400, detail="no files uploaded")

    job_dir = create_upload_job_dir()
    try:
        input_paths = await save_uploads(files, job_dir, fallback_prefix="upload", fallback_suffix=".pdf")
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
        return merge_response(merge_files_to_output(input_paths, output_path))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/images-to-pdf-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def images_to_pdf_upload(files: list[UploadFile] = File(...), async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if not files:
        raise HTTPException(status_code=400, detail="no files uploaded")

    job_dir = create_upload_job_dir()
    try:
        input_paths = await save_uploads(files, job_dir, fallback_prefix="image")
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
        return convert_response(images_to_pdf_files_to_output(input_paths, output_path))
    except ImageEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/split-pdf-upload", response_model=MultiOutputResponse | JobAcceptedResponse)
async def split_pdf_upload(files: list[UploadFile] = File(...), async_job: bool = False) -> MultiOutputResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="split-pdf-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
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
        return multi_output_response(split_pdf_file(target_path))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/pdf-to-images-upload", response_model=MultiOutputResponse | JobAcceptedResponse)
async def pdf_to_images_upload(files: list[UploadFile] = File(...), async_job: bool = False) -> MultiOutputResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="pdf-to-images-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
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
        return multi_output_response(pdf_to_images_file(target_path))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/preview-pdf-upload", response_model=PreviewResponse)
async def preview_pdf_upload(files: list[UploadFile] = File(...)) -> PreviewResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="preview-pdf-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        return preview_response(render_pdf_preview(target_path))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/preview-manifest-upload", response_model=PreviewManifestResponse)
async def preview_manifest_upload(files: list[UploadFile] = File(...)) -> PreviewManifestResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="preview-manifest-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        preview_id = register_preview_session(target_path)
        return preview_manifest_response(preview_id, render_pdf_manifest(target_path))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/extract-pages-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def extract_pages_upload(files: list[UploadFile] = File(...), pages: str = Form(...), async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="extract-pages-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        page_indices = parse_page_ranges(pages)
        if async_job:
            return enqueue_job(
                "extract_pages_upload",
                lambda progress: {"output_path": str(extract_pages_file(target_path, page_indices))},
            )
        return convert_response(extract_pages_file(target_path, page_indices))
    except (PdfEngineError, IndexError) as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/delete-pages-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def delete_pages_upload(files: list[UploadFile] = File(...), pages: str = Form(...), async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="delete-pages-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        page_indices = parse_page_ranges(pages)
        if async_job:
            return enqueue_job(
                "delete_pages_upload",
                lambda progress: {"output_path": str(delete_pages_file(target_path, page_indices))},
            )
        return convert_response(delete_pages_file(target_path, page_indices))
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

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        page_indices = parse_page_ranges(pages) if pages.strip() else None
        if async_job:
            return enqueue_job(
                "rotate_pdf_upload",
                lambda progress: {"output_path": str(rotate_pdf_file(target_path, degrees, page_indices))},
            )
        return convert_response(rotate_pdf_file(target_path, degrees, page_indices))
    except (PdfEngineError, IndexError) as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/reorder-pages-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def reorder_pages_upload(files: list[UploadFile] = File(...), order: str = Form(...), async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="reorder-pages-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        page_indices = parse_page_order(order)
        if async_job:
            return enqueue_job(
                "reorder_pages_upload",
                lambda progress: {"output_path": str(reorder_pages_file(target_path, page_indices))},
            )
        return convert_response(reorder_pages_file(target_path, page_indices))
    except (PdfEngineError, IndexError) as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/reverse-pages-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def reverse_pages_upload(files: list[UploadFile] = File(...), async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="reverse-pages-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        if async_job:
            return enqueue_job(
                "reverse_pages_upload",
                lambda progress: {"output_path": str(reverse_pages_file(target_path))},
            )
        return convert_response(reverse_pages_file(target_path))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/duplicate-pages-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def duplicate_pages_upload(files: list[UploadFile] = File(...), pages: str = Form(...), async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="duplicate-pages-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        page_indices = parse_page_ranges(pages)
        if async_job:
            return enqueue_job(
                "duplicate_pages_upload",
                lambda progress: {"output_path": str(duplicate_pages_file(target_path, page_indices))},
            )
        return convert_response(duplicate_pages_file(target_path, page_indices))
    except (PdfEngineError, IndexError) as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/page-numbers-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def page_numbers_upload(
    files: list[UploadFile] = File(...),
    pages: str = Form(""),
    position: str = Form("bottom-right"),
    size: float = Form(12.0),
    opacity: float = Form(0.7),
    color: str = Form("#b02730"),
    prefix: str = Form(""),
    suffix: str = Form(""),
    start: int = Form(1),
    async_job: bool = False,
) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="page-numbers-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        page_indices = parse_page_ranges(pages) if pages.strip() else None
        if async_job:
            return enqueue_job(
                "page_numbers_upload",
                lambda progress: {
                    "output_path": str(
                        add_page_numbers_file(
                            target_path,
                            page_indices=page_indices,
                            position=position,
                            size=size,
                            opacity=opacity,
                            color=color,
                            prefix=prefix,
                            suffix=suffix,
                            start=start,
                        )
                    )
                },
            )
        return convert_response(
            add_page_numbers_file(
                target_path,
                page_indices=page_indices,
                position=position,
                size=size,
                opacity=opacity,
                color=color,
                prefix=prefix,
                suffix=suffix,
                start=start,
            )
        )
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/crop-pdf-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def crop_pdf_upload(
    files: list[UploadFile] = File(...),
    pages: str = Form(""),
    left: float = Form(0.0),
    top: float = Form(0.0),
    right: float = Form(0.0),
    bottom: float = Form(0.0),
    async_job: bool = False,
) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="crop-pdf-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        page_indices = parse_page_ranges(pages) if pages.strip() else None
        if async_job:
            return enqueue_job(
                "crop_pdf_upload",
                lambda progress: {
                    "output_path": str(
                        crop_pdf_file(
                            target_path,
                            page_indices=page_indices,
                            left=left,
                            top=top,
                            right=right,
                            bottom=bottom,
                        )
                    )
                },
            )
        return convert_response(
            crop_pdf_file(
                target_path,
                page_indices=page_indices,
                left=left,
                top=top,
                right=right,
                bottom=bottom,
            )
        )
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/compress-pdf-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def compress_pdf_upload(
    files: list[UploadFile] = File(...),
    preset: str = Form("balanced"),
    async_job: bool = False,
) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="compress-pdf-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        if async_job:
            return enqueue_job(
                "compress_pdf_upload",
                lambda progress: {
                    "output_path": str(
                        compress_pdf_file(
                            target_path,
                            preset=preset,
                            on_progress=lambda value: progress(value, "Compressing PDF"),
                        )
                    )
                },
            )
        return convert_response(compress_pdf_file(target_path, preset=preset))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/metadata-view-upload")
async def metadata_view_upload(files: list[UploadFile] = File(...)) -> dict[str, object]:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="metadata-view-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        return {"metadata": read_metadata_file(target_path)}
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/metadata-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def metadata_upload(
    files: list[UploadFile] = File(...),
    title: str = Form(""),
    author: str = Form(""),
    subject: str = Form(""),
    keywords: str = Form(""),
    creator: str = Form(""),
    producer: str = Form(""),
    remove_all: bool = Form(False),
    async_job: bool = False,
) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="metadata-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        if async_job:
            return enqueue_job(
                "metadata_upload",
                lambda progress: {
                    "output_path": str(
                        write_metadata_file(
                            target_path,
                            title=title,
                            author=author,
                            subject=subject,
                            keywords=keywords,
                            creator=creator,
                            producer=producer,
                            remove_all=remove_all,
                        )
                    )
                },
            )
        return convert_response(
            write_metadata_file(
                target_path,
                title=title,
                author=author,
                subject=subject,
                keywords=keywords,
                creator=creator,
                producer=producer,
                remove_all=remove_all,
            )
        )
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/password-protect-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def password_protect_upload(files: list[UploadFile] = File(...), password: str = Form(...), async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="password-protect-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        if async_job:
            return enqueue_job(
                "password_protect_upload",
                lambda progress: {"output_path": str(password_protect_file(target_path, password))},
            )
        return convert_response(password_protect_file(target_path, password))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/signature-report-upload", response_model=SignatureReport)
async def signature_report_upload(files: list[UploadFile] = File(...)) -> SignatureReport:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="signature-report-upload expects exactly one input PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        return signature_report_response(inspect_signatures_file(target_path))
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/repair-pdf-upload", response_model=ConvertResponse | JobAcceptedResponse)
async def repair_pdf_upload(files: list[UploadFile] = File(...), async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    if len(files) != 1:
        raise HTTPException(status_code=400, detail="repair-pdf-upload expects exactly one PDF")

    job_dir = create_upload_job_dir()
    try:
        target_path = await save_upload(files[0], job_dir, "input.pdf")
        if async_job:
            return enqueue_job(
                "repair_pdf_upload",
                lambda progress: {"output_path": str(repair_pdf_file(target_path))},
            )
        return convert_response(repair_pdf_file(target_path))
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
        target_path = await save_upload(files[0], job_dir, "input.pdf")
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
        return convert_response(
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
            )
        )
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
        target_path = Path(input_path) if input_path.strip() else await save_upload((files or [])[0], job_dir, "input.pdf")
        image_path = await save_upload(image, job_dir, "watermark-image")
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
        return convert_response(
            add_image_watermark_file(
                target_path,
                image_path,
                page_indices=page_indices,
                position=position,
                angle=angle,
                size=size,
                opacity=opacity,
            )
        )
    except PdfEngineError as exc:
        cleanup_job_dir(job_dir)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
