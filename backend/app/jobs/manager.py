from __future__ import annotations

from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Callable
from uuid import uuid4

from app.services.job_history_service import add_job_history


JobCallable = Callable[[Callable[[int, str | None], None]], dict[str, Any]]


class JobCancelled(Exception):
    """Raised at an engine progress checkpoint after a cancellation request."""


@dataclass
class JobState:
    id: str
    kind: str
    status: str = "queued"
    progress: int = 0
    message: str = "Queued"
    result: dict[str, Any] | None = None
    error: str | None = None
    cancel_requested: bool = False
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class JobManager:
    def __init__(self, *, max_workers: int = 2, max_retained_jobs: int = 200) -> None:
        self._jobs: dict[str, JobState] = {}
        self._lock = Lock()
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="nodoc-job")
        self._max_retained_jobs = max_retained_jobs
        self._futures: dict[str, Future[None]] = {}

    def _prune_finished_locked(self) -> None:
        overflow = len(self._jobs) - self._max_retained_jobs + 1
        if overflow <= 0:
            return
        finished = [job for job in self._jobs.values() if job.status in {"done", "error", "cancelled"}]
        finished.sort(key=lambda job: job.updated_at)
        for job in finished[:overflow]:
            self._jobs.pop(job.id, None)
            self._futures.pop(job.id, None)

    def create_job(self, kind: str, *, message: str = "Queued") -> JobState:
        job = JobState(id=uuid4().hex, kind=kind, message=message)
        with self._lock:
            self._prune_finished_locked()
            self._jobs[job.id] = job
        add_job_history(job_id=job.id, kind=kind, created_at=job.created_at, status=job.status)
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

    def _mark_cancelled_locked(self, job: JobState, *, message: str = "Cancelled") -> None:
        job.status = "cancelled"
        job.progress = 0
        job.message = message
        job.result = None
        job.error = None
        job.cancel_requested = True
        job.updated_at = datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _cleanup_cancelled_result(result: dict[str, Any]) -> None:
        paths = [result.get("output_path"), *(result.get("output_paths") or [])]
        for value in paths:
            if not value:
                continue
            try:
                Path(value).unlink(missing_ok=True)
            except OSError:
                # Cleanup is best effort; the stale-output policy handles a locked file later.
                pass

    def _record_cancelled(self, job: JobState) -> None:
        add_job_history(job_id=job.id, kind=job.kind, created_at=job.created_at, status="cancelled")

    def cancellation_requested(self, job_id: str) -> bool:
        with self._lock:
            job = self._jobs.get(job_id)
            return bool(job and job.cancel_requested)

    def cancel_job(self, job_id: str) -> JobState | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            if job.status in {"done", "error", "cancelled"}:
                return job
            job.cancel_requested = True
            future = self._futures.get(job_id)
            if job.status == "queued" and future is not None and future.cancel():
                self._mark_cancelled_locked(job)
                cancelled_now = True
            else:
                job.status = "cancelling"
                job.message = "Cancelling after the current processing step"
                job.updated_at = datetime.now(timezone.utc).isoformat()
                cancelled_now = False
        if cancelled_now:
            self._record_cancelled(job)
        return job

    def complete_job(self, job_id: str, result: dict[str, Any], *, message: str = "Done") -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            if job.cancel_requested:
                self._mark_cancelled_locked(job)
                cancelled = True
            else:
                job.status = "done"
                job.progress = 100
                job.message = message
                job.result = result
                job.error = None
                job.updated_at = datetime.now(timezone.utc).isoformat()
                cancelled = False
        if cancelled:
            self._cleanup_cancelled_result(result)
            self._record_cancelled(job)
            return
        output_path = result.get("output_path")
        output_paths = result.get("output_paths") or []
        add_job_history(
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
            if job.cancel_requested:
                self._mark_cancelled_locked(job)
                cancelled = True
            else:
                job.status = "error"
                job.error = error
                job.message = error
                job.updated_at = datetime.now(timezone.utc).isoformat()
                cancelled = False
        if job is not None:
            if cancelled:
                self._record_cancelled(job)
            else:
                add_job_history(job_id=job_id, kind=job.kind, created_at=job.created_at, status=job.status)

    def submit(self, job_id: str, work: JobCallable) -> Future[None]:
        def runner() -> None:
            def progress_callback(progress: int, message: str | None = None) -> None:
                if self.cancellation_requested(job_id):
                    raise JobCancelled()
                self.update_job(job_id, status="running", progress=progress, message=message)

            try:
                if self.cancellation_requested(job_id):
                    raise JobCancelled()
                self.update_job(job_id, status="running", progress=1, message="Starting")
                result = work(progress_callback)
            except JobCancelled:
                self.fail_job(job_id, "Cancelled")
                return
            except Exception as exc:  # noqa: BLE001
                self.fail_job(job_id, str(exc))
                return
            self.complete_job(job_id, result)

        future = self._executor.submit(runner)
        with self._lock:
            self._futures[job_id] = future
        return future


jobs = JobManager()
