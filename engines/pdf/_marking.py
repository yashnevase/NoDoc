from __future__ import annotations

from io import BytesIO
from math import cos, radians, sin
from pathlib import Path

import pikepdf
from PIL import Image


class MarkingError(Exception):
    pass


def escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def hex_to_rgb(color: str) -> tuple[float, float, float]:
    value = color.strip().lstrip("#")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    if len(value) != 6:
        value = "b02730"
    red = int(value[0:2], 16) / 255.0
    green = int(value[2:4], 16) / 255.0
    blue = int(value[4:6], 16) / 255.0
    return (red, green, blue)


def estimate_text_width(text: str, size: float) -> float:
    return max(size * 2, len(text) * size * 0.58)


def watermark_position(
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


def rotation_matrix(angle: float) -> tuple[float, float, float, float]:
    radians_angle = radians(angle)
    return (cos(radians_angle), sin(radians_angle), -sin(radians_angle), cos(radians_angle))


def build_watermark_stream(
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
    rgb = hex_to_rgb(color)
    a, b, c, d = rotation_matrix(angle)
    font_size = size
    target_text = text.strip()[:120] or "NoDoc"

    if kind == "badge":
        badge_size = clamp(size * 1.6, 42.0, 220.0)
        x, y = watermark_position(width, height, badge_size, badge_size, position)
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
            f"({escape_pdf_text(target_text[:24])}) Tj\n"
            "ET\n"
            f"{symbol_stream}"
            "Q\n"
        ).encode("ascii", errors="ignore")

    text_width = estimate_text_width(target_text, font_size)
    x, y = watermark_position(width, height, text_width, font_size, position)
    x += text_width / 2
    y += font_size / 2
    return (
        "q\n"
        f"/NoDocGS1 gs\n"
        f"{a:.4f} {b:.4f} {c:.4f} {d:.4f} {x:.2f} {y:.2f} cm\n"
        f"{rgb[0]:.3f} {rgb[1]:.3f} {rgb[2]:.3f} rg\n"
        f"BT\n/Helvetica-Bold {font_size:.2f} Tf\n"
        f"{-text_width / 2:.2f} {-font_size / 3:.2f} Td\n"
        f"({escape_pdf_text(target_text)}) Tj\n"
        "ET\n"
        "Q\n"
    ).encode("ascii", errors="ignore")


def load_image_xobject(doc: pikepdf.Pdf, image_path: Path) -> tuple[pikepdf.Stream, float, float]:
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
        raise MarkingError(f"'{image_path.name}' is not a readable image") from exc

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


def build_image_watermark_stream(
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
    a, b, c, d = rotation_matrix(angle)
    aspect = image_height / max(1.0, image_width)
    draw_width = clamp(size * 3.2, 48.0, min(page_width * 0.82, 520.0))
    draw_height = clamp(draw_width * aspect, 24.0, page_height * 0.82)
    x, y = watermark_position(page_width, page_height, draw_width, draw_height, position)
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


def target_page_indices(doc: pikepdf.Pdf, page_indices: list[int] | None) -> list[int]:
    return list(range(len(doc.pages))) if page_indices is None else list(page_indices)


def page_size(page: pikepdf.Page) -> tuple[float, float]:
    media_box = [float(value) for value in page.MediaBox]
    width = max(1.0, media_box[2] - media_box[0])
    height = max(1.0, media_box[3] - media_box[1])
    return width, height


def add_opacity_resource(page: pikepdf.Page, opacity: float) -> pikepdf.Name:
    return page.add_resource(
        pikepdf.Dictionary({"/CA": opacity, "/ca": opacity}),
        pikepdf.Name.ExtGState,
        prefix="NoDocGS",
    )
