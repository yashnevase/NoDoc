"""
Core PDF organization operations: merge, split, extract, delete, reorder, rotate.

Deliberately has zero web/framework imports — this module should be usable
from a future CLI or test harness without pulling in FastAPI.
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable

import pikepdf

from ._marking import (
    MarkingError,
    clamp as _clamp,
    add_opacity_resource as _add_opacity_resource,
    build_image_watermark_stream as _build_image_watermark_stream,
    build_watermark_stream as _build_watermark_stream,
    escape_pdf_text as _escape_pdf_text,
    estimate_text_width as _estimate_text_width,
    hex_to_rgb as _hex_to_rgb,
    load_image_xobject as _load_image_xobject,
    watermark_position as _watermark_position,
    page_size as _page_size,
    target_page_indices as _target_page_indices,
)


class PdfEngineError(Exception):
    """Raised for any recoverable failure in PDF processing (bad input, etc.)."""


def merge(
    input_paths: list[Path],
    output_path: Path,
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    if not input_paths:
        raise PdfEngineError("no input files provided")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.new() as target:
        for index, src in enumerate(input_paths, start=1):
            if not src.exists():
                raise PdfEngineError(f"input file not found: {src.name}")
            try:
                with pikepdf.open(src) as doc:
                    target.pages.extend(doc.pages)
                    if on_progress is not None:
                        on_progress(int((index / max(1, len(input_paths))) * 100))
            except pikepdf.PasswordError as exc:
                raise PdfEngineError(f"'{src.name}' is password-protected") from exc
            except pikepdf.PdfError as exc:
                raise PdfEngineError(f"'{src.name}' could not be read: {exc}") from exc
        target.save(output_path)

    return output_path


def rotate(input_path: Path, output_path: Path, degrees: int, pages: list[int] | None = None) -> Path:
    """degrees must be a multiple of 90. pages is 0-indexed; None = all pages."""
    if degrees % 90 != 0:
        raise PdfEngineError("rotation must be a multiple of 90 degrees")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.open(input_path) as doc:
        target_pages = range(len(doc.pages)) if pages is None else pages
        for i in target_pages:
            doc.pages[i].rotate(degrees, relative=True)
        doc.save(output_path)

    return output_path


def extract_pages(input_path: Path, output_path: Path, page_indices: list[int]) -> Path:
    """page_indices are 0-indexed pages to copy into a new PDF."""
    if not page_indices:
        raise PdfEngineError("no pages selected")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.open(input_path) as doc:
        with pikepdf.new() as target:
            for i in page_indices:
                target.pages.append(doc.pages[i])
            target.save(output_path)

    return output_path


def delete_pages(input_path: Path, output_path: Path, page_indices: list[int]) -> Path:
    """page_indices are 0-indexed pages to remove."""
    if not page_indices:
        raise PdfEngineError("no pages selected")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.open(input_path) as doc:
        if len(page_indices) >= len(doc.pages):
            raise PdfEngineError("cannot delete every page in a PDF")
        for i in sorted(page_indices, reverse=True):
            del doc.pages[i]
        doc.save(output_path)

    return output_path


def reorder_pages(input_path: Path, output_path: Path, page_indices: list[int]) -> Path:
    """page_indices are 0-indexed pages in the desired output order."""
    if not page_indices:
        raise PdfEngineError("no pages selected")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.open(input_path) as doc:
        page_count = len(doc.pages)
        expected = set(range(page_count))
        requested = set(page_indices)
        if len(page_indices) != page_count or requested != expected:
            raise PdfEngineError("page order must include every page exactly once")

        with pikepdf.new() as target:
            for i in page_indices:
                target.pages.append(doc.pages[i])
            target.save(output_path)

    return output_path


def reverse_pages(input_path: Path, output_path: Path) -> Path:
    """Reverse the order of every page in the PDF."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.open(input_path) as doc:
        with pikepdf.new() as target:
            for page in reversed(doc.pages):
                target.pages.append(page)
            target.save(output_path)

    return output_path


def duplicate_pages(input_path: Path, output_path: Path, page_indices: list[int]) -> Path:
    """Duplicate selected pages in-place after their original copies."""
    if not page_indices:
        raise PdfEngineError("no pages selected")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.open(input_path) as doc:
        page_count = len(doc.pages)
        if any(i < 0 or i >= page_count for i in page_indices):
            raise PdfEngineError("one or more page numbers are out of range")

        duplicates = list(page_indices)
        with pikepdf.new() as target:
            for index, page in enumerate(doc.pages):
                target.pages.append(page)
                if index in duplicates:
                    target.pages.append(page)
            target.save(output_path)

    return output_path


