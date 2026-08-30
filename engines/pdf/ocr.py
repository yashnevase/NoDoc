from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Callable

import pikepdf
import pypdfium2 as pdfium

from .organize import PdfEngineError


_OCR_TIMEOUT_SECONDS = int(os.environ.get("PRIVATEPDF_OCR_TIMEOUT_SECONDS", "120"))


def ocr_pdf_to_text(
    input_path: Path,
    output_path: Path,
    *,
    lang: str = "eng",
    on_progress: Callable[[int], None] | None = None,
) -> dict[str, object]:
    binary = _resolve_tesseract_binary()
    _validate_language(lang)
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
    _validate_language(lang)
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

    executable = "tesseract.exe" if os.name == "nt" else "tesseract"
    for resource_root in _resource_roots():
        for candidate in (resource_root / "ocr" / "bin" / executable, resource_root / "ocr" / executable):
            if candidate.exists():
                return str(candidate)

    discovered = shutil.which("tesseract")
    if discovered:
        return discovered

    raise PdfEngineError(
        "Tesseract OCR engine not found. Install Tesseract for development, set PRIVATEPDF_TESSERACT_PATH, or bundle it with NoDoc."
    )


def available_ocr_languages() -> list[str]:
    """Return installed OCR languages or a clear engine error for the UI/API."""
    binary = _resolve_tesseract_binary()
    try:
        completed = subprocess.run(
            [binary, "--list-langs"],
            check=True,
            capture_output=True,
            text=True,
            env=_tesseract_environment(),
            timeout=_OCR_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        raise PdfEngineError("Tesseract timed out while listing OCR languages") from exc
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        raise PdfEngineError(f"Could not list OCR languages: {detail}") from exc
    return [line.strip() for line in completed.stdout.splitlines() if line.strip() and not line.lower().startswith("list of")]


def _resource_roots() -> list[Path]:
    roots: list[Path] = []
    configured = os.environ.get("PRIVATEPDF_RESOURCE_DIR")
    if configured:
        roots.append(Path(configured))
    pyinstaller_root = getattr(sys, "_MEIPASS", None)
    if pyinstaller_root:
        roots.append(Path(pyinstaller_root))
    return roots


def _tesseract_environment() -> dict[str, str]:
    environment = os.environ.copy()
    configured = os.environ.get("PRIVATEPDF_TESSDATA_PATH")
    candidates = [Path(configured)] if configured else []
    candidates.extend(root / "ocr" / "tessdata" for root in _resource_roots())
    for tessdata in candidates:
        if tessdata.is_dir():
            environment["TESSDATA_PREFIX"] = str(tessdata)
            break
    return environment


def _validate_language(lang: str) -> None:
    requested = [part.strip() for part in lang.split("+") if part.strip()]
    if not requested:
        raise PdfEngineError("OCR language must not be empty")
    available = set(available_ocr_languages())
    missing = [language for language in requested if language not in available]
    if missing:
        supported = ", ".join(sorted(available)) or "none"
        raise PdfEngineError(f"OCR language unavailable: {', '.join(missing)}. Available languages: {supported}")


def _run_tesseract_text(binary: str, image_path: Path, *, lang: str) -> str:
    command = [binary, str(image_path), "stdout", "-l", lang]
    try:
        completed = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            env=_tesseract_environment(),
            timeout=_OCR_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        raise PdfEngineError(f"OCR timed out for '{image_path.name}'") from exc
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
            env=_tesseract_environment(),
            timeout=_OCR_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        raise PdfEngineError(f"OCR PDF build timed out for '{image_path.name}'") from exc
    except subprocess.CalledProcessError as exc:
        raise PdfEngineError(f"OCR PDF build failed for '{image_path.name}': {exc.stderr.strip() or exc.stdout.strip() or exc}") from exc
    return output_base.with_suffix(".pdf")
