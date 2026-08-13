"""
Basic PDF security and privacy helpers.
"""
from __future__ import annotations

from pathlib import Path

import pikepdf

from engines.pdf.organize import PdfEngineError


def password_protect(input_path: Path, output_path: Path, password: str) -> Path:
    if not password:
        raise PdfEngineError("password must not be empty")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with pikepdf.open(input_path) as doc:
            doc.save(
                output_path,
                encryption=pikepdf.Encryption(owner=password, user=password, R=6),
            )
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is already password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be read: {exc}") from exc

    return output_path


def remove_metadata(input_path: Path, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with pikepdf.open(input_path) as doc:
            for key in list(doc.docinfo.keys()):
                del doc.docinfo[key]
            with doc.open_metadata(set_pikepdf_as_editor=False) as metadata:
                for key in list(metadata.keys()):
                    del metadata[key]
            doc.save(output_path)
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be read: {exc}") from exc

    return output_path