def repair(input_path: Path, output_path: Path) -> Path:
    """Best-effort rewrite for PDFs pikepdf can recover and resave cleanly."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with pikepdf.open(input_path) as doc:
            doc.save(output_path)
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be repaired: {exc}") from exc

    return output_path


def add_text_watermark(
    input_path: Path,
    output_path: Path,
    text: str,
    *,
    kind: str = "text",
    badge: str = "verified",
    page_indices: list[int] | None = None,
    position: str = "center",
    angle: float = -45.0,
    opacity: float = 0.22,
    size: float = 48.0,
    color: str = "#b02730",
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    if kind == "text" and not text.strip():
        raise PdfEngineError("watermark text must not be empty")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    opacity = _clamp(opacity, 0.05, 1.0)
    size = _clamp(size, 12.0, 180.0)

    try:
        with pikepdf.open(input_path) as doc:
            target_pages = _target_page_indices(doc, page_indices)
            for offset, i in enumerate(target_pages, start=1):
                page = doc.pages[i]
                gs_name = _add_opacity_resource(page, opacity)
                width, height = _page_size(page)
                content = _build_watermark_stream(
                    kind=kind,
                    text=text,
                    badge=badge,
                    position=position,
                    angle=angle,
                    opacity=opacity,
                    size=size,
                    color=color,
                    width=width,
                    height=height,
                )
                page.contents_add(
                    pikepdf.Stream(
                        doc,
                        content.replace(b"/NoDocGS1", f"/{str(gs_name)[1:]}".encode("ascii")),
                    )
                )
                if on_progress is not None:
                    on_progress(int((offset / max(1, len(target_pages))) * 100))

            doc.save(output_path)
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except MarkingError as exc:
        raise PdfEngineError(str(exc)) from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be watermarked: {exc}") from exc

    return output_path


def add_image_watermark(
    input_path: Path,
    output_path: Path,
    image_path: Path,
    *,
    page_indices: list[int] | None = None,
    position: str = "center",
    angle: float = -45.0,
    opacity: float = 0.22,
    size: float = 48.0,
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    opacity = _clamp(opacity, 0.05, 1.0)
    size = _clamp(size, 12.0, 180.0)

    try:
        with pikepdf.open(input_path) as doc:
            image_stream, image_width, image_height = _load_image_xobject(doc, image_path)
            target_pages = _target_page_indices(doc, page_indices)
            for offset, i in enumerate(target_pages, start=1):
                page = doc.pages[i]
                gs_name = _add_opacity_resource(page, opacity)
                image_name = page.add_resource(image_stream, pikepdf.Name.XObject, prefix="NoDocImg")
                width, height = _page_size(page)
                content = _build_image_watermark_stream(
                    image_name=image_name,
                    position=position,
                    angle=angle,
                    size=size,
                    page_width=width,
                    page_height=height,
                    image_width=image_width,
                    image_height=image_height,
                )
                page.contents_add(
                    pikepdf.Stream(
                        doc,
                        content.replace(b"/NoDocGS1", f"/{str(gs_name)[1:]}".encode("ascii")),
                    )
                )
                if on_progress is not None:
                    on_progress(int((offset / max(1, len(target_pages))) * 100))

            doc.save(output_path)
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except MarkingError as exc:
        raise PdfEngineError(str(exc)) from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be watermarked: {exc}") from exc

    return output_path


def add_page_numbers(
    input_path: Path,
    output_path: Path,
    *,
    page_indices: list[int] | None = None,
    position: str = "bottom-right",
    size: float = 12.0,
    opacity: float = 0.7,
    color: str = "#b02730",
    prefix: str = "",
    suffix: str = "",
    start: int = 1,
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    opacity = _clamp(opacity, 0.05, 1.0)
    size = _clamp(size, 10.0, 36.0)
    rgb = _hex_to_rgb(color)

    try:
        with pikepdf.open(input_path) as doc:
            target_pages = _target_page_indices(doc, page_indices)
            for offset, i in enumerate(target_pages, start=1):
                page = doc.pages[i]
                gs_name = _add_opacity_resource(page, opacity)
                width, height = _page_size(page)
                label = f"{prefix}{start + offset - 1}{suffix}"
                text_width = _estimate_text_width(label, size)
                box_width = text_width + max(14.0, size * 1.1)
                box_height = size + max(8.0, size * 0.45)
                x0, y0 = _watermark_position(width, height, box_width, box_height, position)
                text_x = x0 + (box_width - text_width) / 2
                text_y = y0 + (box_height - size) / 2 + (size * 0.1)
                content = (
                    "q\n"
                    f"/NoDocGS1 gs\n"
                    "1 1 1 rg\n"
                    f"{x0:.2f} {y0:.2f} {box_width:.2f} {box_height:.2f} re\n"
                    "f\n"
                    f"{rgb[0]:.3f} {rgb[1]:.3f} {rgb[2]:.3f} rg\n"
                    f"BT\n/Helvetica-Bold {size:.2f} Tf\n"
                    f"1 0 0 1 {text_x:.2f} {text_y:.2f} Tm\n"
                    f"({_escape_pdf_text(label)}) Tj\n"
                    "ET\n"
                    "Q\n"
                ).encode("ascii", errors="ignore")
                page.contents_add(
                    pikepdf.Stream(
                        doc,
                        content.replace(b"/NoDocGS1", f"/{str(gs_name)[1:]}".encode("ascii")),
                    )
                )
                if on_progress is not None:
                    on_progress(int((offset / max(1, len(target_pages))) * 100))

            doc.save(output_path)
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be numbered: {exc}") from exc

    return output_path
