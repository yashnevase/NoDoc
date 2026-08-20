"""
API-level tests using FastAPI's TestClient — verifies auth enforcement and
the merge endpoint end-to-end, without a running network server.
"""
from __future__ import annotations

from pathlib import Path
import time

import pikepdf
import pypdfium2 as pdfium
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


def make_text_pdf(path: Path, pages: list[str]) -> Path:
    objects: list[bytes] = []
    page_ids: list[int] = []
    content_ids: list[int] = []
    next_id = 3

    for _ in pages:
        page_ids.append(next_id)
        next_id += 1
    font_id = next_id
    next_id += 1
    for _ in pages:
        content_ids.append(next_id)
        next_id += 1

    kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("ascii"))

    for index, text in enumerate(pages):
        escaped_text = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        page_obj = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] "
            f"/Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_ids[index]} 0 R >>"
        ).encode("ascii")
        objects.append(page_obj)

    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for text in pages:
        escaped_text = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = f"BT /F1 18 Tf 36 240 Td ({escaped_text}) Tj ET".encode("latin-1")
        content = (
            f"<< /Length {len(stream)} >>\nstream\n".encode("ascii")
            + stream
            + b"\nendstream"
        )
        objects.append(content)

    parts = [b"%PDF-1.4\n"]
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(sum(len(part) for part in parts))
        parts.append(f"{index} 0 obj\n".encode("ascii"))
        parts.append(obj)
        parts.append(b"\nendobj\n")

    xref_offset = sum(len(part) for part in parts)
    parts.append(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    parts.append(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        parts.append(f"{offset:010d} 00000 n \n".encode("ascii"))
    parts.append(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode("ascii")
    )
    path.write_bytes(b"".join(parts))
    return path


def make_sized_pdf(path: Path, sizes: list[tuple[int, int]]) -> Path:
    with pikepdf.new() as pdf:
        for size in sizes:
            pdf.add_blank_page(page_size=size)
        pdf.save(path)
    return path


def page_sizes(path: Path) -> list[tuple[int, int]]:
    with pikepdf.open(path) as pdf:
        sizes = []
        for page in pdf.pages:
            media_box = [int(value) for value in page.MediaBox]
            sizes.append((media_box[2] - media_box[0], media_box[3] - media_box[1]))
        return sizes


def pdf_content_bytes(path: Path) -> bytes:
    with pikepdf.open(path) as pdf:
        chunks: list[bytes] = []
        for page in pdf.pages:
            contents = page.Contents
            streams = contents if isinstance(contents, pikepdf.Array) else [contents]
            for stream in streams:
                chunks.append(stream.read_bytes())
        return b"\n".join(chunks)


def page_content_bytes(path: Path) -> list[bytes]:
    with pikepdf.open(path) as pdf:
        pages: list[bytes] = []
        for page in pdf.pages:
            contents = page.Contents
            if not contents:
                pages.append(b"")
                continue
            streams = contents if isinstance(contents, pikepdf.Array) else [contents]
            pages.append(b"\n".join(stream.read_bytes() for stream in streams))
        return pages


def render_page_rgb(path: Path, page_number: int = 1):
    pdf = pdfium.PdfDocument(str(path))
    try:
        page = pdf[page_number - 1]
        bitmap = page.render(scale=2).to_pil().convert("RGB")
        page.close()
        return bitmap
    finally:
        pdf.close()


def make_image(path: Path, color: str) -> Path:
    image = Image.new("RGB", (120, 120), color=color)
    image.save(path)
    image.close()
    return path


def wait_for_job(job_id: str) -> dict:
    for _ in range(40):
        resp = client.get(
            f"/results/jobs/{job_id}",
            headers={"x-privatepdf-token": settings.auth_token},
        )
        assert resp.status_code == 200
        payload = resp.json()
        if payload["status"] in {"done", "error"}:
            return payload
        time.sleep(0.05)
    raise AssertionError(f"Job {job_id} did not finish in time")


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


def test_merge_async_job_succeeds_with_token(tmp_path: Path):
    a = make_pdf(tmp_path / "a.pdf", 2)
    b = make_pdf(tmp_path / "b.pdf", 1)
    resp = client.post(
        "/organize/merge",
        params={"async_job": "true"},
        json={"input_paths": [str(a), str(b)]},
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 200
    job_id = resp.json()["job_id"]
    payload = wait_for_job(job_id)
    assert payload["status"] == "done"
    assert payload["progress"] == 100
    assert payload["result"]["output_path"]
    output_path = Path(payload["result"]["output_path"])
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


def test_preview_manifest_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "preview-manifest.pdf", 2)
    resp = client.post(
        "/organize/preview-manifest",
        json={"input_paths": [str(source)]},
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["preview_id"]
    assert len(payload["pages"]) == 2
    assert payload["pages"][0]["image"] == ""


def test_preview_page_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "preview-page.pdf", 3)
    resp = client.get(
        "/organize/preview-page",
        params={"path": str(source), "page": 2},
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 200
    payload = resp.json()["page"]
    assert payload["page"] == 2
    assert payload["image"].startswith("data:image/png;base64,")


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


def test_reorder_pages_upload_succeeds_with_token(tmp_path: Path):
    source = make_sized_pdf(tmp_path / "reorderme.pdf", [(200, 200), (260, 200), (320, 200)])
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/reorder-pages-upload",
            files=[("files", ("reorderme.pdf", source_file, "application/pdf"))],
            data={"order": "3,1,2"},
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    assert page_sizes(output_path) == [(320, 200), (200, 200), (260, 200)]


def test_reorder_pages_path_succeeds_with_token(tmp_path: Path):
    source = make_sized_pdf(tmp_path / "reorder-path.pdf", [(200, 200), (260, 200), (320, 200)])
    resp = client.post(
        "/organize/reorder-pages",
        params={"order": "2,3,1"},
        json={"input_paths": [str(source)]},
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    assert page_sizes(output_path) == [(260, 200), (320, 200), (200, 200)]


def test_reorder_pages_rejects_missing_pages(tmp_path: Path):
    source = make_pdf(tmp_path / "bad-order.pdf", 3)
    resp = client.post(
        "/organize/reorder-pages",
        params={"order": "3,1"},
        json={"input_paths": [str(source)]},
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 400


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


def test_repair_pdf_upload_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "repairme.pdf", 2)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/repair-pdf-upload",
            files=[("files", ("repairme.pdf", source_file, "application/pdf"))],
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pikepdf.open(output_path) as result:
        assert len(result.pages) == 2


def test_repair_pdf_path_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "repair-path.pdf", 1)
    resp = client.post(
        "/organize/repair-pdf",
        json={"input_paths": [str(source)]},
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pikepdf.open(output_path) as result:
        assert len(result.pages) == 1


def test_compress_pdf_upload_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "compressme.pdf", 2)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/compress-pdf-upload",
            params={"async_job": "false"},
            files=[("files", ("compressme.pdf", source_file, "application/pdf"))],
            data={"preset": "balanced"},
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    assert output_path.exists()


def test_compress_pdf_path_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "compress-path.pdf", 2)
    before = source.stat().st_size
    resp = client.post(
        "/organize/compress-pdf",
        params={"preset": "balanced"},
        json={"input_paths": [str(source)]},
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    assert output_path.exists()
    assert output_path.stat().st_size <= before


def test_metadata_view_and_update_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "metadata.pdf", 1)
    with pikepdf.open(source) as pdf:
        pdf.docinfo["/Title"] = "Before"
        pdf.save(tmp_path / "metadata-seeded.pdf")

    seeded = tmp_path / "metadata-seeded.pdf"

    resp = client.post(
        "/organize/metadata-view",
        json={"input_paths": [str(seeded)]},
        headers={"x-privatepdf-token": settings.auth_token},
    )
    assert resp.status_code == 200
    assert resp.json()["metadata"]["Title"] == "Before"

    updated = client.post(
        "/organize/metadata",
        json={
            "input_paths": [str(seeded)],
            "title": "After",
            "author": "NoDoc",
            "subject": "Test",
            "keywords": "pdf,tool",
            "creator": "NoDoc",
            "producer": "NoDoc",
        },
        headers={"x-privatepdf-token": settings.auth_token},
    )
    assert updated.status_code == 200
    output_path = Path(updated.json()["output_path"])
    with pikepdf.open(output_path) as pdf:
        assert str(pdf.docinfo.get("/Title", "")) == "After"
        assert str(pdf.docinfo.get("/Author", "")) == "NoDoc"


def test_metadata_upload_remove_all_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "metadata-remove.pdf", 1)
    with pikepdf.open(source) as pdf:
        pdf.docinfo["/Title"] = "Keep"
        pdf.save(tmp_path / "metadata-remove-seeded.pdf")

    seeded = tmp_path / "metadata-remove-seeded.pdf"

    with seeded.open("rb") as source_file:
        resp = client.post(
            "/organize/metadata-upload",
            files=[("files", ("metadata-remove.pdf", source_file, "application/pdf"))],
            data={"remove_all": "true"},
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pikepdf.open(output_path) as pdf:
        assert len(pdf.docinfo.keys()) == 0


def test_redact_pdf_path_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "redact.pdf", 2)
    resp = client.post(
        "/organize/redact-pdf",
        json={
            "input_paths": [str(source)],
            "regions": [
                {"page": 1, "x": 0.2, "y": 0.2, "width": 0.3, "height": 0.3},
            ],
            "color": "#000000",
        },
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pikepdf.open(output_path) as pdf:
        assert len(pdf.pages) == 2

    with render_page_rgb(output_path, 1) as image:
        pixel = image.getpixel((140, 140))
        assert all(channel < 32 for channel in pixel)


def test_redact_pdf_upload_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "redact-upload.pdf", 1)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/redact-pdf-upload",
            files=[("files", ("redact-upload.pdf", source_file, "application/pdf"))],
            data={
                "regions": '[{"page": 1, "x": 0.35, "y": 0.35, "width": 0.25, "height": 0.25}]',
                "color": "#111111",
            },
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with render_page_rgb(output_path, 1) as image:
        pixel = image.getpixel((190, 190))
        assert all(channel < 48 for channel in pixel)


def test_highlight_pdf_path_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "highlight.pdf", 1)
    resp = client.post(
        "/organize/highlight-pdf",
        json={
            "input_paths": [str(source)],
            "regions": [
                {"page": 1, "x": 0.2, "y": 0.2, "width": 0.3, "height": 0.3},
            ],
            "color": "#f2cd53",
            "opacity": 0.5,
        },
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with render_page_rgb(output_path, 1) as image:
        pixel = image.getpixel((140, 140))
        assert pixel[0] > 220
        assert pixel[1] > 190
        assert pixel[2] < 170


def test_highlight_pdf_upload_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "highlight-upload.pdf", 1)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/highlight-pdf-upload",
            files=[("files", ("highlight-upload.pdf", source_file, "application/pdf"))],
            data={
                "regions": '[{"page": 1, "x": 0.3, "y": 0.3, "width": 0.2, "height": 0.2}]',
                "color": "#ffe066",
                "opacity": "0.45",
            },
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with render_page_rgb(output_path, 1) as image:
        pixel = image.getpixel((160, 160))
        assert pixel[0] > 220
        assert pixel[1] > 200


