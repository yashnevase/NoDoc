"""
Basic PDF conversion helpers for local/offline workflows.
"""
from __future__ import annotations

import base64
import io
from pathlib import Path

import pikepdf
import pypdfium2 as pdfium
from PIL import Image

from engines.pdf.organize import PdfEngineError


def split_pdf(input_path: Path, output_dir: Path) -> list[Path]:
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
            return output_paths
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be read: {exc}") from exc


def pdf_to_images(input_path: Path, output_dir: Path) -> list[Path]:
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
        return output_paths
    finally:
        pdf.close()


def render_pdf_preview(input_path: Path, max_pages: int = 48) -> list[dict[str, str | int]]:
    try:
        pdf = pdfium.PdfDocument(str(input_path))
    except Exception as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be read: {exc}") from exc

    pages: list[dict[str, str | int]] = []
    try:
        page_count = min(len(pdf), max_pages)
        for index in range(page_count):
            page = pdf[index]
            bitmap = page.render(scale=0.55).to_pil()
            buffer = io.BytesIO()
            bitmap.save(buffer, format="PNG")
            bitmap.close()
            page.close()
            encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
            pages.append(
                {
                    "page": index + 1,
                    "image": f"data:image/png;base64,{encoded}",
                }
            )
        return pages
    finally:
        pdf.close()


def pdf_to_text(input_path: Path, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        pdf = pdfium.PdfDocument(str(input_path))
    except Exception as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be read: {exc}") from exc

    page_text: list[str] = []
    try:
        for index in range(len(pdf)):
            page = pdf[index]
            textpage = page.get_textpage()
            text = textpage.get_text_bounded().strip()
            header = f"Page {index + 1}"
            page_text.append(f"{header}\n{text}" if text else header)
            textpage.close()
            page.close()
    finally:
        pdf.close()

    output_path.write_text("\n\n".join(page_text).strip() + "\n", encoding="utf-8")
    return output_path
