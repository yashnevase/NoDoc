from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_token
from app.api.organize_helpers import (
    convert_response,
    enqueue_job,
    merge_response,
    multi_output_response,
    parse_page_order,
    parse_page_ranges,
    preview_manifest_response,
    preview_page_response,
    preview_response,
    register_preview_session,
    require_single_input,
    resolve_preview_session,
    signature_report_response,
)
from app.api.organize_models import (
    CropRequest,
    CompressRequest,
    ConvertResponse,
    DrawRequest,
    DuplicateRequest,
    HighlightRequest,
    MetadataRequest,
    OcrRequest,
    OcrTextResponse,
    RedactRequest,
    JobAcceptedResponse,
    MergeRequest,
    MergeResponse,
    MultiOutputResponse,
    PageNumbersRequest,
    PreviewManifestResponse,
    PreviewPageResponse,
    PreviewResponse,
    SearchRequest,
    SearchResponse,
    ReverseRequest,
    SignatureReport,
)
from app.services.organize_service import (
    add_page_numbers_file,
    add_text_watermark_file,
    crop_pdf_file,
    compress_pdf_file,
    draw_pdf_file,
    highlight_pdf_file,
    redact_pdf_file,
    ocr_text_file,
    searchable_pdf_file,
    search_text_file,
    read_metadata_file,
    write_metadata_file,
    delete_pages_file,
    duplicate_pages_file,
    extract_pages_file,
    images_to_pdf_files,
    inspect_signatures_file,
    merge_files,
    password_protect_file,
    pdf_to_images_file,
    reorder_pages_file,
    repair_pdf_file,
    reverse_pages_file,
    rotate_pdf_file,
    split_pdf_file,
)
from engines.images.to_pdf import ImageEngineError
from engines.pdf.convert import render_pdf_manifest, render_pdf_page, render_pdf_preview
from engines.pdf.organize import PdfEngineError

router = APIRouter(dependencies=[Depends(require_token)])


@router.post("/merge", response_model=MergeResponse | JobAcceptedResponse)
async def merge(req: MergeRequest, async_job: bool = False) -> MergeResponse | JobAcceptedResponse:
    input_paths = [Path(path) for path in req.input_paths]
    if async_job:
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
        return merge_response(merge_files(input_paths))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/images-to-pdf", response_model=ConvertResponse | JobAcceptedResponse)
async def images_to_pdf(req: MergeRequest, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_paths = [Path(path) for path in req.input_paths]
    if async_job:
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
        return convert_response(images_to_pdf_files(input_paths))
    except ImageEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/split-pdf", response_model=MultiOutputResponse | JobAcceptedResponse)
async def split_pdf(req: MergeRequest, async_job: bool = False) -> MultiOutputResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "split-pdf expects exactly one input PDF")
    if async_job:
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
        return multi_output_response(split_pdf_file(input_path))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/pdf-to-images", response_model=MultiOutputResponse | JobAcceptedResponse)
async def pdf_to_images(req: MergeRequest, async_job: bool = False) -> MultiOutputResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "pdf-to-images expects exactly one input PDF")
    if async_job:
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
        return multi_output_response(pdf_to_images_file(input_path))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/preview-pdf", response_model=PreviewResponse)
async def preview_pdf(req: MergeRequest) -> PreviewResponse:
    input_path = require_single_input(req.input_paths, "preview-pdf expects exactly one input PDF")
    try:
        return preview_response(render_pdf_preview(input_path))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/preview-manifest", response_model=PreviewManifestResponse)
async def preview_manifest(req: MergeRequest) -> PreviewManifestResponse:
    input_path = require_single_input(req.input_paths, "preview-manifest expects exactly one input PDF")
    try:
        preview_id = register_preview_session(input_path)
        return preview_manifest_response(preview_id, render_pdf_manifest(input_path))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/preview-page", response_model=PreviewPageResponse)
