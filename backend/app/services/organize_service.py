"""
Orchestration layer between the API and the pure engine functions.

Responsible for: choosing safe output paths (never overwriting originals),
and translating engine errors into API-friendly responses.
"""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from app.config import settings
from engines.images.to_pdf import images_to_pdf as engine_images_to_pdf
from engines.pdf.convert import pdf_to_images as engine_pdf_to_images
from engines.pdf.convert import split_pdf as engine_split_pdf
from engines.pdf.convert import pdf_to_text as engine_pdf_to_text
from engines.pdf.organize import delete_pages as engine_delete_pages
from engines.pdf.organize import extract_pages as engine_extract_pages
from engines.pdf.organize import merge as engine_merge
from engines.pdf.organize import rotate as engine_rotate
from engines.pdf.security import password_protect as engine_password_protect
from engines.pdf.security import remove_metadata as engine_remove_metadata


def safe_output_path(first_input: Path, suffix: str) -> Path:
    """
    original.pdf -> <folder>/processed/original_<suffix>.pdf
    Never returns a path equal to an existing user file unless it's already
    inside a processed/ output folder we created.
    """
    out_dir = first_input.parent / "processed"
    out_dir.mkdir(parents=True, exist_ok=True)
    candidate = out_dir / f"{first_input.stem}_{suffix}.pdf"

    n = 1
    while candidate.exists():
        candidate = out_dir / f"{first_input.stem}_{suffix}_{n}.pdf"
        n += 1
    return candidate


def merge_files(input_paths: list[Path]) -> Path:
    output = safe_output_path(input_paths[0], "merged")
    return engine_merge(input_paths, output)


def images_to_pdf_files(input_paths: list[Path]) -> Path:
    output = safe_output_path(input_paths[0], "images")
    return engine_images_to_pdf(input_paths, output)


def extract_pages_file(input_path: Path, page_indices: list[int]) -> Path:
    output = safe_output_path(input_path, "extracted")
    return engine_extract_pages(input_path, output, page_indices)


def delete_pages_file(input_path: Path, page_indices: list[int]) -> Path:
    output = safe_output_path(input_path, "deleted")
    return engine_delete_pages(input_path, output, page_indices)


def rotate_pdf_file(input_path: Path, degrees: int, page_indices: list[int] | None = None) -> Path:
    output = safe_output_path(input_path, f"rotated_{degrees}")
    return engine_rotate(input_path, output, degrees, page_indices)


def password_protect_file(input_path: Path, password: str) -> Path:
    output = safe_output_path(input_path, "protected")
    return engine_password_protect(input_path, output, password)


def remove_metadata_file(input_path: Path) -> Path:
    output = safe_output_path(input_path, "metadata_removed")
    return engine_remove_metadata(input_path, output)


def split_pdf_file(input_path: Path) -> list[Path]:
    output_dir = input_path.parent / "processed" / f"{input_path.stem}_split"
    return engine_split_pdf(input_path, output_dir)


def pdf_to_images_file(input_path: Path) -> list[Path]:
    output_dir = input_path.parent / "processed" / f"{input_path.stem}_images"
    return engine_pdf_to_images(input_path, output_dir)


def pdf_to_text_file(input_path: Path) -> Path:
    output_dir = input_path.parent / "processed"
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / f"{input_path.stem}_text.txt"
    n = 1
    while output.exists():
        output = output_dir / f"{input_path.stem}_text_{n}.txt"
        n += 1
    return engine_pdf_to_text(input_path, output)


def create_upload_job_dir() -> Path:
    job_dir = settings.temp_dir / f"merge-job-{uuid.uuid4().hex}"
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_dir


def safe_upload_output_path(job_dir: Path, first_filename: str, suffix: str) -> Path:
    stem = Path(first_filename).stem or "merged"
    out_dir = job_dir / "processed"
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir / f"{stem}_{suffix}.pdf"


def cleanup_job_dir(job_dir: Path) -> None:
    shutil.rmtree(job_dir, ignore_errors=True)
