from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Callable

import pikepdf
import pypdfium2 as pdfium
from PIL import Image, ImageDraw

from ._marking import clamp as _clamp, hex_to_rgb as _hex_to_rgb
from .organize import PdfEngineError


def redact_pages(
    input_path: Path,
    output_path: Path,
    *,
    regions: list[dict[str, float | int]],
    color: str = "#000000",
    render_scale: float = 2.0,
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    if not regions:
        raise PdfEngineError("at least one redaction region is required")

    grouped_regions = _group_regions(regions)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        pdf = pdfium.PdfDocument(str(input_path))
    except Exception as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be read: {exc}") from exc

    try:
        with pikepdf.open(input_path) as source:
                with pikepdf.new() as target:
                    for key, value in source.docinfo.items():
                        target.docinfo[key] = str(value)

                with TemporaryDirectory(prefix="nodoc-redact-") as temp_dir:
                    temp_root = Path(temp_dir)
                    total_pages = len(source.pages)
                    for page_number, source_page in enumerate(source.pages, start=1):
                        page_regions = grouped_regions.get(page_number, [])
                        if not page_regions:
                            target.pages.append(source_page)
                        else:
                            flattened_path = _build_redacted_page_pdf(
                                pdf,
                                page_number,
                                page_regions,
                                temp_root / f"page-{page_number}.pdf",
                                color=color,
                                render_scale=render_scale,
                            )
                            with pikepdf.open(flattened_path) as flattened_pdf:
                                target.pages.append(flattened_pdf.pages[0])
                                appended = target.pages[-1]
                                appended.MediaBox = pikepdf.Array(source_page.MediaBox)
                                if "/CropBox" in source_page.obj:
                                    appended.CropBox = pikepdf.Array(source_page.CropBox)
                        if on_progress is not None:
                            on_progress(int((page_number / max(1, total_pages)) * 100))

                target.save(output_path)
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be redacted: {exc}") from exc
    finally:
        pdf.close()

    return output_path


def _group_regions(regions: list[dict[str, float | int]]) -> dict[int, list[dict[str, float]]]:
    grouped: dict[int, list[dict[str, float]]] = {}
    for region in regions:
        page = int(region.get("page", 0))
        if page < 1:
            raise PdfEngineError("redaction page numbers must start at 1")

        x = float(region.get("x", 0))
        y = float(region.get("y", 0))
        width = float(region.get("width", 0))
        height = float(region.get("height", 0))
        if width <= 0 or height <= 0:
            raise PdfEngineError("redaction boxes must have positive width and height")

        grouped.setdefault(page, []).append(
            {
                "x": _clamp(x, 0.0, 1.0),
                "y": _clamp(y, 0.0, 1.0),
                "width": _clamp(width, 0.0, 1.0),
                "height": _clamp(height, 0.0, 1.0),
            }
        )
    return grouped


def _build_redacted_page_pdf(
    pdf: pdfium.PdfDocument,
    page_number: int,
    regions: list[dict[str, float]],
    output_path: Path,
    *,
    color: str,
    render_scale: float,
) -> Path:
    page = pdf[page_number - 1]
    try:
        bitmap = page.render(scale=render_scale).to_pil().convert("RGB")
    finally:
        page.close()

    try:
        _draw_redactions(bitmap, regions, color=color)
        bitmap.save(output_path, format="PDF", resolution=72 * render_scale)
    finally:
        bitmap.close()

    return output_path


def _draw_redactions(bitmap: Image.Image, regions: list[dict[str, float]], *, color: str) -> None:
    draw = ImageDraw.Draw(bitmap)
    fill = tuple(int(round(channel * 255)) for channel in _hex_to_rgb(color))
    width, height = bitmap.size
    for region in regions:
        left = int(round(_clamp(region["x"], 0.0, 1.0) * width))
        top = int(round(_clamp(region["y"], 0.0, 1.0) * height))
        right = int(round(_clamp(region["x"] + region["width"], 0.0, 1.0) * width))
        bottom = int(round(_clamp(region["y"] + region["height"], 0.0, 1.0) * height))
        right = max(left + 1, right)
        bottom = max(top + 1, bottom)
        draw.rectangle([left, top, right, bottom], fill=fill)
