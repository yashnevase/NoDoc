export const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];

export const settingsKey = "nodoc-ui-preferences";
export const historyKey = "nodoc-job-history";
export const recentFilesKey = "nodoc-recent-files";
export const outputFolderKey = "nodoc-output-folder";

export const groups = [
  {
    id: "convert",
    label: "Convert",
    tools: [
      { id: "render", icon: "image", title: "PDF to JPG", detail: "PDF pages to PNG images", needs: "1 PDF", status: "ready" },
      { id: "images", icon: "pdf", title: "JPG to PDF", detail: "Images to one PDF", needs: "Images", status: "ready" },
      { id: "pdf_docx", icon: "word", title: "PDF to DOCX", detail: "High fidelity export", needs: "Later", status: "planned" },
      { id: "docx_pdf", icon: "pdf", title: "DOCX to PDF", detail: "Needs Office engine", needs: "Later", status: "planned" },
      { id: "xlsx_pdf", icon: "sheet", title: "XLSX to PDF", detail: "Needs Office engine", needs: "Later", status: "planned" },
    ],
  },
  {
    id: "organize",
    label: "Organize",
    tools: [
      { id: "merge", icon: "merge", title: "Merge", detail: "Many PDFs to one PDF", needs: "2+ PDFs", status: "ready" },
      { id: "split", icon: "split", title: "Split", detail: "One PDF to page PDFs", needs: "1 PDF", status: "ready" },
      { id: "extract", icon: "extract", title: "Extract", detail: "Picked pages to PDF", needs: "Pick pages", status: "ready" },
      { id: "delete", icon: "trash", title: "Delete", detail: "Remove picked pages", needs: "Pick pages", status: "ready" },
      { id: "rotate", icon: "rotate", title: "Rotate", detail: "Rotate all or picked pages", needs: "1 PDF", status: "ready" },
      { id: "reorder", icon: "reorder", title: "Reorder", detail: "Drag pages into order", needs: "Drag pages", status: "ready" },
      { id: "reverse", icon: "reorder", title: "Reverse", detail: "Flip the page order", needs: "1 PDF", status: "ready" },
      { id: "duplicate", icon: "copy", title: "Duplicate", detail: "Duplicate picked pages", needs: "Pick pages", status: "ready" },
      { id: "crop", icon: "crop", title: "Crop", detail: "Trim page margins", needs: "1 PDF", status: "ready" },
      { id: "compress", icon: "archive", title: "Compress", detail: "Reduce PDF size", needs: "1 PDF", status: "ready" },
      { id: "batch", icon: "batch", title: "Batch", detail: "Run tools on many files", needs: "Later", status: "planned" },
    ],
  },
  {
    id: "edit",
    label: "Edit",
    tools: [
      { id: "watermark", icon: "stamp", title: "Watermark", detail: "Text, badge, or image mark", needs: "1 PDF", status: "ready" },
      { id: "page_numbers", icon: "menu", title: "Page Numbers", detail: "Stamp page numbers", needs: "1 PDF", status: "ready" },
      { id: "text", icon: "text", title: "Text", detail: "Place text on page", needs: "Later", status: "planned" },
      { id: "draw", icon: "draw", title: "Draw", detail: "Ink and shapes", needs: "Later", status: "planned" },
      { id: "highlight", icon: "highlight", title: "Highlight", detail: "Mark page areas", needs: "Later", status: "planned" },
      { id: "sign", icon: "sign", title: "Sign", detail: "Image signature first", needs: "Later", status: "planned" },
      { id: "redact", icon: "redact", title: "Redact", detail: "Flatten boxed regions safely", needs: "Draw boxes", status: "ready" },
    ],
  },
  {
    id: "security",
    label: "Security",
    tools: [
      { id: "password", icon: "lock", title: "Password", detail: "Protect with password", needs: "1 PDF", status: "ready" },
      { id: "encrypt", icon: "shield", title: "Encryption", detail: "AES PDF encryption", needs: "Included", status: "planned" },
      { id: "permissions", icon: "key", title: "Permissions", detail: "Print and copy restrictions", needs: "Later", status: "planned" },
      { id: "digital_sign", icon: "sign", title: "Signature Check", detail: "Inspect and validate signatures", needs: "1 PDF", status: "ready" },
    ],
  },
  {
    id: "ocr",
    label: "OCR",
    tools: [
      { id: "scanned_pdf", icon: "scan", title: "Scanned to PDF", detail: "OCR text layer", needs: "Later", status: "planned" },
      { id: "image_text", icon: "text", title: "Image to Text", detail: "OCR text output", needs: "Later", status: "planned" },
      { id: "searchable", icon: "search", title: "Searchable PDF", detail: "OCR searchable layer", needs: "Later", status: "planned" },
      { id: "batch_ocr", icon: "batch", title: "Batch OCR", detail: "Queue many scans", needs: "Later", status: "planned" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    tools: [
      { id: "reader", icon: "reader", title: "Reader", detail: "Focused PDF reading mode", needs: "1 PDF", status: "ready" },
      { id: "repair", icon: "repair", title: "Repair", detail: "Rewrite a clean PDF copy", needs: "1 PDF", status: "ready" },
      { id: "compare", icon: "compare", title: "Compare", detail: "Visual or text diff", needs: "Later", status: "planned" },
      { id: "pdfa", icon: "archive", title: "PDF/A", detail: "Archive validation", needs: "Complex", status: "planned" },
    ],
  },
];

export const readyToolIds = new Set(
  groups.flatMap((group) => group.tools.filter((tool) => tool.status === "ready").map((tool) => tool.id))
);

export const quickWatermarkAngles = [0, 90, 180, 270];

export const asyncToolIds = new Set([
  "merge",
  "images",
  "split",
  "render",
  "extract",
  "delete",
  "rotate",
  "reorder",
  "crop",
  "reverse",
  "duplicate",
  "compress",
  "redact",
  "password",
  "repair",
  "watermark",
  "page_numbers",
]);
