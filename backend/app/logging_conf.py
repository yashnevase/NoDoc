"""
Logging setup.

Rule: never log document contents, and never log full filesystem paths of
user documents (log the basename only, and only at DEBUG). This keeps a
support log file safe to share without leaking what the user was working on.
"""
from __future__ import annotations

import logging
import logging.handlers
from pathlib import Path

from app.config import settings


def configure_logging() -> None:
    settings.ensure_dirs()
    log_file = settings.log_dir / "sidecar.log"

    handler = logging.handlers.RotatingFileHandler(
        log_file, maxBytes=5_000_000, backupCount=3, encoding="utf-8"
    )
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(handler)


def safe_name(path: str | Path) -> str:
    """Return just the filename for logging — never the full path or contents."""
    return Path(path).name
