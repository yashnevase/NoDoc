"""
Basic PDF security and privacy helpers.
"""
from __future__ import annotations

from pathlib import Path

import pikepdf

from engines.pdf.organize import PdfEngineError


def _signature_value(value: object) -> dict | None:
    if isinstance(value, pikepdf.Dictionary):
        return value
    return None


def _walk_signature_fields(fields: list[object]) -> list[object]:
    collected: list[object] = []
    for field in fields:
        collected.append(field)
        try:
            kids = list(field.get("/Kids", []))
        except Exception:
            kids = []
        if kids:
            collected.extend(_walk_signature_fields(kids))
    return collected


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


def inspect_signatures(input_path: Path) -> dict[str, object]:
    output: dict[str, object] = {
        "document_signed": False,
        "signature_count": 0,
        "status": "no_signatures",
        "fields": [],
    }

    try:
        with pikepdf.open(input_path) as doc:
            acroform = doc.Root.get("/AcroForm")
            fields = []
            if acroform is not None:
                try:
                    fields = list(acroform.get("/Fields", []))
                except Exception:
                    fields = []

            signatures: list[dict[str, object]] = []
            for field in _walk_signature_fields(fields):
                field_type = field.get("/FT")
                if str(field_type) != "/Sig":
                    continue

                sig_value = _signature_value(field.get("/V"))
                signed = False
                issues: list[str] = []
                if sig_value is None:
                    issues.append("Signature field has no value")
                else:
                    has_byte_range = sig_value.get("/ByteRange") is not None
                    has_contents = sig_value.get("/Contents") is not None
                    signed = has_byte_range and has_contents
                    if not has_byte_range:
                        issues.append("Missing ByteRange")
                    if not has_contents:
                        issues.append("Missing Contents")

                field_name = field.get("/T")
                signatures.append(
                    {
                        "name": str(field_name) if field_name is not None else "Unnamed signature",
                        "signed": signed,
                        "issues": issues,
                        "filter": str(sig_value.get("/Filter")) if sig_value is not None and sig_value.get("/Filter") is not None else "",
                        "subfilter": str(sig_value.get("/SubFilter")) if sig_value is not None and sig_value.get("/SubFilter") is not None else "",
                    }
                )

            output["signature_count"] = len(signatures)
            output["document_signed"] = any(sig["signed"] for sig in signatures)
            output["status"] = "signed" if signatures and output["document_signed"] else ("unsigned" if signatures else "no_signatures")
            output["fields"] = signatures
    except pikepdf.PasswordError as exc:
        raise PdfEngineError(f"'{input_path.name}' is password-protected") from exc
    except pikepdf.PdfError as exc:
        raise PdfEngineError(f"'{input_path.name}' could not be inspected: {exc}") from exc

    return output
