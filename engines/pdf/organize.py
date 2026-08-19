"""
Core PDF organization operations: merge, split, extract, delete, reorder, rotate.

Deliberately has zero web/framework imports — this module should be usable
from a future CLI or test harness without pulling in FastAPI.
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
from math import cos, radians, sin
from typing import Callable

import pikepdf
from PIL import Image


class PdfEngineError(Exception):
    """Raised for any recoverable failure in PDF processing (bad input, etc.)."""


def _escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _hex_to_rgb(color: str) -> tuple[float, float, float]:
    value = color.strip().lstrip("#")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    if len(value) != 6:
        value = "b02730"
    red = int(value[0:2], 16) / 255.0
    green = int(value[2:4], 16) / 255.0
    blue = int(value[4:6], 16) / 255.0
    return (red, green, blue)


def _estimate_text_width(text: str, size: float) -> float:
    return max(size * 2, len(text) * size * 0.58)


def _watermark_position(
    width: float,
    height: float,
    text_width: float,
    text_height: float,
    position: str,
) -> tuple[float, float]:
    margin_x = max(24.0, text_height * 0.9)
    margin_y = max(24.0, text_height * 0.9)
    presets = {
        "center": ((width - text_width) / 2, (height - text_height) / 2),
        "top-left": (margin_x, height - margin_y - text_height),
        "top-right": (width - margin_x - text_width, height - margin_y - text_height),
        "bottom-left": (margin_x, margin_y),
        "bottom-right": (width - margin_x - text_width, margin_y),
    }
    return presets.get(position, presets["center"])


def _rotation_matrix(angle: float) -> tuple[float, float, float, float]:
    radians_angle = radians(angle)
    return (cos(radians_angle), sin(radians_angle), -sin(radians_angle), cos(radians_angle))


def _build_watermark_stream(
    *,
    kind: str,
    text: str,
    badge: str,
    position: str,
    angle: float,
    opacity: float,
    size: float,
    color: str,
    width: float,
    height: float,
) -> bytes:
    rgb = _hex_to_rgb(color)
    a, b, c, d = _rotation_matrix(angle)
    font_size = size
    target_text = text.strip()[:120] or "NoDoc"

    if kind == "badge":
        badge_size = _clamp(size * 1.6, 42.0, 220.0)
        x, y = _watermark_position(width, height, badge_size, badge_size, position)
        x += badge_size / 2
        y += badge_size / 2
        box = badge_size
        badge_fill = (0.96, 0.86, 0.2) if badge == "question" else rgb
        badge_ink = (0.16, 0.16, 0.16) if badge == "question" else (1.0, 1.0, 1.0)
        accent = (0.82, 0.59, 0.08) if badge == "question" else (0.15, 0.62, 0.34)
        question = (
            "BT\n"
            f"/Helvetica-Bold {max(24.0, badge_size * 0.56):.2f} Tf\n"
            f"0 0 0 rg\n"
            f"{-badge_size * 0.14:.2f} {-badge_size * 0.22:.2f} Td\n"
            "(?) Tj\n"
            "ET\n"
        )
        tick = (
            "q\n"
            f"{accent[0]:.3f} {accent[1]:.3f} {accent[2]:.3f} RG\n"
            f"{max(4.0, badge_size * 0.08):.2f} w\n"
            "1 J 1 j\n"
            f"{-badge_size * 0.22:.2f} {-badge_size * 0.02:.2f} m\n"
            f"{-badge_size * 0.08:.2f} {-badge_size * 0.18:.2f} l\n"
            f"{badge_size * 0.22:.2f} {badge_size * 0.18:.2f} l\n"
            "S\n"
            "Q\n"
        )
        symbol_stream = question if badge == "question" else tick
        return (
            "q\n"
            f"/NoDocGS1 gs\n"
            f"{a:.4f} {b:.4f} {c:.4f} {d:.4f} {x:.2f} {y:.2f} cm\n"
            f"{badge_fill[0]:.3f} {badge_fill[1]:.3f} {badge_fill[2]:.3f} rg\n"
            f"{-box / 2:.2f} {-box / 2:.2f} {box:.2f} {box:.2f} re\n"
            "f\n"
            f"{badge_ink[0]:.3f} {badge_ink[1]:.3f} {badge_ink[2]:.3f} rg\n"
            f"BT\n/Helvetica-Bold {max(14.0, badge_size * 0.18):.2f} Tf\n"
            f"{-badge_size * 0.36:.2f} {-badge_size * 0.43:.2f} Td\n"
            f"({ _escape_pdf_text(target_text[:24]) }) Tj\n"
            "ET\n"
            f"{symbol_stream}"
            "Q\n"
        ).encode("ascii", errors="ignore")

    text_width = _estimate_text_width(target_text, font_size)
    x, y = _watermark_position(width, height, text_width, font_size, position)
    x += text_width / 2
    y += font_size / 2
    return (
        "q\n"
        f"/NoDocGS1 gs\n"
        f"{a:.4f} {b:.4f} {c:.4f} {d:.4f} {x:.2f} {y:.2f} cm\n"
        f"{rgb[0]:.3f} {rgb[1]:.3f} {rgb[2]:.3f} rg\n"
        f"BT\n/Helvetica-Bold {font_size:.2f} Tf\n"
        f"{-text_width / 2:.2f} {-font_size / 3:.2f} Td\n"
        f"({_escape_pdf_text(target_text)}) Tj\n"
        "ET\n"
        "Q\n"
    ).encode("ascii", errors="ignore")


def _load_image_xobject(doc: pikepdf.Pdf, image_path: Path) -> tuple[pikepdf.Stream, float, float]:
    try:
        with Image.open(image_path) as image:
            if image.mode in {"RGBA", "LA"}:
                background = Image.new("RGB", image.size, (255, 255, 255))
                alpha = image.getchannel("A")
                background.paste(image.convert("RGB"), mask=alpha)
                image = background
            else:
                image = image.convert("RGB")

            buffer = BytesIO()
            image.save(buffer, format="JPEG", quality=92, optimize=True)
            width, height = image.size
    except OSError as exc:
        raise PdfEngineError(f"'{image_path.name}' is not a readable image") from exc

    stream = pikepdf.Stream(
        doc,
        buffer.getvalue(),
        Type=pikepdf.Name.XObject,
        Subtype=pikepdf.Name.Image,
        Width=width,
        Height=height,
        ColorSpace=pikepdf.Name.DeviceRGB,
        BitsPerComponent=8,
        Filter=pikepdf.Name.DCTDecode,
    )
    return stream, float(width), float(height)


def _build_image_watermark_stream(
    *,
    image_name: pikepdf.Name,
    position: str,
    angle: float,
    size: float,
    page_width: float,
    page_height: float,
    image_width: float,
    image_height: float,
) -> bytes:
    a, b, c, d = _rotation_matrix(angle)
    aspect = image_height / max(1.0, image_width)
    draw_width = _clamp(size * 3.2, 48.0, min(page_width * 0.82, 520.0))
    draw_height = _clamp(draw_width * aspect, 24.0, page_height * 0.82)
    x, y = _watermark_position(page_width, page_height, draw_width, draw_height, position)
    center_x = x + draw_width / 2
    center_y = y + draw_height / 2
    resource_name = str(image_name)[1:]
    return (
        "q\n"
        "/NoDocGS1 gs\n"
        f"{a:.4f} {b:.4f} {c:.4f} {d:.4f} {center_x:.2f} {center_y:.2f} cm\n"
        f"{draw_width:.2f} 0 0 {draw_height:.2f} {-draw_width / 2:.2f} {-draw_height / 2:.2f} cm\n"
        f"/{resource_name} Do\n"
        "Q\n"
    ).encode("ascii", errors="ignore")


def merge(
    input_paths: list[Path],
    output_path: Path,
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    if not input_paths:
        raise PdfEngineError("no input files provided")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.new() as target:
        for index, src in enumerate(input_paths, start=1):
            if not src.exists():
                raise PdfEngineError(f"input file not found: {src.name}")
            try:
                with pikepdf.open(src) as doc:
                    target.pages.extend(doc.pages)
                    if on_progress is not None:
                        on_progress(int((index / max(1, len(input_paths))) * 100))
            except pikepdf.PasswordError as exc:
                raise PdfEngineError(f"'{src.name}' is password-protected") from exc
            except pikepdf.PdfError as exc:
                raise PdfEngineError(f"'{src.name}' could not be read: {exc}") from exc
        target.save(output_path)

    return output_path


def rotate(input_path: Path, output_path: Path, degrees: int, pages: list[int] | None = None) -> Path:
    """degrees must be a multiple of 90. pages is 0-indexed; None = all pages."""
    if degrees % 90 != 0:
        raise PdfEngineError("rotation must be a multiple of 90 degrees")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.open(input_path) as doc:
        target_pages = range(len(doc.pages)) if pages is None else pages
        for i in target_pages:
            doc.pages[i].rotate(degrees, relative=True)
        doc.save(output_path)

    return output_path


def extract_pages(input_path: Path, output_path: Path, page_indices: list[int]) -> Path:
    """page_indices are 0-indexed pages to copy into a new PDF."""
    if not page_indices:
        raise PdfEngineError("no pages selected")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.open(input_path) as doc:
        with pikepdf.new() as target:
            for i in page_indices:
                target.pages.append(doc.pages[i])
            target.save(output_path)

    return output_path


def delete_pages(input_path: Path, output_path: Path, page_indices: list[int]) -> Path:
    """page_indices are 0-indexed pages to remove."""
    if not page_indices:
        raise PdfEngineError("no pages selected")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.open(input_path) as doc:
        if len(page_indices) >= len(doc.pages):
            raise PdfEngineError("cannot delete every page in a PDF")
        for i in sorted(page_indices, reverse=True):
            del doc.pages[i]
        doc.save(output_path)

    return output_path


def reorder_pages(input_path: Path, output_path: Path, page_indices: list[int]) -> Path:
    """page_indices are 0-indexed pages in the desired output order."""
    if not page_indices:
        raise PdfEngineError("no pages selected")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.open(input_path) as doc:
        page_count = len(doc.pages)
        expected = set(range(page_count))
        requested = set(page_indices)
        if len(page_indices) != page_count or requested != expected:
            raise PdfEngineError("page order must include every page exactly once")

        with pikepdf.new() as target:
            for i in page_indices:
                target.pages.append(doc.pages[i])
            target.save(output_path)

    return output_path


def reverse_pages(input_path: Path, output_path: Path) -> Path:
    """Reverse the order of every page in the PDF."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.open(input_path) as doc:
        with pikepdf.new() as target:
            for page in reversed(doc.pages):
                target.pages.append(page)
            target.save(output_path)

    return output_path


