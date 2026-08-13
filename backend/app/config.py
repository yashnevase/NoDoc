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


@dataclass(frozen=True)
class Settings:
    host: str = os.environ.get("PRIVATEPDF_HOST", "127.0.0.1")  # never 0.0.0.0 unless explicitly overridden for dev
    port: int = int(os.environ.get("PRIVATEPDF_PORT", "0"))      # 0 = OS picks a free port; real port is reported at startup
    auth_token: str = os.environ.get("PRIVATEPDF_AUTH_TOKEN", secrets.token_urlsafe(32))
    app_data_dir: Path = Path(os.environ.get("PRIVATEPDF_DATA_DIR", Path.home() / ".privatepdf"))
    temp_dir: Path = app_data_dir / "tmp"
    log_dir: Path = app_data_dir / "logs"
    telemetry_enabled: bool = False   # always False; not user-configurable to "on" via env by accident
    max_upload_mb: int = 2048         # guard against pathological inputs; tune per engine

    def ensure_dirs(self) -> None:
        self.app_data_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