async def preview_page(preview_id: str | None = None, path: str | None = None, page: int = 1, scale: float = 0.55) -> PreviewPageResponse:
    try:
        preview_path = resolve_preview_session(preview_id, path)
        return preview_page_response(render_pdf_page(preview_path, page, scale=scale))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/extract-pages", response_model=ConvertResponse | JobAcceptedResponse)
async def extract_pages(req: MergeRequest, pages: str = "", async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "extract-pages expects exactly one input PDF")
    page_indices = parse_page_ranges(pages)
    if async_job:
        return enqueue_job(
            "extract_pages",
            lambda progress: {"output_path": str(extract_pages_file(input_path, page_indices))},
        )
    try:
        return convert_response(extract_pages_file(input_path, page_indices))
    except (PdfEngineError, IndexError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/delete-pages", response_model=ConvertResponse | JobAcceptedResponse)
async def delete_pages(req: MergeRequest, pages: str = "", async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "delete-pages expects exactly one input PDF")
    page_indices = parse_page_ranges(pages)
    if async_job:
        return enqueue_job(
            "delete_pages",
            lambda progress: {"output_path": str(delete_pages_file(input_path, page_indices))},
        )
    try:
        return convert_response(delete_pages_file(input_path, page_indices))
    except (PdfEngineError, IndexError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/rotate-pdf", response_model=ConvertResponse | JobAcceptedResponse)
async def rotate_pdf(req: MergeRequest, degrees: int, pages: str = "", async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "rotate-pdf expects exactly one input PDF")
    page_indices = parse_page_ranges(pages) if pages.strip() else None
    if async_job:
        return enqueue_job(
            "rotate_pdf",
            lambda progress: {"output_path": str(rotate_pdf_file(input_path, degrees, page_indices))},
        )
    try:
        return convert_response(rotate_pdf_file(input_path, degrees, page_indices))
    except (PdfEngineError, IndexError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/reorder-pages", response_model=ConvertResponse | JobAcceptedResponse)
async def reorder_pages(req: MergeRequest, order: str = "", async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "reorder-pages expects exactly one input PDF")
    page_indices = parse_page_order(order)
    if async_job:
        return enqueue_job(
            "reorder_pages",
            lambda progress: {"output_path": str(reorder_pages_file(input_path, page_indices))},
        )
    try:
        return convert_response(reorder_pages_file(input_path, page_indices))
    except (PdfEngineError, IndexError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/reverse-pages", response_model=ConvertResponse | JobAcceptedResponse)
async def reverse_pages(req: ReverseRequest, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = Path(req.input_paths[0])
    if async_job:
        return enqueue_job(
            "reverse_pages",
            lambda progress: {"output_path": str(reverse_pages_file(input_path))},
        )
    try:
        return convert_response(reverse_pages_file(input_path))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/duplicate-pages", response_model=ConvertResponse | JobAcceptedResponse)
async def duplicate_pages(req: DuplicateRequest, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = Path(req.input_paths[0])
    page_indices = parse_page_ranges(req.pages)
    if async_job:
        return enqueue_job(
            "duplicate_pages",
            lambda progress: {"output_path": str(duplicate_pages_file(input_path, page_indices))},
        )
    try:
        return convert_response(duplicate_pages_file(input_path, page_indices))
    except (PdfEngineError, IndexError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/page-numbers", response_model=ConvertResponse | JobAcceptedResponse)
async def page_numbers(req: PageNumbersRequest, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = Path(req.input_paths[0])
    page_indices = parse_page_ranges(req.pages) if req.pages.strip() else None
    if async_job:
        return enqueue_job(
            "page_numbers",
            lambda progress: {
                "output_path": str(
                    add_page_numbers_file(
                        input_path,
                        page_indices=page_indices,
                        position=req.position,
                        size=req.size,
                        opacity=req.opacity,
                        color=req.color,
                        prefix=req.prefix,
                        suffix=req.suffix,
                        start=req.start,
                    )
                )
            },
        )
    try:
        return convert_response(
            add_page_numbers_file(
                input_path,
                page_indices=page_indices,
                position=req.position,
                size=req.size,
                opacity=req.opacity,
                color=req.color,
                prefix=req.prefix,
                suffix=req.suffix,
                start=req.start,
            )
        )
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/crop-pdf", response_model=ConvertResponse | JobAcceptedResponse)
async def crop_pdf(req: CropRequest, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "crop-pdf expects exactly one input PDF")
    page_indices = parse_page_ranges(req.pages) if req.pages.strip() else None
    if async_job:
        return enqueue_job(
            "crop_pdf",
            lambda progress: {
                "output_path": str(
                    crop_pdf_file(
                        input_path,
                        page_indices=page_indices,
                        left=req.left,
                        top=req.top,
                        right=req.right,
                        bottom=req.bottom,
                    )
                )
            },
        )
    try:
        return convert_response(
            crop_pdf_file(
                input_path,
                page_indices=page_indices,
                left=req.left,
                top=req.top,
                right=req.right,
                bottom=req.bottom,
            )
        )
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/password-protect", response_model=ConvertResponse | JobAcceptedResponse)
async def password_protect(req: MergeRequest, password: str, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "password-protect expects exactly one input PDF")
    if async_job:
        return enqueue_job(
            "password_protect",
            lambda progress: {"output_path": str(password_protect_file(input_path, password))},
        )
    try:
        return convert_response(password_protect_file(input_path, password))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/signature-report", response_model=SignatureReport)
async def signature_report(req: MergeRequest) -> SignatureReport:
    input_path = require_single_input(req.input_paths, "signature-report expects exactly one input PDF")
    try:
        return signature_report_response(inspect_signatures_file(input_path))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/search-text", response_model=SearchResponse)
async def search_text(req: SearchRequest) -> SearchResponse:
    input_path = require_single_input(req.input_paths, "search-text expects exactly one input PDF")
    try:
        return SearchResponse(**search_text_file(input_path, req.query))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/ocr-text", response_model=OcrTextResponse | JobAcceptedResponse)
async def ocr_text(req: OcrRequest, async_job: bool = False) -> OcrTextResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "ocr-text expects exactly one input PDF")
    if async_job:
        return enqueue_job(
            "ocr_text",
            lambda progress: ocr_text_file(
                input_path,
                lang=req.lang,
                on_progress=lambda value: progress(value, "Running OCR"),
            ),
        )
    try:
        return OcrTextResponse(**ocr_text_file(input_path, lang=req.lang))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/searchable-pdf", response_model=ConvertResponse | JobAcceptedResponse)
async def searchable_pdf(req: OcrRequest, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "searchable-pdf expects exactly one input PDF")
    if async_job:
        return enqueue_job(
            "searchable_pdf",
            lambda progress: {
                "output_path": str(
                    searchable_pdf_file(
                        input_path,
                        lang=req.lang,
                        on_progress=lambda value: progress(value, "Building searchable PDF"),
                    )
                )
            },
        )
    try:
        return convert_response(searchable_pdf_file(input_path, lang=req.lang))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/repair-pdf", response_model=ConvertResponse | JobAcceptedResponse)
async def repair_pdf(req: MergeRequest, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "repair-pdf expects exactly one input PDF")
    if async_job:
        return enqueue_job(
            "repair_pdf",
            lambda progress: {"output_path": str(repair_pdf_file(input_path))},
        )
    try:
        return convert_response(repair_pdf_file(input_path))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/compress-pdf", response_model=ConvertResponse | JobAcceptedResponse)
async def compress_pdf(req: CompressRequest, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "compress-pdf expects exactly one input PDF")
    if async_job:
        return enqueue_job(
            "compress_pdf",
            lambda progress: {
                "output_path": str(
                    compress_pdf_file(
                        input_path,
                        preset=req.preset,
                        on_progress=lambda value: progress(value, "Compressing PDF"),
                    )
                )
            },
        )
    try:
        return convert_response(compress_pdf_file(input_path, preset=req.preset))
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/metadata", response_model=ConvertResponse | JobAcceptedResponse)
async def metadata(req: MetadataRequest, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "metadata expects exactly one input PDF")
    if async_job:
        return enqueue_job(
            "metadata",
            lambda progress: {
                "output_path": str(
                    write_metadata_file(
                        input_path,
                        title=req.title,
                        author=req.author,
                        subject=req.subject,
                        keywords=req.keywords,
                        creator=req.creator,
                        producer=req.producer,
                        remove_all=req.remove_all,
                    )
                )
            },
        )
    try:
        return convert_response(
            write_metadata_file(
                input_path,
                title=req.title,
                author=req.author,
                subject=req.subject,
                keywords=req.keywords,
                creator=req.creator,
                producer=req.producer,
                remove_all=req.remove_all,
            )
        )
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/metadata-view")
async def metadata_view(req: MergeRequest) -> dict[str, object]:
    input_path = require_single_input(req.input_paths, "metadata-view expects exactly one input PDF")
    try:
        return {"metadata": read_metadata_file(input_path)}
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/redact-pdf", response_model=ConvertResponse | JobAcceptedResponse)
async def redact_pdf(req: RedactRequest, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "redact-pdf expects exactly one input PDF")
    regions = [region.model_dump() for region in req.regions]
    if async_job:
        return enqueue_job(
            "redact_pdf",
            lambda progress: {
                "output_path": str(
                    redact_pdf_file(
                        input_path,
                        regions=regions,
                        color=req.color,
                        on_progress=lambda value: progress(value, "Applying redactions"),
                    )
                )
            },
        )
    try:
        return convert_response(
            redact_pdf_file(
                input_path,
                regions=regions,
                color=req.color,
            )
        )
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/highlight-pdf", response_model=ConvertResponse | JobAcceptedResponse)
async def highlight_pdf(req: HighlightRequest, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "highlight-pdf expects exactly one input PDF")
    regions = [region.model_dump() for region in req.regions]
    if async_job:
        return enqueue_job(
            "highlight_pdf",
            lambda progress: {
                "output_path": str(
                    highlight_pdf_file(
                        input_path,
                        regions=regions,
                        color=req.color,
                        opacity=req.opacity,
                        on_progress=lambda value: progress(value, "Applying highlights"),
                    )
                )
            },
        )
    try:
        return convert_response(
            highlight_pdf_file(
                input_path,
                regions=regions,
                color=req.color,
                opacity=req.opacity,
            )
        )
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/draw-pdf", response_model=ConvertResponse | JobAcceptedResponse)
async def draw_pdf(req: DrawRequest, async_job: bool = False) -> ConvertResponse | JobAcceptedResponse:
    input_path = require_single_input(req.input_paths, "draw-pdf expects exactly one input PDF")
    strokes = [stroke.model_dump() for stroke in req.strokes]
    if async_job:
        return enqueue_job(
            "draw_pdf",
            lambda progress: {
                "output_path": str(
                    draw_pdf_file(
                        input_path,
                        strokes=strokes,
                        color=req.color,
                        opacity=req.opacity,
                        thickness=req.thickness,
                        on_progress=lambda value: progress(value, "Applying drawing"),
                    )
                )
            },
        )
    try:
        return convert_response(
            draw_pdf_file(
                input_path,
                strokes=strokes,
                color=req.color,
                opacity=req.opacity,
                thickness=req.thickness,
            )
        )
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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
    input_path = require_single_input(req.input_paths, "watermark-text expects exactly one input PDF")
    page_indices = parse_page_ranges(pages) if pages.strip() else None
    if async_job:
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
        return convert_response(
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
            )
        )
    except PdfEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
