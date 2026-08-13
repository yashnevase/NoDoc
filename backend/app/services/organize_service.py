"""
Orchestration layer between the API and the pure engine functions.

Responsible for: choosing safe output paths (never overwriting originals),
and translating engine errors into API-friendly responses.
"""
from __future__ import annotations

from pathlib import Path

from engines.pdf.organize import merge as engine_merge


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
