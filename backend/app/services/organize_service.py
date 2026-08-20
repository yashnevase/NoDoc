"""
Orchestration layer between the API and the pure engine functions.

Responsible for: choosing safe output paths (never overwriting originals),
and translating engine errors into API-friendly responses.
"""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from typing import Callable

from app.config import settings
from engines.images.to_pdf import images_to_pdf as engine_images_to_pdf
from engines.pdf.compress import compress_pdf as engine_compress_pdf
from engines.pdf.convert import pdf_to_images as engine_pdf_to_images
from engines.pdf.convert import split_pdf as engine_split_pdf
from engines.pdf.organize import add_image_watermark as engine_add_image_watermark
from engines.pdf.organize import add_text_watermark as engine_add_text_watermark
from engines.pdf.organize import add_page_numbers as engine_add_page_numbers
from engines.pdf.organize import crop_pages as engine_crop_pages
from engines.pdf.organize import delete_pages as engine_delete_pages
from engines.pdf.organize import extract_pages as engine_extract_pages
from engines.pdf.organize import merge as engine_merge
from engines.pdf.organize import reorder_pages as engine_reorder_pages
from engines.pdf.organize import duplicate_pages as engine_duplicate_pages
from engines.pdf.organize import repair as engine_repair
from engines.pdf.organize import reverse_pages as engine_reverse_pages
from engines.pdf.organize import rotate as engine_rotate
from engines.pdf.security import password_protect as engine_password_protect
from engines.pdf.security import inspect_signatures as engine_inspect_signatures
from engines.metadata.pdf_metadata import read_metadata as engine_read_metadata
from engines.metadata.pdf_metadata import write_metadata as engine_write_metadata


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


def merge_files(input_paths: list[Path], on_progress: Callable[[int], None] | None = None) -> Path:
    output = safe_output_path(input_paths[0], "merged")
    return engine_merge(input_paths, output, on_progress=on_progress)


def images_to_pdf_files(input_paths: list[Path], on_progress: Callable[[int], None] | None = None) -> Path:
    output = safe_output_path(input_paths[0], "images")
    return engine_images_to_pdf(input_paths, output, on_progress=on_progress)


def merge_files_to_output(
    input_paths: list[Path],
    output_path: Path,
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    return engine_merge(input_paths, output_path, on_progress=on_progress)


def images_to_pdf_files_to_output(
    input_paths: list[Path],
    output_path: Path,
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    return engine_images_to_pdf(input_paths, output_path, on_progress=on_progress)


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


def inspect_signatures_file(input_path: Path) -> dict[str, object]:
    return engine_inspect_signatures(input_path)


def read_metadata_file(input_path: Path) -> dict[str, str]:
    return engine_read_metadata(input_path)


def write_metadata_file(
    input_path: Path,
    *,
    title: str = "",
    author: str = "",
    subject: str = "",
    keywords: str = "",
    creator: str = "",
    producer: str = "",
    remove_all: bool = False,
) -> Path:
    output = safe_output_path(input_path, "metadata")
    return engine_write_metadata(
        input_path,
        output,
        {
            "Title": title,
            "Author": author,
            "Subject": subject,
            "Keywords": keywords,
            "Creator": creator,
            "Producer": producer,
        },
        remove_all=remove_all,
    )


def reorder_pages_file(input_path: Path, page_indices: list[int]) -> Path:
    output = safe_output_path(input_path, "reordered")
    return engine_reorder_pages(input_path, output, page_indices)


def reverse_pages_file(input_path: Path) -> Path:
    output = safe_output_path(input_path, "reversed")
    return engine_reverse_pages(input_path, output)


def duplicate_pages_file(input_path: Path, page_indices: list[int]) -> Path:
    output = safe_output_path(input_path, "duplicated")
    return engine_duplicate_pages(input_path, output, page_indices)


def repair_pdf_file(input_path: Path) -> Path:
    output = safe_output_path(input_path, "repaired")
    return engine_repair(input_path, output)


def compress_pdf_file(
    input_path: Path,
    *,
    preset: str = "balanced",
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    output = safe_output_path(input_path, "compressed")
    return engine_compress_pdf(input_path, output, preset=preset, on_progress=on_progress)


def add_text_watermark_file(
    input_path: Path,
    text: str,
    *,
    mode: str = "text",
    preset: str = "verified",
    page_indices: list[int] | None = None,
    position: str = "center",
    angle: float = -45.0,
    opacity: float = 0.22,
    size: float = 48.0,
    color: str = "#b02730",
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    output = safe_output_path(input_path, "watermarked")
    return engine_add_text_watermark(
        input_path,
        output,
        text,
        kind=mode,
        badge=preset,
        page_indices=page_indices,
        position=position,
        angle=angle,
        opacity=opacity,
        size=size,
        color=color,
        on_progress=on_progress,
    )


def add_image_watermark_file(
    input_path: Path,
    image_path: Path,
    *,
    page_indices: list[int] | None = None,
    position: str = "center",
    angle: float = -45.0,
    opacity: float = 0.22,
    size: float = 48.0,
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    output = safe_output_path(input_path, "watermarked")
    return engine_add_image_watermark(
        input_path,
        output,
        image_path,
        page_indices=page_indices,
        position=position,
        angle=angle,
        opacity=opacity,
        size=size,
        on_progress=on_progress,
    )


def add_page_numbers_file(
    input_path: Path,
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
    output = safe_output_path(input_path, "numbered")
    return engine_add_page_numbers(
        input_path,
        output,
        page_indices=page_indices,
        position=position,
        size=size,
        opacity=opacity,
        color=color,
        prefix=prefix,
        suffix=suffix,
        start=start,
        on_progress=on_progress,
    )


def crop_pdf_file(
    input_path: Path,
    *,
    page_indices: list[int] | None = None,
    left: float = 0.0,
    top: float = 0.0,
    right: float = 0.0,
    bottom: float = 0.0,
) -> Path:
    output = safe_output_path(input_path, "cropped")
    return engine_crop_pages(
        input_path,
        output,
        pages=page_indices,
        left=left,
        top=top,
        right=right,
        bottom=bottom,
    )


def split_pdf_file(input_path: Path, on_progress: Callable[[int], None] | None = None) -> list[Path]:
    output_dir = input_path.parent / "processed" / f"{input_path.stem}_split"
    return engine_split_pdf(input_path, output_dir, on_progress=on_progress)


def pdf_to_images_file(input_path: Path, on_progress: Callable[[int], None] | None = None) -> list[Path]:
    output_dir = input_path.parent / "processed" / f"{input_path.stem}_images"
    return engine_pdf_to_images(input_path, output_dir, on_progress=on_progress)


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
