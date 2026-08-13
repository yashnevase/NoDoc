"""
Tests for engines/pdf/organize.py — run with `pytest` from the repo root
(after `pip install -r backend/requirements.txt`).
"""
from __future__ import annotations

from pathlib import Path

import pikepdf
import pytest

from engines.pdf.organize import PdfEngineError, delete_pages, merge, rotate


def make_pdf(path: Path, n_pages: int) -> Path:
    with pikepdf.new() as pdf:
        for _ in range(n_pages):
            pdf.add_blank_page(page_size=(200, 200))
        pdf.save(path)
    return path


def test_merge_combines_page_counts(tmp_path: Path):
    a = make_pdf(tmp_path / "a.pdf", 2)
    b = make_pdf(tmp_path / "b.pdf", 3)
    out = merge([a, b], tmp_path / "out" / "merged.pdf")

    with pikepdf.open(out) as result:
        assert len(result.pages) == 5


def test_merge_raises_on_missing_file(tmp_path: Path):
    a = make_pdf(tmp_path / "a.pdf", 1)
    missing = tmp_path / "does_not_exist.pdf"
    with pytest.raises(PdfEngineError):
        merge([a, missing], tmp_path / "out.pdf")


def test_merge_raises_on_empty_input(tmp_path: Path):
    with pytest.raises(PdfEngineError):
        merge([], tmp_path / "out.pdf")


def test_rotate_rejects_non_90_multiple(tmp_path: Path):
    a = make_pdf(tmp_path / "a.pdf", 1)
    with pytest.raises(PdfEngineError):
        rotate(a, tmp_path / "out.pdf", degrees=45)


def test_rotate_all_pages(tmp_path: Path):
    a = make_pdf(tmp_path / "a.pdf", 2)
    out = rotate(a, tmp_path / "out.pdf", degrees=90)
    with pikepdf.open(out) as result:
        for page in result.pages:
            assert int(page.get("/Rotate", 0)) % 360 == 90


def test_delete_pages(tmp_path: Path):
    a = make_pdf(tmp_path / "a.pdf", 5)
    out = delete_pages(a, tmp_path / "out.pdf", page_indices=[0, 4])
    with pikepdf.open(out) as result:
        assert len(result.pages) == 3
