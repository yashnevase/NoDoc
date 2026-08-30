from __future__ import annotations

import zipfile
import uuid
import shutil
import time
import json
from pathlib import Path

from fastapi import HTTPException

from app.config import settings


def _workspace_registry_path() -> Path:
    return settings.app_data_dir / "active-workspace-paths.json"


def save_active_workspace_paths(raw_paths: list[str]) -> int:
    """Persist active temporary revision paths so stale cleanup will not remove them."""
    settings.ensure_dirs()
    temp_dir = settings.temp_dir.resolve()
    safe_paths = []
    for raw_path in raw_paths:
        path = Path(raw_path).resolve()
        if temp_dir in path.parents and path.is_file():
            safe_paths.append(str(path))
    registry = _workspace_registry_path()
    pending = registry.with_suffix(".tmp")
    pending.write_text(json.dumps(sorted(set(safe_paths))), encoding="utf-8")
    pending.replace(registry)
    return len(safe_paths)


def _protected_workspace_roots() -> set[Path]:
    try:
        raw_paths = json.loads(_workspace_registry_path().read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return set()
    temp_dir = settings.temp_dir.resolve()
    roots: set[Path] = set()
    for raw_path in raw_paths if isinstance(raw_paths, list) else []:
        path = Path(raw_path).resolve()
        if temp_dir not in path.parents:
            continue
        root = next((parent for parent in path.parents if parent.parent == temp_dir and parent.name.startswith("merge-job-")), None)
        if root is not None:
            roots.add(root)
    return roots


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
    zip_path = zip_dir / f"nodoc-results-{uuid.uuid4().hex}.zip"

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        used_names: set[str] = set()
        for result_path in result_paths:
            archive_name = result_path.name
            if archive_name in used_names:
                archive_name = f"{result_path.stem}_{len(used_names) + 1}{result_path.suffix}"
            used_names.add(archive_name)
            archive.write(result_path, arcname=archive_name)

    return zip_path


def cleanup_result_paths(raw_paths: list[str], *, release_workspace: bool = False) -> int:
    """Delete only generated files below the app temp directory."""
    temp_dir = settings.temp_dir.resolve()
    deleted = 0
    workspace_roots: set[Path] = set()
    for raw_path in raw_paths:
        path = Path(raw_path).resolve()
        if temp_dir not in path.parents or not path.is_file():
            continue
        workspace_root = next((parent for parent in path.parents if parent.parent == temp_dir and parent.name.startswith("merge-job-")), None)
        if workspace_root is not None:
            workspace_roots.add(workspace_root)
        path.unlink(missing_ok=True)
        deleted += 1
        parent = path.parent
        while parent != temp_dir and temp_dir in parent.parents:
            try:
                parent.rmdir()
            except OSError:
                break
            parent = parent.parent
    if release_workspace:
        for root in workspace_roots:
            if root.exists():
                shutil.rmtree(root, ignore_errors=True)
    return deleted


def cleanup_stale_temp_outputs(max_age_hours: int = 168) -> int:
    settings.ensure_dirs()
    cutoff = time.time() - max_age_hours * 3600
    protected_roots = _protected_workspace_roots()
    deleted = 0
    for path in settings.temp_dir.iterdir():
        if not (path.name.startswith("merge-job-") or path.name == "downloads"):
            continue
        if path in protected_roots:
            continue
        try:
            if path.stat().st_mtime >= cutoff:
                continue
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink(missing_ok=True)
            deleted += 1
        except OSError:
            continue
    return deleted
