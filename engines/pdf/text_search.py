from __future__ import annotations

import re
from pathlib import Path

import pypdfium2 as pdfium

from .organize import PdfEngineError


def search_text(input_path: Path, query: str, *, max_results: int = 80) -> dict[str, object]:
    needle = " ".join(query.split()).strip()
    if not needle:
        raise PdfEngineError("search query must not be empty")

    try:
        pdf = pdfium.PdfDocument(str(input_path))
    except Exception as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be read: {exc}") from exc

    matches: list[dict[str, object]] = []
    total_matches = 0
    query_folded = needle.casefold()

    try:
        for page_index in range(len(pdf)):
            page = pdf[page_index]
            try:
                text_page = page.get_textpage()
                raw_text = text_page.get_text_bounded() or ""
            finally:
                page.close()

            normalized_text = _normalize_text(raw_text)
            if not normalized_text:
                continue

            folded_text = normalized_text.casefold()
            first_index = folded_text.find(query_folded)
            if first_index < 0:
                continue

            count = folded_text.count(query_folded)
            total_matches += count
            matches.append(
                {
                    "page": page_index + 1,
                    "count": count,
                    "snippet": _build_snippet(normalized_text, first_index, len(needle)),
                }
            )
            if len(matches) >= max_results:
                break
    finally:
        pdf.close()

    return {
        "query": needle,
        "matches": matches,
        "pages_with_matches": len(matches),
        "total_matches": total_matches,
    }


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _build_snippet(text: str, start: int, needle_length: int, *, radius: int = 56) -> str:
    snippet_start = max(0, start - radius)
    snippet_end = min(len(text), start + needle_length + radius)
    snippet = text[snippet_start:snippet_end].strip()
    if snippet_start > 0:
        snippet = f"...{snippet}"
    if snippet_end < len(text):
        snippet = f"{snippet}..."
    return snippet
