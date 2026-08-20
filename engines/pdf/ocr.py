from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Callable

import pikepdf
import pypdfium2 as pdfium

from .organize import PdfEngineError


def ocr_pdf_to_text(
    input_path: Path,
    output_path: Path,
    *,
    lang: str = "eng",
    on_progress: Callable[[int], None] | None = None,
) -> dict[str, object]:
    binary = _resolve_tesseract_binary()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        pdf = pdfium.PdfDocument(str(input_path))
    except Exception as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be read: {exc}") from exc

    page_texts: list[str] = []
    try:
        with TemporaryDirectory(prefix="nodoc-ocr-text-") as temp_dir:
            temp_root = Path(temp_dir)
            total_pages = len(pdf)
            for index in range(total_pages):
                page = pdf[index]
                try:
                    bitmap = page.render(scale=2).to_pil()
                finally:
                    page.close()

                image_path = temp_root / f"page-{index + 1}.png"
                try:
                    bitmap.save(image_path, format="PNG")
                finally:
                    bitmap.close()

                page_texts.append(_run_tesseract_text(binary, image_path, lang=lang).strip())
                if on_progress is not None:
                    on_progress(int(((index + 1) / max(1, total_pages)) * 100))
    finally:
        pdf.close()

    text_parts = [f"Page {index + 1}\n{content}".strip() for index, content in enumerate(page_texts)]
    output_text = "\n\n".join(text_parts).strip()
    output_path.write_text(output_text, encoding="utf-8")
    return {
        "output_path": str(output_path),
        "text": output_text,
        "page_count": len(page_texts),
    }


def ocr_pdf_to_searchable(
    input_path: Path,
    output_path: Path,
    *,
    lang: str = "eng",
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    binary = _resolve_tesseract_binary()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        pdf = pdfium.PdfDocument(str(input_path))
    except Exception as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be read: {exc}") from exc

    try:
        with TemporaryDirectory(prefix="nodoc-ocr-searchable-") as temp_dir:
            temp_root = Path(temp_dir)
            page_outputs: list[Path] = []
            total_pages = len(pdf)

            for index in range(total_pages):
                page = pdf[index]
                try:
                    bitmap = page.render(scale=2).to_pil()
                finally:
                    page.close()

                image_path = temp_root / f"page-{index + 1}.png"
                try:
                    bitmap.save(image_path, format="PNG")
                finally:
                    bitmap.close()

                page_pdf = _run_tesseract_pdf(binary, image_path, temp_root / f"page-{index + 1}", lang=lang)
                page_outputs.append(page_pdf)
                if on_progress is not None:
                    on_progress(int(((index + 1) / max(1, total_pages)) * 100))

            with pikepdf.new() as merged:
                for page_pdf in page_outputs:
                    with pikepdf.open(page_pdf) as page_doc:
                        merged.pages.extend(page_doc.pages)
                merged.save(output_path)
    finally:
        pdf.close()

    return output_path


def _resolve_tesseract_binary() -> str:
    configured = (
        os.environ.get("PRIVATEPDF_TESSERACT_PATH")
        or os.environ.get("TESSERACT_PATH")
    )
    if configured:
        configured_path = Path(configured)
        if configured_path.exists():
            return str(configured_path)

    discovered = shutil.which("tesseract")
    if discovered:
        return discovered

    raise PdfEngineError(
        "Tesseract OCR engine not found. Install Tesseract or set PRIVATEPDF_TESSERACT_PATH."
    )


def _run_tesseract_text(binary: str, image_path: Path, *, lang: str) -> str:
    command = [binary, str(image_path), "stdout", "-l", lang]
    try:
        completed = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        raise PdfEngineError(f"OCR failed for '{image_path.name}': {exc.stderr.strip() or exc.stdout.strip() or exc}") from exc
    return completed.stdout


def _run_tesseract_pdf(binary: str, image_path: Path, output_base: Path, *, lang: str) -> Path:
    command = [binary, str(image_path), str(output_base), "-l", lang, "pdf"]
    try:
        subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        raise PdfEngineError(f"OCR PDF build failed for '{image_path.name}': {exc.stderr.strip() or exc.stdout.strip() or exc}") from exc
    return output_base.with_suffix(".pdf")
