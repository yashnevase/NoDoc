from __future__ import annotations

import re
import shutil
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import settings


_CHUNK_SIZE = 1024 * 1024


def safe_upload_name(filename: str | None, fallback_name: str) -> str:
    """Return a portable filename that cannot escape the job directory."""
    raw_name = (filename or fallback_name).replace("\\", "/").split("/")[-1]
    raw_name = raw_name.replace("\x00", "")
    clean_name = re.sub(r"[^\w.() -]", "_", raw_name, flags=re.UNICODE).strip(" .")
    if not clean_name or clean_name in {".", ".."}:
        return fallback_name

    path = Path(clean_name)
    stem = path.stem[:120] or "upload"
    suffix = path.suffix[:16]
    return f"{stem}{suffix}"


async def save_upload(upload: UploadFile, job_dir: Path, fallback_name: str) -> Path:
    target_path = job_dir / safe_upload_name(upload.filename, fallback_name)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    try:
        with target_path.open("wb") as output:
            while chunk := await upload.read(_CHUNK_SIZE):
                written += len(chunk)
                if written > settings.max_upload_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Upload exceeds the {settings.max_upload_mb} MB limit.",
                    )
                output.write(chunk)
    except Exception:
        target_path.unlink(missing_ok=True)
        raise
    finally:
        await upload.close()
    return target_path


async def save_uploads(
    uploads: list[UploadFile],
    job_dir: Path,
    *,
    fallback_prefix: str,
    fallback_suffix: str = "",
) -> list[Path]:
    input_paths: list[Path] = []
    try:
        for index, upload in enumerate(uploads, start=1):
            suffix = fallback_suffix or Path(safe_upload_name(upload.filename, "upload.pdf")).suffix
            fallback_name = f"{fallback_prefix}-{index}{suffix}"
            input_paths.append(await save_upload(upload, job_dir, fallback_name))
    except Exception:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise
    return input_paths
