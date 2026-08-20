from __future__ import annotations

from pathlib import Path
from typing import Callable

import pikepdf

from ._marking import add_opacity_resource as _add_opacity_resource, clamp as _clamp, hex_to_rgb as _hex_to_rgb, page_size as _page_size
from .organize import PdfEngineError


def draw_strokes(
    input_path: Path,
    output_path: Path,
    *,
    strokes: list[dict[str, object]],
    color: str = "#b02730",
    opacity: float = 0.92,
    thickness: float = 3.0,
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    if not strokes:
        raise PdfEngineError("at least one drawing stroke is required")

    grouped_strokes = _group_strokes(strokes)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    rgb = _hex_to_rgb(color)
    opacity = _clamp(opacity, 0.05, 1.0)
    thickness = _clamp(thickness, 1.0, 24.0)

    try:
        with pikepdf.open(input_path) as doc:
            total_pages = len(doc.pages)
            for page_number, page in enumerate(doc.pages, start=1):
                page_strokes = grouped_strokes.get(page_number, [])
                if not page_strokes:
                    if on_progress is not None:
                        on_progress(int((page_number / max(1, total_pages)) * 100))
                    continue

                width, height = _page_size(page)
                gs_name = _add_opacity_resource(page, opacity)
                content = _build_draw_stream(
                    page_width=width,
                    page_height=height,
                    strokes=page_strokes,
                    rgb=rgb,
                    thickness=thickness,
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
        raise PdfEngineError(f"'{input_path.name}' could not be drawn on: {exc}") from exc

    return output_path


def _group_strokes(strokes: list[dict[str, object]]) -> dict[int, list[list[tuple[float, float]]]]:
    grouped: dict[int, list[list[tuple[float, float]]]] = {}
    for stroke in strokes:
        page = int(stroke.get("page", 0))
        if page < 1:
            raise PdfEngineError("drawing page numbers must start at 1")

        points_value = stroke.get("points", [])
        if not isinstance(points_value, list) or len(points_value) < 2:
            raise PdfEngineError("each drawing stroke must include at least two points")

        points: list[tuple[float, float]] = []
        for point in points_value:
            if not isinstance(point, dict):
                raise PdfEngineError("drawing points must be objects with x and y values")
            x = _clamp(float(point.get("x", 0.0)), 0.0, 1.0)
            y = _clamp(float(point.get("y", 0.0)), 0.0, 1.0)
            points.append((x, y))

        grouped.setdefault(page, []).append(points)
    return grouped


def _build_draw_stream(
    *,
    page_width: float,
    page_height: float,
    strokes: list[list[tuple[float, float]]],
    rgb: tuple[float, float, float],
    thickness: float,
) -> bytes:
    commands = [
      "q",
      "/NoDocGS1 gs",
      f"{rgb[0]:.3f} {rgb[1]:.3f} {rgb[2]:.3f} RG",
      f"{thickness:.2f} w",
      "1 J",
      "1 j",
    ]
    for stroke in strokes:
        first_x, first_y = stroke[0]
        start_x = first_x * page_width
        start_y = page_height - (first_y * page_height)
        commands.append(f"{start_x:.2f} {start_y:.2f} m")
        for x, y in stroke[1:]:
            draw_x = x * page_width
            draw_y = page_height - (y * page_height)
            commands.append(f"{draw_x:.2f} {draw_y:.2f} l")
        commands.append("S")
    commands.append("Q")
    return ("\n".join(commands) + "\n").encode("ascii", errors="ignore")
