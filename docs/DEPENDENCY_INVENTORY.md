# Dependency & License Inventory

Every dependency must be added here before being merged. Update whenever a dependency is added, upgraded, or removed.

| Package | Version pinned | License | Redistribution OK? | Offline? | Notes |
|---|---|---|---|---|---|
| pikepdf | TBD (latest stable) | Apache-2.0 (wraps qpdf, Apache-2.0 as of v11) | Yes | Yes | Core PDF engine. Verify qpdf version bundled is Apache-2.0, not older Artistic-2.0/GPL builds. |
| pypdfium2 | TBD | Apache-2.0 / BSD-3 (dual, wraps PDFium) | Yes | Yes | Rendering. Chosen over PyMuPDF specifically to avoid AGPL. |
| pypdf | TBD | BSD-3 | Yes | Yes | Fallback pure-Python ops. |
| Pillow | TBD | HPND (permissive) | Yes | Yes | Image handling. |
| reportlab | TBD | BSD-3 (open-source edition) | Yes | Yes | Overlay generation (watermarks, page numbers, text→PDF). Do NOT confuse with ReportLab PLUS (commercial) — use OSS package only. |
| weasyprint | TBD | BSD-3 | Yes | Yes | HTML→PDF. Depends on Pango/Cairo (LGPL) as system libs — verify Windows bundling story. |
| ocrmypdf | TBD | MPL-2.0 | Yes | Yes | Orchestrates Tesseract OCR pipeline. |
| Tesseract OCR (binary) | TBD | Apache-2.0 | Yes | Yes | Bundle selected language traineddata (also Apache-2.0) only for languages we ship. |
| python-docx | TBD | MIT | Yes | Yes | |
| openpyxl | TBD | MIT/LGPL dual-licensed | Yes | Yes | |
| pyHanko | TBD | MIT | Yes | Yes | Digital signatures. |
| LibreOffice (headless, optional/detected) | TBD | MPL-2.0 | Yes, as unmodified subprocess | Yes | NOT statically linked; invoked as external `soffice` binary. Decide bundle-vs-detect before Milestone 5. |
| FastAPI | TBD | MIT | Yes | Yes (dev/runtime dep only, no network requirement) | |
| uvicorn | TBD | BSD-3 | Yes | Yes | |
| React | TBD | MIT | Yes | Yes | |
| Tauri | TBD | MIT/Apache-2.0 | Yes | Yes | |

## Explicitly avoided

| Package | Reason |
|---|---|
| PyMuPDF (fitz) | AGPL-3.0 or paid commercial license from Artifex — incompatible with our MIT + free-redistribution model unless we deliberately go AGPL. |
| poppler-based renderers (e.g. some pdf2image backends) | poppler is GPL-2.0+; pypdfium2 gives equivalent functionality under a permissive license. |

## Process

Before adding any new dependency: identify what it does → check license → check redistribution rights → check offline operability → check no hidden API requirement → check maintenance activity → check Windows compatibility → check packaging implications → add a row here.
