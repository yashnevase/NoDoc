from __future__ import annotations

from app.db import store


def get_recent_files() -> list[str]:
    return store.get_recent_files()


def save_recent_files(names: list[str]) -> list[str]:
    return store.save_recent_files(names)


def add_job_history(
    *,
    job_id: str,
    kind: str,
    created_at: str,
    status: str,
    input_path: str | None = None,
    output_path: str | None = None,
) -> None:
    store.add_job_history(
        job_id=job_id,
        kind=kind,
        created_at=created_at,
        status=status,
        input_path=input_path,
        output_path=output_path,
    )


def list_job_history(limit: int = 20) -> list[dict[str, object]]:
    return store.list_job_history(limit)
