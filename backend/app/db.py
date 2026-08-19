from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from threading import Lock
from typing import Any, Iterable

from app.config import settings


class LocalStore:
    def __init__(self) -> None:
        self._db_path = settings.app_data_dir / "nodoc.db"
        self._lock = Lock()
        self._initialized = False

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def initialize(self) -> None:
        if self._initialized:
            return
        with self._lock:
            if self._initialized:
                return
            settings.app_data_dir.mkdir(parents=True, exist_ok=True)
            with self._connect() as connection:
                connection.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS documents (
                        id TEXT PRIMARY KEY,
                        path TEXT NOT NULL,
                        title TEXT NOT NULL,
                        page_count INTEGER,
                        size_bytes INTEGER,
                        added_at TEXT NOT NULL,
                        last_opened_at TEXT NOT NULL,
                        favorite INTEGER NOT NULL DEFAULT 0
                    );

                    CREATE TABLE IF NOT EXISTS recent_files (
                        id INTEGER PRIMARY KEY CHECK (id = 1),
                        payload TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS job_history (
                        id TEXT PRIMARY KEY,
                        kind TEXT NOT NULL,
                        input_path TEXT,
                        output_path TEXT,
                        created_at TEXT NOT NULL,
                        status TEXT NOT NULL
                    );
                    """
                )
            self._initialized = True

    @contextmanager
    def connection(self) -> Iterable[sqlite3.Connection]:
        self.initialize()
        with self._connect() as connection:
            yield connection

    def get_recent_files(self) -> list[str]:
        with self.connection() as connection:
            row = connection.execute("SELECT payload FROM recent_files WHERE id = 1").fetchone()
        if not row:
            return []
        try:
            data = json.loads(row["payload"])
        except json.JSONDecodeError:
            return []
        return [str(item) for item in data if item]

    def save_recent_files(self, names: list[str]) -> list[str]:
        clean = [name for name in names if name]
        payload = json.dumps(clean[:20])
        with self.connection() as connection:
            connection.execute(
                "INSERT INTO recent_files (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
                (payload,),
            )
        return clean[:20]

    def add_job_history(
        self,
        *,
        job_id: str,
        kind: str,
        created_at: str,
        status: str,
        input_path: str | None = None,
        output_path: str | None = None,
    ) -> None:
        with self.connection() as connection:
            connection.execute(
                """
                INSERT INTO job_history (id, kind, input_path, output_path, created_at, status)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    kind = excluded.kind,
                    input_path = excluded.input_path,
                    output_path = excluded.output_path,
                    created_at = excluded.created_at,
                    status = excluded.status
                """,
                (job_id, kind, input_path, output_path, created_at, status),
            )

    def list_job_history(self, limit: int = 20) -> list[dict[str, Any]]:
        with self.connection() as connection:
            rows = connection.execute(
                "SELECT id, kind, input_path, output_path, created_at, status FROM job_history ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(row) for row in rows]


store = LocalStore()
