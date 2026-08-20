from __future__ import annotations

from pathlib import Path

import pikepdf

from engines.pdf.organize import PdfEngineError


def read_metadata(input_path: Path) -> dict[str, str]:
    try:
        with pikepdf.open(input_path) as doc:
            info = doc.docinfo
            return {
                "Title": str(info.get("/Title", "")),
                "Author": str(info.get("/Author", "")),
                "Subject": str(info.get("/Subject", "")),
                "Keywords": str(info.get("/Keywords", "")),
                "Creator": str(info.get("/Creator", "")),
                "Producer": str(info.get("/Producer", "")),
                "CreationDate": str(info.get("/CreationDate", "")),
                "ModDate": str(info.get("/ModDate", "")),
            }
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be inspected: {exc}") from exc


def write_metadata(input_path: Path, output_path: Path, updates: dict[str, str], *, remove_all: bool = False) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with pikepdf.open(input_path) as doc:
            if remove_all:
                for key in list(doc.docinfo.keys()):
                    del doc.docinfo[key]
            else:
                mapping = {
                    "Title": "/Title",
                    "Author": "/Author",
                    "Subject": "/Subject",
                    "Keywords": "/Keywords",
                    "Creator": "/Creator",
                    "Producer": "/Producer",
                }
                for key, pdf_key in mapping.items():
                    value = updates.get(key, "")
                    if value:
                        doc.docinfo[pdf_key] = value
                    elif pdf_key in doc.docinfo:
                        del doc.docinfo[pdf_key]
            doc.save(output_path)
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be updated: {exc}") from exc
    return output_path
