"""
API-level tests using FastAPI's TestClient — verifies auth enforcement and
the merge endpoint end-to-end, without a running network server.
"""
from __future__ import annotations

from pathlib import Path

import pikepdf
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import settings
from app.main import app

client = TestClient(app)


def make_pdf(path: Path, n_pages: int = 1) -> Path:
    with pikepdf.new() as pdf:
        for _ in range(n_pages):
            pdf.add_blank_page(page_size=(200, 200))
        pdf.docinfo["/Title"] = "No Doc Test"
        pdf.save(path)
    return path


def make_image(path: Path, color: str) -> Path:
    image = Image.new("RGB", (120, 120), color=color)
    image.save(path)
    image.close()
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


def test_merge_upload_succeeds_with_token(tmp_path: Path):
    a = make_pdf(tmp_path / "a.pdf", 2)
    b = make_pdf(tmp_path / "b.pdf", 1)
    with a.open("rb") as a_file, b.open("rb") as b_file:
        resp = client.post(
            "/organize/merge-upload",
            files=[
                ("files", ("a.pdf", a_file, "application/pdf")),
                ("files", ("b.pdf", b_file, "application/pdf")),
            ],
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pikepdf.open(output_path) as result:
        assert len(result.pages) == 3


def test_images_to_pdf_succeeds_with_token(tmp_path: Path):
    a = make_image(tmp_path / "a.png", "red")
    b = make_image(tmp_path / "b.jpg", "blue")
    resp = client.post(
        "/organize/images-to-pdf",
        json={"input_paths": [str(a), str(b)]},
        headers={"x-privatepdf-token": settings.auth_token},
    )
    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pikepdf.open(output_path) as result:
        assert len(result.pages) == 2


def test_images_to_pdf_upload_succeeds_with_token(tmp_path: Path):
    a = make_image(tmp_path / "a.png", "red")
    b = make_image(tmp_path / "b.jpg", "blue")
    with a.open("rb") as a_file, b.open("rb") as b_file:
        resp = client.post(
            "/organize/images-to-pdf-upload",
            files=[
                ("files", ("a.png", a_file, "image/png")),
                ("files", ("b.jpg", b_file, "image/jpeg")),
            ],
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pikepdf.open(output_path) as result:
        assert len(result.pages) == 2


def test_split_pdf_upload_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "splitme.pdf", 3)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/split-pdf-upload",
            files=[("files", ("splitme.pdf", source_file, "application/pdf"))],
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_paths = [Path(path) for path in resp.json()["output_paths"]]
    assert len(output_paths) == 3
    for output_path in output_paths:
        with pikepdf.open(output_path) as result:
            assert len(result.pages) == 1


def test_pdf_to_images_upload_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "renderme.pdf", 2)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/pdf-to-images-upload",
            files=[("files", ("renderme.pdf", source_file, "application/pdf"))],
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_paths = [Path(path) for path in resp.json()["output_paths"]]
    assert len(output_paths) == 2
    for output_path in output_paths:
        assert output_path.suffix.lower() == ".png"
        assert output_path.exists()


def test_preview_pdf_upload_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "previewme.pdf", 2)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/preview-pdf-upload",
            files=[("files", ("previewme.pdf", source_file, "application/pdf"))],
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    pages = resp.json()["pages"]
    assert len(pages) == 2
    assert pages[0]["page"] == 1
    assert pages[0]["image"].startswith("data:image/png;base64,")


def test_preview_pdf_path_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "preview-path.pdf", 2)
    resp = client.post(
        "/organize/preview-pdf",
        json={"input_paths": [str(source)]},
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 200
    pages = resp.json()["pages"]
    assert len(pages) == 2
    assert pages[0]["image"].startswith("data:image/png;base64,")


def test_extract_pages_upload_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "extractme.pdf", 4)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/extract-pages-upload",
            files=[("files", ("extractme.pdf", source_file, "application/pdf"))],
            data={"pages": "1,3-4"},
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pikepdf.open(output_path) as result:
        assert len(result.pages) == 3


def test_extract_pages_path_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "extract-path.pdf", 4)
    resp = client.post(
        "/organize/extract-pages",
        params={"pages": "2-3"},
        json={"input_paths": [str(source)]},
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pikepdf.open(output_path) as result:
        assert len(result.pages) == 2


def test_delete_pages_upload_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "deleteme.pdf", 4)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/delete-pages-upload",
            files=[("files", ("deleteme.pdf", source_file, "application/pdf"))],
            data={"pages": "2,4"},
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pikepdf.open(output_path) as result:
        assert len(result.pages) == 2


def test_rotate_pdf_upload_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "rotateme.pdf", 2)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/rotate-pdf-upload",
            files=[("files", ("rotateme.pdf", source_file, "application/pdf"))],
            data={"degrees": "90", "pages": ""},
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pikepdf.open(output_path) as result:
        for page in result.pages:
            assert int(page.get("/Rotate", 0)) % 360 == 90


def test_rotate_pdf_path_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "rotate-path.pdf", 2)
    resp = client.post(
        "/organize/rotate-pdf",
        params={"degrees": "180", "pages": ""},
        json={"input_paths": [str(source)]},
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pikepdf.open(output_path) as result:
        for page in result.pages:
            assert int(page.get("/Rotate", 0)) % 360 == 180


def test_password_protect_upload_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "protectme.pdf", 1)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/password-protect-upload",
            files=[("files", ("protectme.pdf", source_file, "application/pdf"))],
            data={"password": "secret123"},
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pytest.raises(pikepdf.PasswordError):
        pikepdf.open(output_path)
    with pikepdf.open(output_path, password="secret123") as result:
        assert len(result.pages) == 1


def test_remove_metadata_upload_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "metadatame.pdf", 1)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/remove-metadata-upload",
            files=[("files", ("metadatame.pdf", source_file, "application/pdf"))],
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pikepdf.open(output_path) as result:
        assert "/Title" not in result.docinfo


def test_download_result_requires_app_data_path(tmp_path: Path):
    outside_file = tmp_path / "outside.pdf"
    outside_file.write_text("not allowed", encoding="utf-8")
    resp = client.get(
        "/results/download",
        params={"path": str(outside_file)},
        headers={"x-privatepdf-token": settings.auth_token},
    )
    assert resp.status_code == 403


def test_download_result_and_zip_for_generated_output(tmp_path: Path):
    a = make_image(tmp_path / "a.png", "red")
    with a.open("rb") as image_file:
        convert_resp = client.post(
            "/organize/images-to-pdf-upload",
            files=[("files", ("a.png", image_file, "image/png"))],
            headers={"x-privatepdf-token": settings.auth_token},
        )
    output_path = convert_resp.json()["output_path"]

    download_resp = client.get(
        "/results/download",
        params={"path": output_path},
        headers={"x-privatepdf-token": settings.auth_token},
    )
    assert download_resp.status_code == 200
    assert download_resp.content

    zip_resp = client.post(
        "/results/zip",
        json={"paths": [output_path]},
        headers={"x-privatepdf-token": settings.auth_token},
    )
    assert zip_resp.status_code == 200
    assert zip_resp.content.startswith(b"PK")


def test_health_endpoint_no_auth_needed():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