def test_draw_pdf_path_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "draw.pdf", 1)
    resp = client.post(
        "/organize/draw-pdf",
        json={
            "input_paths": [str(source)],
            "strokes": [
                {
                    "page": 1,
                    "points": [
                        {"x": 0.2, "y": 0.2},
                        {"x": 0.5, "y": 0.5},
                    ],
                },
            ],
            "color": "#b02730",
            "opacity": 1.0,
            "thickness": 6,
        },
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    pages = page_content_bytes(output_path)
    assert b"0.690 0.153 0.188 RG" in pages[0]
    assert b"6.00 w" in pages[0]
    assert b"40.00 160.00 m" in pages[0]
    assert b"100.00 100.00 l" in pages[0]


def test_draw_pdf_upload_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "draw-upload.pdf", 1)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/draw-pdf-upload",
            files=[("files", ("draw-upload.pdf", source_file, "application/pdf"))],
            data={
                "strokes": '[{"page": 1, "points": [{"x": 0.3, "y": 0.3}, {"x": 0.6, "y": 0.35}, {"x": 0.7, "y": 0.5}]}]',
                "color": "#202020",
                "opacity": "1.0",
                "thickness": "8",
            },
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    pages = page_content_bytes(output_path)
    assert b"0.125 0.125 0.125 RG" in pages[0]
    assert b"8.00 w" in pages[0]
    assert b"60.00 140.00 m" in pages[0]
    assert b"140.00 100.00 l" in pages[0]


