"""
Core PDF organization operations: merge, split, extract, delete, reorder, rotate.

Deliberately has zero web/framework imports — this module should be usable
from a future CLI or test harness without pulling in FastAPI.
"""
from __future__ import annotations

from pathlib import Path

import pikepdf


class PdfEngineError(Exception):
    """Raised for any recoverable failure in PDF processing (bad input, etc.)."""


def merge(input_paths: list[Path], output_path: Path) -> Path:
    if not input_paths:
        raise PdfEngineError("no input files provided")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.new() as target:
        for src in input_paths:
            if not src.exists():
                raise PdfEngineError(f"input file not found: {src.name}")
            try:
                with pikepdf.open(src) as doc:
                    target.pages.extend(doc.pages)
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


def delete_pages(input_path: Path, output_path: Path, page_indices: list[int]) -> Path:
    """page_indices are 0-indexed pages to remove."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.open(input_path) as doc:
        for i in sorted(page_indices, reverse=True):
            del doc.pages[i]
        doc.save(output_path)

    return output_path
