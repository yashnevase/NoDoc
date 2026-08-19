"""
Basic PDF conversion helpers for local/offline workflows.
"""
from __future__ import annotations

import base64
import io
from functools import lru_cache
from pathlib import Path
from typing import Callable

import pikepdf
import pypdfium2 as pdfium
from PIL import Image

from engines.pdf.organize import PdfEngineError


def split_pdf(
    input_path: Path,
    output_dir: Path,
    on_progress: Callable[[int], None] | None = None,
) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        with pikepdf.open(input_path) as doc:
            output_paths: list[Path] = []
            for index, page in enumerate(doc.pages, start=1):
                output_path = output_dir / f"{input_path.stem}_page_{index}.pdf"
                with pikepdf.new() as single_page_pdf:
                    single_page_pdf.pages.append(page)
                    single_page_pdf.save(output_path)
                output_paths.append(output_path)
                if on_progress is not None:
                    on_progress(int((index / max(1, len(doc.pages))) * 100))
            return output_paths
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be read: {exc}") from exc


def pdf_to_images(
    input_path: Path,
    output_dir: Path,
    on_progress: Callable[[int], None] | None = None,
) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        pdf = pdfium.PdfDocument(str(input_path))
    except Exception as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be read: {exc}") from exc

    output_paths: list[Path] = []
    try:
        for index in range(len(pdf)):
            page = pdf[index]
            bitmap = page.render(scale=2).to_pil()
            output_path = output_dir / f"{input_path.stem}_page_{index + 1}.png"
            bitmap.save(output_path, format="PNG")
            bitmap.close()
            page.close()
            output_paths.append(output_path)
            if on_progress is not None:
                on_progress(int(((index + 1) / max(1, len(pdf))) * 100))
        return output_paths
    finally:
        pdf.close()

@lru_cache(maxsize=256)
def _render_cached_page(input_path_str: str, page_number: int, scale: float) -> tuple[float, float, str]:
    input_path = Path(input_path_str)
    try:
        pdf = pdfium.PdfDocument(str(input_path))
    except Exception as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be read: {exc}") from exc

    try:
        if page_number < 1 or page_number > len(pdf):
            raise PdfEngineError(f"page {page_number} is out of range for '{input_path.name}'")
        page = pdf[page_number - 1]
        width, height = page.get_size()
        bitmap = page.render(scale=scale).to_pil()
        buffer = io.BytesIO()
        bitmap.save(buffer, format="PNG")
        bitmap.close()
        page.close()
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return float(width), float(height), f"data:image/png;base64,{encoded}"
    finally:
        pdf.close()


def render_pdf_page(input_path: Path, page_number: int, scale: float = 0.55) -> dict[str, str | int | float]:
    width, height, image = _render_cached_page(str(input_path), page_number, scale)
    return {
        "page": page_number,
        "width": width,
        "height": height,
        "image": image,
    }


def render_pdf_manifest(input_path: Path) -> list[dict[str, str | int | float]]:
    try:
        pdf = pdfium.PdfDocument(str(input_path))
    except Exception as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be read: {exc}") from exc

    try:
        pages: list[dict[str, str | int | float]] = []
        for index in range(len(pdf)):
            page = pdf[index]
            width, height = page.get_size()
            page.close()
            pages.append({"page": index + 1, "width": float(width), "height": float(height), "image": ""})
        return pages
    finally:
        pdf.close()


def render_pdf_preview(input_path: Path) -> list[dict[str, str | int | float]]:
    try:
        pdf = pdfium.PdfDocument(str(input_path))
    except Exception as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be read: {exc}") from exc

    try:
        return [render_pdf_page(input_path, index + 1) for index in range(len(pdf))]
    finally:
        pdf.close()
