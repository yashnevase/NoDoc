"""
Basic image-to-PDF conversion for local/offline workflows.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, UnidentifiedImageError


class ImageEngineError(Exception):
    """Raised for recoverable image conversion failures."""


def images_to_pdf(input_paths: list[Path], output_path: Path) -> Path:
    if not input_paths:
        raise ImageEngineError("no input files provided")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    converted_images: list[Image.Image] = []
    try:
        for src in input_paths:
            if not src.exists():
                raise ImageEngineError(f"input file not found: {src.name}")

            try:
                with Image.open(src) as image:
                    converted_images.append(image.convert("RGB"))
            except UnidentifiedImageError as exc:
                raise ImageEngineError(f"'{src.name}' is not a supported image file") from exc
            except OSError as exc:
                raise ImageEngineError(f"'{src.name}' could not be read: {exc}") from exc

        first_image, *rest = converted_images
        first_image.save(output_path, save_all=True, append_images=rest)
        return output_path
    finally:
        for image in converted_images:
            image.close()