def test_search_text_path_succeeds_with_token(tmp_path: Path):
    source = make_text_pdf(tmp_path / "search-text.pdf", ["Hello NoDoc Search", "Second page keyword"])
    resp = client.post(
        "/organize/search-text",
        json={"input_paths": [str(source)], "query": "search"},
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["total_matches"] == 1
    assert payload["pages_with_matches"] == 1
    assert payload["matches"][0]["page"] == 1
    assert "NoDoc Search" in payload["matches"][0]["snippet"]


def test_search_text_upload_succeeds_with_token(tmp_path: Path):
    source = make_text_pdf(tmp_path / "search-upload.pdf", ["Alpha beta", "Alpha again"])
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/search-text-upload",
            files=[("files", ("search-upload.pdf", source_file, "application/pdf"))],
            data={"query": "alpha"},
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["total_matches"] == 2
    assert payload["pages_with_matches"] == 2


def test_ocr_text_path_succeeds_with_token(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    source = make_pdf(tmp_path / "ocr-text.pdf", 2)

    def fake_ocr_text_file(input_path: Path, *, lang: str = "eng", on_progress=None):
        output_path = input_path.parent / "processed" / "ocr-text_ocr.txt"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("Recognized text", encoding="utf-8")
        return {"output_path": str(output_path), "text": "Recognized text", "page_count": 2}

    monkeypatch.setattr("app.api.organize_paths.ocr_text_file", fake_ocr_text_file)
    resp = client.post(
        "/organize/ocr-text",
        json={"input_paths": [str(source)], "lang": "eng"},
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["text"] == "Recognized text"
    assert payload["page_count"] == 2
    assert payload["output_path"].endswith(".txt")


def test_searchable_pdf_upload_succeeds_with_token(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    source = make_pdf(tmp_path / "searchable.pdf", 1)

    def fake_searchable_pdf_file(input_path: Path, *, lang: str = "eng", on_progress=None):
        output_path = input_path.parent / "processed" / "searchable_searchable.pdf"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with pikepdf.new() as pdf:
            pdf.add_blank_page(page_size=(200, 200))
            pdf.save(output_path)
        return output_path

    monkeypatch.setattr("app.api.organize_uploads.searchable_pdf_file", fake_searchable_pdf_file)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/searchable-pdf-upload",
            files=[("files", ("searchable.pdf", source_file, "application/pdf"))],
            data={"lang": "eng"},
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["output_path"].endswith(".pdf")


def test_watermark_text_upload_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "watermarkme.pdf", 2)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/watermark-text-upload",
            files=[("files", ("watermarkme.pdf", source_file, "application/pdf"))],
            data={"text": "CONFIDENTIAL", "pages": "2", "position": "top-right", "angle": "-35", "size": "38", "opacity": "0.4", "color": "#b02730"},
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    pages = page_content_bytes(output_path)
    assert b"CONFIDENTIAL" not in pages[0]
    assert b"CONFIDENTIAL" in pages[1]


def test_watermark_text_path_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "watermark-path.pdf", 2)
    resp = client.post(
        "/organize/watermark-text",
        params={"text": "NoDoc", "pages": "1", "position": "bottom-left", "angle": "15", "size": "40", "opacity": "0.3", "color": "#445566"},
        json={"input_paths": [str(source)]},
        headers={"x-privatepdf-token": settings.auth_token},
    )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    pages = page_content_bytes(output_path)
    assert b"NoDoc" in pages[0]
    assert b"NoDoc" not in pages[1]


def test_watermark_image_upload_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "image-watermark.pdf", 2)
    mark = make_image(tmp_path / "signature.png", "green")
    with source.open("rb") as source_file, mark.open("rb") as image_file:
        resp = client.post(
            "/organize/watermark-image-upload",
            files=[
                ("files", ("image-watermark.pdf", source_file, "application/pdf")),
                ("image", ("signature.png", image_file, "image/png")),
            ],
            data={"pages": "1", "position": "center", "angle": "15", "size": "52", "opacity": "0.5"},
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    output_path = Path(resp.json()["output_path"])
    with pikepdf.open(output_path) as result:
        assert len(result.pages) == 2
        resources = result.pages[0].Resources.get("/XObject", {})
        assert resources
        assert not result.pages[1].Resources.get("/XObject", {})


def test_watermark_image_upload_async_job_succeeds_with_token(tmp_path: Path):
    source = make_pdf(tmp_path / "image-watermark-async.pdf", 2)
    mark = make_image(tmp_path / "signature-async.png", "green")
    with source.open("rb") as source_file, mark.open("rb") as image_file:
        resp = client.post(
            "/organize/watermark-image-upload",
            params={"async_job": "true"},
            files=[
                ("files", ("image-watermark-async.pdf", source_file, "application/pdf")),
                ("image", ("signature-async.png", image_file, "image/png")),
            ],
            data={"pages": "1", "position": "center", "angle": "15", "size": "52", "opacity": "0.5"},
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    payload = wait_for_job(resp.json()["job_id"])
    assert payload["status"] == "done"
    assert payload["progress"] == 100
    output_path = Path(payload["result"]["output_path"])
    with pikepdf.open(output_path) as result:
        assert len(result.pages) == 2
        resources = result.pages[0].Resources.get("/XObject", {})
        assert resources


def test_signature_report_upload_detects_none(tmp_path: Path):
    source = make_pdf(tmp_path / "signatures.pdf", 1)
    with source.open("rb") as source_file:
        resp = client.post(
            "/organize/signature-report-upload",
            files=[("files", ("signatures.pdf", source_file, "application/pdf"))],
            headers={"x-privatepdf-token": settings.auth_token},
        )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["status"] == "no_signatures"
    assert payload["signature_count"] == 0
    assert payload["document_signed"] is False
    assert payload["fields"] == []


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


def test_recent_files_and_history_are_persisted(tmp_path: Path):
    recent_resp = client.post(
        "/library/recent",
        json={"names": ["a.pdf", "b.pdf"]},
        headers={"x-privatepdf-token": settings.auth_token},
    )
    assert recent_resp.status_code == 200
    assert recent_resp.json()["names"] == ["a.pdf", "b.pdf"]

    history_resp = client.get(
        "/library/history",
        headers={"x-privatepdf-token": settings.auth_token},
    )
    assert history_resp.status_code == 200
    assert isinstance(history_resp.json()["items"], list)


def test_health_endpoint_no_auth_needed():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
