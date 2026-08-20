from __future__ import annotations

from pathlib import Path
from typing import Callable

import pikepdf

from ._marking import add_opacity_resource as _add_opacity_resource, clamp as _clamp, hex_to_rgb as _hex_to_rgb, page_size as _page_size
from .organize import PdfEngineError


def highlight_pages(
    input_path: Path,
    output_path: Path,
    *,
    regions: list[dict[str, float | int]],
    color: str = "#f2cd53",
    opacity: float = 0.34,
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    if not regions:
        raise PdfEngineError("at least one highlight region is required")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    grouped_regions = _group_regions(regions)
    rgb = _hex_to_rgb(color)
    opacity = _clamp(opacity, 0.05, 1.0)

    try:
        with pikepdf.open(input_path) as doc:
            total_pages = len(doc.pages)
            for page_number, page in enumerate(doc.pages, start=1):
                page_regions = grouped_regions.get(page_number, [])
                if not page_regions:
                    if on_progress is not None:
                        on_progress(int((page_number / max(1, total_pages)) * 100))
                    continue

                width, height = _page_size(page)
                gs_name = _add_opacity_resource(page, opacity)
                content = _build_highlight_stream(
                    page_width=width,
                    page_height=height,
                    regions=page_regions,
                    rgb=rgb,
                )
                page.contents_add(
                    pikepdf.Stream(
                        doc,
                        content.replace(b"/NoDocGS1", f"/{str(gs_name)[1:]}".encode("ascii")),
                    )
                )
                if on_progress is not None:
                    on_progress(int((page_number / max(1, total_pages)) * 100))

            doc.save(output_path)
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be highlighted: {exc}") from exc

    return output_path


def _group_regions(regions: list[dict[str, float | int]]) -> dict[int, list[dict[str, float]]]:
    grouped: dict[int, list[dict[str, float]]] = {}
    for region in regions:
        page = int(region.get("page", 0))
        if page < 1:
            raise PdfEngineError("highlight page numbers must start at 1")

        x = float(region.get("x", 0))
        y = float(region.get("y", 0))
        width = float(region.get("width", 0))
        height = float(region.get("height", 0))
        if width <= 0 or height <= 0:
            raise PdfEngineError("highlight boxes must have positive width and height")

        grouped.setdefault(page, []).append(
            {
                "x": _clamp(x, 0.0, 1.0),
                "y": _clamp(y, 0.0, 1.0),
                "width": _clamp(width, 0.0, 1.0),
                "height": _clamp(height, 0.0, 1.0),
            }
        )
    return grouped


def _build_highlight_stream(
    *,
    page_width: float,
    page_height: float,
    regions: list[dict[str, float]],
    rgb: tuple[float, float, float],
) -> bytes:
    commands = [
        "q",
        "/NoDocGS1 gs",
        f"{rgb[0]:.3f} {rgb[1]:.3f} {rgb[2]:.3f} rg",
    ]
    for region in regions:
        left = _clamp(region["x"], 0.0, 1.0) * page_width
        rect_width = max(1.0, _clamp(region["width"], 0.0, 1.0) * page_width)
        rect_height = max(1.0, _clamp(region["height"], 0.0, 1.0) * page_height)
        top = _clamp(region["y"], 0.0, 1.0) * page_height
        bottom = max(0.0, page_height - top - rect_height)
        commands.append(f"{left:.2f} {bottom:.2f} {rect_width:.2f} {rect_height:.2f} re")
        commands.append("f")
    commands.append("Q")
    return ("\n".join(commands) + "\n").encode("ascii", errors="ignore")
