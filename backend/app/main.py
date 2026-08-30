"""
Sidecar entrypoint.

Binds strictly to 127.0.0.1. Prints the chosen port as the first line of
stdout on startup so the Tauri host (which spawned this process) can read
it and hand it to the frontend. No other startup output goes to stdout.
"""
from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.organize import router as organize_router
from app.api.library import router as library_router
from app.api.results import router as results_router
from app.config import settings
from app.logging_conf import configure_logging
from app.services.result_service import cleanup_stale_temp_outputs

configure_logging()
logger = logging.getLogger("privatepdf.main")

@asynccontextmanager
async def lifespan(_app: FastAPI):
    cleanup_stale_temp_outputs()
    yield


app = FastAPI(title="PrivatePDF Sidecar", docs_url=None, redoc_url=None, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-PrivatePDF-Token"],
)
app.include_router(organize_router, prefix="/organize", tags=["organize"])
app.include_router(library_router, tags=["library"])
app.include_router(results_router, prefix="/results", tags=["results"])


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


def run() -> None:
    """
    Bind a loopback socket ourselves (port 0 = OS assigns a free one), print
    the real port on stdout for the host process to read, then hand that
    socket to uvicorn. This is what lets settings.port stay 0 (dynamic)
    while still telling the Tauri host exactly where to connect.
    """
    import socket

    settings.ensure_dirs()

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((settings.host, settings.port))
    sock.listen(100)
    real_port = sock.getsockname()[1]

    # Contract with the host process: first stdout line is exactly this.
    print(f"PRIVATEPDF_PORT={real_port}", flush=True)
    logger.info("sidecar listening on %s:%s", settings.host, real_port)

    server_config = uvicorn.Config(app, log_level="warning")
    server = uvicorn.Server(server_config)
    try:
        server.run(sockets=[sock])
    except KeyboardInterrupt:
        logger.info("shutting down")


if __name__ == "__main__":
    run()
