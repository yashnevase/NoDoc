from __future__ import annotations

import zipfile
from pathlib import Path

from fastapi import HTTPException

from app.config import settings


def allowed_result_path(raw_path: str) -> Path:
    path = Path(raw_path).resolve()
    app_data_dir = settings.app_data_dir.resolve()
    if path != app_data_dir and app_data_dir not in path.parents:
        raise HTTPException(status_code=403, detail="result is outside the app data folder")
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="result file not found")
    return path


def zip_result_paths(result_paths: list[Path]) -> Path:
    zip_dir = settings.temp_dir / "downloads"
    zip_dir.mkdir(parents=True, exist_ok=True)
    zip_path = zip_dir / "nodoc-results.zip"

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        used_names: set[str] = set()
        for result_path in result_paths:
            archive_name = result_path.name
            if archive_name in used_names:
                archive_name = f"{result_path.stem}_{len(used_names) + 1}{result_path.suffix}"
            used_names.add(archive_name)
            archive.write(result_path, arcname=archive_name)

    return zip_path