def duplicate_pages(input_path: Path, output_path: Path, page_indices: list[int]) -> Path:
    """Duplicate selected pages in-place after their original copies."""
    if not page_indices:
        raise PdfEngineError("no pages selected")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with pikepdf.open(input_path) as doc:
        page_count = len(doc.pages)
        if any(i < 0 or i >= page_count for i in page_indices):
            raise PdfEngineError("one or more page numbers are out of range")

        duplicates = list(page_indices)
        with pikepdf.new() as target:
            for index, page in enumerate(doc.pages):
                target.pages.append(page)
                if index in duplicates:
                    target.pages.append(page)
            target.save(output_path)

    return output_path


def repair(input_path: Path, output_path: Path) -> Path:
    """Best-effort rewrite for PDFs pikepdf can recover and resave cleanly."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with pikepdf.open(input_path) as doc:
            doc.save(output_path)
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be repaired: {exc}") from exc

    return output_path


def add_text_watermark(
    input_path: Path,
    output_path: Path,
    text: str,
    *,
    kind: str = "text",
    badge: str = "verified",
    page_indices: list[int] | None = None,
    position: str = "center",
    angle: float = -45.0,
    opacity: float = 0.22,
    size: float = 48.0,
    color: str = "#b02730",
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    if kind == "text" and not text.strip():
        raise PdfEngineError("watermark text must not be empty")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    opacity = _clamp(opacity, 0.05, 1.0)
    size = _clamp(size, 12.0, 180.0)
    rgb = _hex_to_rgb(color)

    try:
        with pikepdf.open(input_path) as doc:
            target_pages = range(len(doc.pages)) if page_indices is None else page_indices
            target_pages = list(target_pages)
            for offset, i in enumerate(target_pages, start=1):
                page = doc.pages[i]
                gs_name = page.add_resource(
                    pikepdf.Dictionary({"/CA": opacity, "/ca": opacity}),
                    pikepdf.Name.ExtGState,
                    prefix="NoDocGS",
                )
                media_box = [float(value) for value in page.MediaBox]
                width = max(1.0, media_box[2] - media_box[0])
                height = max(1.0, media_box[3] - media_box[1])
                content = _build_watermark_stream(
                    kind=kind,
                    text=text,
                    badge=badge,
                    position=position,
                    angle=angle,
                    opacity=opacity,
                    size=size,
                    color=color,
                    width=width,
                    height=height,
                )
                page.contents_add(
                    pikepdf.Stream(
                        doc,
                        content.replace(b"/NoDocGS1", f"/{str(gs_name)[1:]}".encode("ascii")),
                    )
                )
                if on_progress is not None:
                    on_progress(int((offset / max(1, len(target_pages))) * 100))

            doc.save(output_path)
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be watermarked: {exc}") from exc

    return output_path


def add_image_watermark(
    input_path: Path,
    output_path: Path,
    image_path: Path,
    *,
    page_indices: list[int] | None = None,
    position: str = "center",
    angle: float = -45.0,
    opacity: float = 0.22,
    size: float = 48.0,
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    opacity = _clamp(opacity, 0.05, 1.0)
    size = _clamp(size, 12.0, 180.0)

    try:
        with pikepdf.open(input_path) as doc:
            image_stream, image_width, image_height = _load_image_xobject(doc, image_path)
            target_pages = range(len(doc.pages)) if page_indices is None else page_indices
            target_pages = list(target_pages)
            for offset, i in enumerate(target_pages, start=1):
                page = doc.pages[i]
                gs_name = page.add_resource(
                    pikepdf.Dictionary({"/CA": opacity, "/ca": opacity}),
                    pikepdf.Name.ExtGState,
                    prefix="NoDocGS",
                )
                image_name = page.add_resource(image_stream, pikepdf.Name.XObject, prefix="NoDocImg")
                media_box = [float(value) for value in page.MediaBox]
                width = max(1.0, media_box[2] - media_box[0])
                height = max(1.0, media_box[3] - media_box[1])
                content = _build_image_watermark_stream(
                    image_name=image_name,
                    position=position,
                    angle=angle,
                    size=size,
                    page_width=width,
                    page_height=height,
                    image_width=image_width,
                    image_height=image_height,
                )
                page.contents_add(
                    pikepdf.Stream(
                        doc,
                        content.replace(b"/NoDocGS1", f"/{str(gs_name)[1:]}".encode("ascii")),
                    )
                )
                if on_progress is not None:
                    on_progress(int((offset / max(1, len(target_pages))) * 100))

            doc.save(output_path)
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be watermarked: {exc}") from exc

    return output_path


def add_page_numbers(
    input_path: Path,
    output_path: Path,
    *,
    page_indices: list[int] | None = None,
    position: str = "bottom-right",
    size: float = 12.0,
    opacity: float = 0.7,
    color: str = "#b02730",
    prefix: str = "",
    suffix: str = "",
    start: int = 1,
    on_progress: Callable[[int], None] | None = None,
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    opacity = _clamp(opacity, 0.05, 1.0)
    size = _clamp(size, 10.0, 36.0)
    rgb = _hex_to_rgb(color)

    try:
        with pikepdf.open(input_path) as doc:
            target_pages = range(len(doc.pages)) if page_indices is None else page_indices
            target_pages = list(target_pages)
            for offset, i in enumerate(target_pages, start=1):
                page = doc.pages[i]
                gs_name = page.add_resource(
                    pikepdf.Dictionary({"/CA": opacity, "/ca": opacity}),
                    pikepdf.Name.ExtGState,
                    prefix="NoDocGS",
                )
                media_box = [float(value) for value in page.MediaBox]
                width = max(1.0, media_box[2] - media_box[0])
                height = max(1.0, media_box[3] - media_box[1])
                label = f"{prefix}{start + offset - 1}{suffix}"
                text_width = _estimate_text_width(label, size)
                box_width = text_width + max(12.0, size * 0.9)
                box_height = size + max(10.0, size * 0.7)
                x, y = _watermark_position(width, height, box_width, box_height, position)
                x += box_width / 2
                y += box_height / 2
                x_text = -text_width / 2
                y_text = -size / 3
                content = (
                    "q\n"
                    f"/NoDocGS1 gs\n"
                    "0.98 0.94 0.94 rg\n"
                    f"{x:.2f} {y:.2f} {box_width:.2f} {box_height:.2f} re\n"
                    "f\n"
                    f"{rgb[0]:.3f} {rgb[1]:.3f} {rgb[2]:.3f} rg\n"
                    f"BT\n/Helvetica-Bold {size:.2f} Tf\n"
                    f"1 0 0 1 {x:.2f} {y:.2f} Tm\n"
                    f"{x_text:.2f} {y_text:.2f} Td\n"
                    f"({_escape_pdf_text(label)}) Tj\n"
                    "ET\n"
                    "Q\n"
                ).encode("ascii", errors="ignore")
                page.contents_add(
                    pikepdf.Stream(
                        doc,
                        content.replace(b"/NoDocGS1", f"/{str(gs_name)[1:]}".encode("ascii")),
                    )
                )
                if on_progress is not None:
                    on_progress(int((offset / max(1, len(target_pages))) * 100))

            doc.save(output_path)
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be numbered: {exc}") from exc

    return output_path
