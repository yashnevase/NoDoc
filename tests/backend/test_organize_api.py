"""
API-level tests using FastAPI's TestClient — verifies auth enforcement and
the merge endpoint end-to-end, without a running network server.
"""
from __future__ import annotations

from pathlib import Path

import pikepdf
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def make_pdf(path: Path, n_pages: int = 1) -> Path:
    with pikepdf.new() as pdf:
        for _ in range(n_pages):
            pdf.add_blank_page(page_size=(200, 200))
        pdf.save(path)
    return path


def test_merge_requires_token(tmp_path: Path):
    a = make_pdf(tmp_path / "a.pdf")
    resp = client.post("/organize/merge", json={"input_paths": [str(a)]})
    assert resp.status_code == 401


def test_merge_succeeds_with_token(tmp_path: Path):
    a = make_pdf(tmp_path / "a.pdf", 2)
    b = make_pdf(tmp_path / "b.pdf", 1)
    resp = client.post(
        "/organize/merge",
        json={"input_paths": [str(a), str(b)]},
        headers={"x-privatepdf-token": settings.auth_token},
    )
    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pikepdf.open(output_path) as result:
        assert len(result.pages) == 3


def test_health_endpoint_no_auth_needed():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
