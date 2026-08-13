# Feature Matrix

Legend — Difficulty: Low / Medium / High. Offline: all rows are Yes (that's the product requirement); "Degraded" means offline but with lower fidelity without an optional component.

## A. Organization (Milestone 1)
| Feature | Difficulty | Tech | License | Priority |
|---|---|---|---|---|
| Merge | Low | pikepdf | Apache-2.0 | P0 |
| Split | Low | pikepdf | Apache-2.0 | P0 |
| Extract pages | Low | pikepdf | Apache-2.0 | P0 |
| Delete pages | Low | pikepdf | Apache-2.0 | P0 |
| Reorder | Low | pikepdf | Apache-2.0 | P0 |
| Rotate | Low | pikepdf | Apache-2.0 | P0 |
| Reverse order | Low | pikepdf | Apache-2.0 | P1 |
| Duplicate pages | Low | pikepdf | Apache-2.0 | P1 |
| Thumbnails | Medium | pypdfium2 | Apache-2.0/BSD | P0 |
| Blank page insert | Low | pikepdf | Apache-2.0 | P1 |
| Batch processing | Medium | backend job runner | — | P0 |

## B. Conversion (Milestone 1-2, 5)
| Feature | Difficulty | Tech | License | Priority |
|---|---|---|---|---|
| Images → PDF | Low | Pillow | HPND | P0 |
| PDF → PNG/JPG/WebP | Low | pypdfium2, Pillow | Apache/BSD/HPND | P0 |
| PDF → text | Low | pikepdf/pypdf | Apache/BSD | P1 |
| Text → PDF | Low | reportlab | BSD-3 | P1 |
| HTML → PDF | Medium | weasyprint | BSD-3 | P2 |
| SVG → PDF | Medium | reportlab + svglib | BSD | P2 |
| DOCX/XLSX/PPTX → PDF | High | LibreOffice headless (detect-or-degrade) | MPL-2.0 | P1 |
| PDF → DOCX/XLSX/PPTX | High | LibreOffice headless, best-effort | MPL-2.0 | P2 |
| ODT/ODS/ODP → PDF | Medium | LibreOffice headless | MPL-2.0 | P3 |

## C. Editing (Milestone 2)
| Feature | Difficulty | Tech | Notes |
|---|---|---|---|
| Watermark | Low | pikepdf + reportlab overlay | P0 |
| Page numbers/headers/footers | Low | reportlab overlay | P0 |
| Crop/resize/margins | Low-Medium | pikepdf mediabox ops | P1 |
| Text/shape/highlight/annotation | Medium-High | pikepdf content-stream edits | P1 |
| Redaction (true, not cosmetic) | High | pikepdf — must strip underlying content, not just draw a box | P1, security-sensitive |

## D. Security (Milestone 3)
| Feature | Difficulty | Tech |
|---|---|---|
| Password protect / encrypt | Low | pikepdf (qpdf AES-256) |
| Permissions | Low | pikepdf |
| Remove encryption (with password) | Low | pikepdf |
| Digital signatures | High | pyHanko (MIT) |
| Signature verification | Medium | pyHanko |

## E. OCR (Milestone 4)
| Feature | Difficulty | Tech |
|---|---|---|
| Image/PDF → searchable PDF | Medium | ocrmypdf + Tesseract |
| Language selection | Low | bundled Tesseract traineddata per language (Apache-2.0) |
| Copy/search recognized text | Low | consequence of OCR layer |

## F. Metadata & Archiving (Milestone 2, 6)
| Feature | Difficulty | Tech |
|---|---|---|
| View/edit/remove metadata | Low | pikepdf |
| PDF/A detection/conversion/validation | Medium-High | veraPDF (Apache-2.0/MPL) for validation, pikepdf/ghostscript-alternatives for conversion |

## G. Advanced (Milestone 6)
| Feature | Difficulty | Notes |
|---|---|---|
| PDF repair | Medium-High | qpdf's `--recompress-flate`/repair mode; label as best-effort |
| Comparison (text/visual diff) | Medium | render pages via pypdfium2, diff via `difflib`/pixel-diff |
| Forms fill/flatten/data export | Medium | pikepdf AcroForm access |
