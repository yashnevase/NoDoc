"""
Central configuration for the local sidecar.

Everything here is designed around one rule: this process must never need
to know about, or reach, anything beyond 127.0.0.1.
"""
from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from pathlib import Path


def _cors_origins_from_env() -> tuple[str, ...]:
    configured = os.environ.get("PRIVATEPDF_CORS_ORIGINS", "").strip()
    if configured:
        return tuple(origin.strip() for origin in configured.split(",") if origin.strip())
    return (
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "tauri://localhost",
        "https://tauri.localhost",
    )


@dataclass(frozen=True)
class Settings:
    host: str = os.environ.get("PRIVATEPDF_HOST", "127.0.0.1")  # never 0.0.0.0 unless explicitly overridden for dev
    port: int = int(os.environ.get("PRIVATEPDF_PORT", "0"))      # 0 = OS picks a free port; real port is reported at startup
    auth_token: str = os.environ.get("PRIVATEPDF_AUTH_TOKEN", secrets.token_urlsafe(32))
    app_data_dir: Path = Path(os.environ.get("PRIVATEPDF_DATA_DIR", Path.home() / ".privatepdf"))
    temp_dir: Path = app_data_dir / "tmp"
    log_dir: Path = app_data_dir / "logs"
    telemetry_enabled: bool = False   # always False; not user-configurable to "on" via env by accident
    max_upload_mb: int = int(os.environ.get("PRIVATEPDF_MAX_UPLOAD_MB", "2048"))
    cors_origins: tuple[str, ...] = _cors_origins_from_env()

    def ensure_dirs(self) -> None:
        self.app_data_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


settings = Settings()
