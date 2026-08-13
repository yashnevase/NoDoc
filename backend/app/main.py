"""
Sidecar entrypoint.

Binds strictly to 127.0.0.1. Prints the chosen port as the first line of
stdout on startup so the Tauri host (which spawned this process) can read
it and hand it to the frontend. No other startup output goes to stdout.
"""
from __future__ import annotations

import logging
import sys

import uvicorn
from fastapi import FastAPI

from app.api.organize import router as organize_router
from app.config import settings
from app.logging_conf import configure_logging

configure_logging()
logger = logging.getLogger("privatepdf.main")

app = FastAPI(title="PrivatePDF Sidecar", docs_url=None, redoc_url=None)
app.include_router(organize_router, prefix="/organize", tags=["organize"])


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
