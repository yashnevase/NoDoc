from __future__ import annotations

from pathlib import Path

from fastapi import UploadFile


async def save_upload(upload: UploadFile, job_dir: Path, fallback_name: str) -> Path:
    target_path = job_dir / (upload.filename or fallback_name)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(await upload.read())
    return target_path


async def save_uploads(
    uploads: list[UploadFile],
    job_dir: Path,
    *,
    fallback_prefix: str,
    fallback_suffix: str = "",
) -> list[Path]:
    input_paths: list[Path] = []
    for index, upload in enumerate(uploads, start=1):
        suffix = fallback_suffix or Path(upload.filename or "").suffix
        fallback_name = f"{fallback_prefix}-{index}{suffix}"
        input_paths.append(await save_upload(upload, job_dir, fallback_name))
    return input_paths
