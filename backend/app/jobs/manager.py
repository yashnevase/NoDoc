from __future__ import annotations

from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Callable
from uuid import uuid4

from app.db import store


JobCallable = Callable[[Callable[[int, str | None], None]], dict[str, Any]]


@dataclass
class JobState:
    id: str
    kind: str
    status: str = "queued"
    progress: int = 0
    message: str = "Queued"
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class JobManager:
    def __init__(self, *, max_workers: int = 2) -> None:
        self._jobs: dict[str, JobState] = {}
        self._lock = Lock()
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="nodoc-job")

    def create_job(self, kind: str, *, message: str = "Queued") -> JobState:
        job = JobState(id=uuid4().hex, kind=kind, message=message)
        with self._lock:
            self._jobs[job.id] = job
        store.add_job_history(job_id=job.id, kind=kind, created_at=job.created_at, status=job.status)
        return job

    def get_job(self, job_id: str) -> JobState | None:
        with self._lock:
            return self._jobs.get(job_id)

    def serialize_job(self, job_id: str) -> dict[str, Any] | None:
        job = self.get_job(job_id)
        if job is None:
            return None
        return asdict(job)

    def update_job(self, job_id: str, *, status: str | None = None, progress: int | None = None, message: str | None = None) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            if status is not None:
                job.status = status
            if progress is not None:
                job.progress = max(0, min(100, progress))
            if message is not None:
                job.message = message
            job.updated_at = datetime.now(timezone.utc).isoformat()

    def complete_job(self, job_id: str, result: dict[str, Any], *, message: str = "Done") -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job.status = "done"
            job.progress = 100
            job.message = message
            job.result = result
            job.error = None
            job.updated_at = datetime.now(timezone.utc).isoformat()
        output_path = result.get("output_path")
        output_paths = result.get("output_paths") or []
        store.add_job_history(
            job_id=job_id,
            kind=job.kind,
            created_at=job.created_at,
            status=job.status,
            input_path=None,
            output_path=output_path or (output_paths[0] if output_paths else None),
        )

    def fail_job(self, job_id: str, error: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job.status = "error"
            job.error = error
            job.message = error
            job.updated_at = datetime.now(timezone.utc).isoformat()
        if job is not None:
            store.add_job_history(job_id=job_id, kind=job.kind, created_at=job.created_at, status=job.status)

    def submit(self, job_id: str, work: JobCallable) -> Future[None]:
        self.update_job(job_id, status="running", progress=1, message="Starting")

        def runner() -> None:
            def progress_callback(progress: int, message: str | None = None) -> None:
                self.update_job(job_id, status="running", progress=progress, message=message)

            try:
                result = work(progress_callback)
            except Exception as exc:  # noqa: BLE001
                self.fail_job(job_id, str(exc))
                return
            self.complete_job(job_id, result)

        return self._executor.submit(runner)


jobs = JobManager()
