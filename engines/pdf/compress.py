"""
PDF compression / optimization helpers.

This is intentionally conservative for a first release: it rewrites the file
with compressed object streams and stream recompression, and applies stronger
packing for smaller presets without touching the original source file.
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable

import pikepdf

from engines.pdf.organize import PdfEngineError


def _save_options(preset: str) -> dict[str, object]:
    normalized = preset.strip().lower()
    if normalized == "small":
        return {
            "compress_streams": True,
            "recompress_flate": True,
            "stream_decode_level": pikepdf.StreamDecodeLevel.generalized,
            "object_stream_mode": pikepdf.ObjectStreamMode.generate,
            "linearize": True,
        }
    if normalized == "max":
        return {
            "compress_streams": True,
            "recompress_flate": False,
            "stream_decode_level": pikepdf.StreamDecodeLevel.none,
            "object_stream_mode": pikepdf.ObjectStreamMode.preserve,
            "linearize": False,
        }
    return {
        "compress_streams": True,
        "recompress_flate": True,
        "stream_decode_level": pikepdf.StreamDecodeLevel.generalized,
        "object_stream_mode": pikepdf.ObjectStreamMode.generate,
        "linearize": False,
    }


def compress_pdf(
    input_path: Path,
    output_path: Path,
    *,
    preset: str = "balanced",
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with pikepdf.open(input_path) as doc:
            if on_progress is not None:
                on_progress(20)
            options = _save_options(preset)
            doc.save(
                output_path,
                preserve_pdfa=True,
                fix_metadata_version=True,
                deterministic_id=True,
                **options,
            )
            if on_progress is not None:
                on_progress(100)
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be compressed: {exc}") from exc

    return output_path
