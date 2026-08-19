import { useEffect, useRef, useState } from "react";
import {
  canUseDesktopBridge,
  checkHealth,
  copyFileToPath,
  deletePagesPath,
  deletePagesUpload,
  downloadResult,
  downloadZip,
  extractPagesPath,
  extractPagesUpload,
  getJobStatus,
  getJobHistory,
  getRecentFiles,
  imagesToPdfPaths,
  imagesToPdfUpload,
  mergePathFiles,
  mergeUploadedFiles,
  passwordProtectPath,
  passwordProtectUpload,
  pdfToImagesPath,
  pdfToImagesUpload,
  pickFilesDialog,
  pickFolderDialog,
  pickSavePathDialog,
  previewPdfManifestPath,
  previewPdfManifestUpload,
  previewPdfPage,
  previewPdfPath,
  previewPdfUpload,
  reorderPagesPath,
  reorderPagesUpload,
  reversePagesPath,
  reversePagesUpload,
  duplicatePagesPath,
  duplicatePagesUpload,
  pageNumbersPath,
  pageNumbersUpload,
  repairPdfPath,
  repairPdfUpload,
  revealPath,
  rotatePdfPath,
  rotatePdfUpload,
  signatureReportPath,
  signatureReportUpload,
  splitPdfPath,
  splitPdfUpload,
  saveRecentFiles,
  watermarkImagePath,
  watermarkImageUpload,
  watermarkTextPath,
  watermarkTextUpload,
} from "./api";

const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
const settingsKey = "nodoc-ui-preferences";
const historyKey = "nodoc-job-history";
const recentFilesKey = "nodoc-recent-files";
const outputFolderKey = "nodoc-output-folder";

const groups = [
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
      { id: "redact", icon: "redact", title: "Redact", detail: "True content removal", needs: "Complex", status: "planned" },
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
      { id: "repair", icon: "repair", title: "Repair", detail: "Rewrite a clean PDF copy", needs: "1 PDF", status: "ready" },
      { id: "compare", icon: "compare", title: "Compare", detail: "Visual or text diff", needs: "Later", status: "planned" },
      { id: "pdfa", icon: "archive", title: "PDF/A", detail: "Archive validation", needs: "Complex", status: "planned" },
    ],
  },
];

const readyToolIds = new Set(groups.flatMap((group) => group.tools.filter((tool) => tool.status === "ready").map((tool) => tool.id)));
const quickWatermarkAngles = [0, 90, 180, 270];
const asyncToolIds = new Set(["merge", "images", "split", "render", "extract", "delete", "rotate", "reorder", "reverse", "duplicate", "password", "repair", "watermark", "page_numbers"]);

function Icon({ name }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.8,
  };
  const shapes = {
    merge: <><path d="M5 4h7l4 4v12H5z" /><path d="M12 4v5h5" /><path d="M8 13h8" /><path d="M8 16h8" /></>,
    split: <><path d="M4 5h6v14H4z" /><path d="M14 5h6v14h-6z" /><path d="M12 8v8" /></>,
    extract: <><path d="M6 4h9l3 3v13H6z" /><path d="M15 4v4h4" /><path d="M10 13h6" /><path d="M13 10v6" /></>,
    trash: <><path d="M5 7h14" /><path d="M9 7V5h6v2" /><path d="M8 10l1 9h6l1-9" /></>,
    rotate: <><path d="M17 8a6 6 0 1 0 1 6" /><path d="M17 4v4h-4" /></>,
    reorder: <><path d="M7 6h11" /><path d="M7 12h11" /><path d="M7 18h11" /><path d="M4 6h.01" /><path d="M4 12h.01" /><path d="M4 18h.01" /></>,
    batch: <><path d="M7 7h10v12H7z" /><path d="M4 4h10" /><path d="M4 4v12" /></>,
    image: <><path d="M4 5h16v14H4z" /><path d="M8 14l3-3 3 3 2-2 3 4" /><circle cx="9" cy="9" r="1" /></>,
    pdf: <><path d="M6 4h8l4 4v12H6z" /><path d="M14 4v5h5" /><path d="M8 15h8" /><path d="M8 12h4" /></>,
    text: <><path d="M5 6h14" /><path d="M12 6v12" /><path d="M9 18h6" /></>,
    word: <><path d="M4 6h16v12H4z" /><path d="M7 9l1.5 6L11 9l2.5 6L15 9" /></>,
    sheet: <><path d="M4 5h16v14H4z" /><path d="M4 10h16" /><path d="M4 15h16" /><path d="M10 5v14" /></>,
    stamp: <><path d="M9 4h6l1 7H8z" /><path d="M6 15h12v5H6z" /><path d="M8 15v-2h8v2" /></>,
    draw: <><path d="M4 18c4-7 8-7 16-2" /><path d="M14 4l6 6" /><path d="M13 5l-5 9 9-5" /></>,
    highlight: <><path d="M5 17h14" /><path d="M8 14l7-9 4 3-7 9z" /></>,
    sign: <><path d="M4 17c3-6 5 3 8-2 2-4 3 1 8-1" /><path d="M16 4l4 4" /><path d="M15 5l-4 7" /></>,
    redact: <><path d="M5 7h14" /><path d="M5 12h14" /><path d="M5 17h14" /><path d="M7 10h10v4H7z" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    shield: <><path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /></>,
    key: <><circle cx="8" cy="15" r="3" /><path d="M11 15h9" /><path d="M17 15v-3" /><path d="M14 15v-2" /></>,
    scan: <><path d="M4 8V5h3" /><path d="M17 5h3v3" /><path d="M20 16v3h-3" /><path d="M7 19H4v-3" /><path d="M7 12h10" /></>,
    search: <><circle cx="10" cy="10" r="5" /><path d="M14 14l5 5" /></>,
    tag: <><path d="M4 12V5h7l9 9-7 7z" /><circle cx="8" cy="8" r="1" /></>,
    repair: <><path d="M14 5l5 5-9 9H5v-5z" /><path d="M12 7l5 5" /></>,
    compare: <><path d="M5 5h7v14H5z" /><path d="M12 8h7v11h-7" /></>,
    archive: <><path d="M5 7h14v13H5z" /><path d="M4 4h16v3H4z" /><path d="M10 11h4" /></>,
    folder: <><path d="M3.5 7.5h6l2 2h9v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /><path d="M3.5 7.5v-1a2 2 0 0 1 2-2h3l2 2h8a2 2 0 0 1 2 2v1" /></>,
    openExternal: <><path d="M14 5h5v5" /><path d="M10 14 19 5" /><path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" /></>,
    upload: <><path d="M12 17V5" /><path d="M7 10l5-5 5 5" /><path d="M5 19h14" /></>,
    download: <><path d="M12 5v12" /><path d="M7 12l5 5 5-5" /><path d="M5 19h14" /></>,
    close: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
    reload: <><path d="M19 8a7 7 0 1 0 1 6" /><path d="M19 4v4h-4" /></>,
    check: <><path d="M5 12l4 4L19 6" /></>,
    copy: <><path d="M8 8h10v11H8z" /><path d="M6 5h10v3" /></>,
    settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7z" /><path d="M19 12l2-1-1-3-2 .2-.9-1.6 1.2-1.7-2.2-2.2-1.7 1.2-1.6-.9.2-2-3-1-1 2h-1.8l-1-2-3 1 .2 2-1.6.9-1.7-1.2-2.2 2.2 1.2 1.7-.9 1.6-2-.2-1 3 2 1v1.8l-2 1 1 3 2-.2.9 1.6-1.2 1.7 2.2 2.2 1.7-1.2 1.6.9-.2 2 3 1 1-2h1.8l1 2 3-1-.2-2 1.6-.9 1.7 1.2 2.2-2.2-1.2-1.7.9-1.6 2 .2 1-3-2-1z" /></>,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    history: <><path d="M12 7v5l3 2" /><path d="M5 12a7 7 0 1 0 2-4.9" /><path d="M5 4v4h4" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>
      {shapes[name] || shapes.pdf}
    </svg>
  );
}

function hasExtension(fileName, extensions) {
  const lower = fileName.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

function pathName(path) {
  return path.split(/[\\/]/).pop() || path;
}

function outputPathsFromResult(result) {
  if (result.output_path) {
    return [result.output_path];
  }
  return result.output_paths || [];
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const onResolve = () => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    const timeoutId = window.setTimeout(onResolve, ms);
    const onAbort = () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };

    if (!signal) {
      return;
    }

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function pagesToRange(pages) {
  return [...pages].sort((a, b) => a - b).join(",");
}

function pageActionClass(toolId, selected, rotationApplies) {
  if (toolId === "delete" && selected) {
    return "will-delete";
  }
  if (toolId === "extract" && selected) {
    return "will-extract";
  }
  if (toolId === "rotate" && rotationApplies) {
    return "will-rotate";
  }
  if (toolId === "reorder") {
    return "will-reorder";
  }
  if (selected) {
    return "is-selected";
  }
  return "";
}

function uploadItems(files) {
  return Array.from(files).map((file) => ({ source: "upload", file, name: file.name }));
}

function pathItems(paths) {
  return paths.map((path) => ({ source: "path", path, name: pathName(path) }));
}

function pathFolder(path) {
  const normalized = String(path || "").replace(/\//g, "\\");
  const lastSeparator = normalized.lastIndexOf("\\");
  return lastSeparator >= 0 ? normalized.slice(0, lastSeparator) : normalized;
}

function transferHasFiles(dataTransfer) {
  if (!dataTransfer) {
    return false;
  }
  const items = Array.from(dataTransfer.items || []);
  if (items.length) {
    return items.some((item) => item.kind === "file");
  }
  return Array.from(dataTransfer.files || []).length > 0;
}

function transferHasInternalPageDrag(dataTransfer) {
  if (!dataTransfer) {
    return false;
  }
  return Array.from(dataTransfer.types || []).includes("application/x-nodoc-page");
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function readStoredList(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "[]");
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function normalizeAngle(angle) {
  const value = angle % 360;
  return value < 0 ? value + 360 : value;
}

function LazyThumbImage({ previewSessionId, pageNumber, fallbackImage, altText, rootRef }) {
  const thumbRef = useRef(null);
  const [image, setImage] = useState(fallbackImage || "");

  useEffect(() => {
    setImage(fallbackImage || "");
  }, [fallbackImage, pageNumber]);

  useEffect(() => {
    if (!previewSessionId || image) {
      return undefined;
    }

    let mounted = true;
    void previewPdfPage(previewSessionId, pageNumber, { scale: 0.55 })
      .then((response) => {
        if (mounted) {
          setImage(response.page.image || "");
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [image, pageNumber, previewSessionId]);

  return <img ref={thumbRef} src={image || "about:blank"} alt={altText} draggable="false" style={{ visibility: image ? "visible" : "hidden" }} />;
}

export default function App() {
  const [fileItems, setFileItems] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dropOverlayActive, setDropOverlayActive] = useState(false);
  const [activeGroup, setActiveGroup] = useState("convert");
  const [activeTool, setActiveTool] = useState("render");
  const [selectedPages, setSelectedPages] = useState([]);
  const [pagePreview, setPagePreview] = useState([]);
  const [rotation, setRotation] = useState(90);
  const [rotateScope, setRotateScope] = useState("selected");
  const [password, setPassword] = useState("");
  const [watermarkText, setWatermarkText] = useState("NoDoc");
  const [watermarkMode, setWatermarkMode] = useState("text");
  const [watermarkPreset, setWatermarkPreset] = useState("verified");
  const [watermarkScope, setWatermarkScope] = useState("selected");
  const [watermarkPosition, setWatermarkPosition] = useState("center");
  const [watermarkAngle, setWatermarkAngle] = useState(-45);
  const [watermarkSize, setWatermarkSize] = useState(48);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.22);
  const [watermarkColor, setWatermarkColor] = useState("#b02730");
  const [watermarkImageFile, setWatermarkImageFile] = useState(null);
  const [watermarkImagePreview, setWatermarkImagePreview] = useState("");
  const [signatureReport, setSignatureReport] = useState(null);
  const [signatureBusy, setSignatureBusy] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [result, setResult] = useState(null);
  const [busyLabel, setBusyLabel] = useState("");
  const [busyProgress, setBusyProgress] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewSessionId, setPreviewSessionId] = useState("");
  const [pageDragMode, setPageDragMode] = useState(null);
  const [reorderDragPage, setReorderDragPage] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [jobHistory, setJobHistory] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  const [outputFolder, setOutputFolder] = useState("");
  const [previewTick, setPreviewTick] = useState(0);
  const [previewViewport, setPreviewViewport] = useState({ height: 0, width: 0, scrollTop: 0 });
  const fileInputRef = useRef(null);
  const watermarkImageInputRef = useRef(null);
  const dragDepthRef = useRef(0);
  const internalDragRef = useRef(false);
  const watermarkDialRef = useRef(null);
  const watermarkDialDragRef = useRef(false);
  const previewScrollRef = useRef(null);
  const previewAbortRef = useRef(null);
  const signatureAbortRef = useRef(null);
  const actionAbortRef = useRef(null);

  const activeTools = groups.find((group) => group.id === activeGroup)?.tools || [];
  const activeToolInfo = groups.flatMap((group) => group.tools).find((tool) => tool.id === activeTool);
  const fileNames = fileItems.map((item) => item.name);
  const uploadedFiles = fileItems.filter((item) => item.source === "upload").map((item) => item.file);
  const pathInputs = fileItems.filter((item) => item.source === "path").map((item) => item.path);
  const hasUploads = uploadedFiles.length > 0;
  const hasPaths = pathInputs.length > 0;
  const mixedSources = hasUploads && hasPaths;
  const sourceMode = hasPaths ? "open-with" : "selected";
  const pdfItems = fileItems.filter((item) => item.name.toLowerCase().endsWith(".pdf"));
  const imageItems = fileItems.filter((item) => hasExtension(item.name, imageExtensions));
  const allSelectedArePdfs = fileItems.length > 0 && pdfItems.length === fileItems.length;
  const allSelectedAreImages = fileItems.length > 0 && imageItems.length === fileItems.length;
  const exactlyOnePdfSelected = fileItems.length === 1 && pdfItems.length === 1;
  const previewSourceKey = fileItems.map((item) => item.source === "path" ? `p:${item.path}` : `u:${item.name}:${item.file.size}:${item.file.lastModified}`).join("|");
  const resultPaths = result?.paths || [];
  const previewPage = pagePreview[0];
  const previewPageNumber = previewPage?.page || 1;
  const previewPageLabel = previewPage
    ? `${Math.round(previewPage.width)} x ${Math.round(previewPage.height)} pt`
    : "Page preview";
  const previewPaperStyle = previewPage
    ? {
        aspectRatio: `${Math.max(1, previewPage.width)} / ${Math.max(1, previewPage.height)}`,
        maxHeight: "min(34vh, 280px)",
      }
    : undefined;
  const pageGridItemHeight = 208;
  const pageGridGap = 14;
  const pageGridMinWidth = 132;
  const pageGridColumns = previewViewport.width
    ? Math.max(1, Math.floor((previewViewport.width + pageGridGap) / (pageGridMinWidth + pageGridGap)))
    : 1;
  const pageGridRowCount = Math.ceil(pagePreview.length / pageGridColumns);
  const visibleStartRow = previewViewport.height
    ? Math.max(0, Math.floor(previewViewport.scrollTop / pageGridItemHeight) - 2)
    : 0;
  const visibleEndRow = previewViewport.height
    ? Math.min(pageGridRowCount, Math.ceil((previewViewport.scrollTop + previewViewport.height) / pageGridItemHeight) + 2)
    : pageGridRowCount;
  const visibleStartIndex = visibleStartRow * pageGridColumns;
  const visibleEndIndex = Math.min(pagePreview.length, visibleEndRow * pageGridColumns);
  const visiblePages = pagePreview.slice(visibleStartIndex, visibleEndIndex);
  const topSpacerHeight = visibleStartRow * pageGridItemHeight;
  const bottomSpacerHeight = Math.max(0, (pageGridRowCount - visibleEndRow) * pageGridItemHeight);
  const watermarkPlacementStyle = watermarkPosition === "top-left"
    ? { left: "24%", top: "22%" }
    : watermarkPosition === "top-right"
      ? { left: "76%", top: "22%" }
      : watermarkPosition === "bottom-left"
        ? { left: "24%", top: "78%" }
        : watermarkPosition === "bottom-right"
          ? { left: "76%", top: "78%" }
          : { left: "50%", top: "50%" };
  const isBusy = Boolean(busyLabel);
  const showCancelAction = isBusy || previewBusy;
  const pageToolActive = ["extract", "delete", "rotate", "watermark", "duplicate"].includes(activeTool);
  const reorderActive = activeTool === "reorder";
  const watermarkAllPages = activeTool === "watermark" && watermarkScope === "all";
  const reorderChanged = pagePreview.length > 0 && pagePreview.some((page, index) => page.page !== index + 1);
  const rotateAppliesToAll = activeTool === "rotate" && rotateScope === "all";
  const pageSelectionLocked = rotateAppliesToAll || watermarkAllPages;
  const selectionLabel = pageToolActive && pagePreview.length
    ? pageSelectionLocked
      ? `${pagePreview.length}/${pagePreview.length} selected`
      : `${selectedPages.length}/${pagePreview.length} selected`
    : "";
  const actionLabel = isBusy
    ? busyLabel
    : resultPaths.length
      ? `Ready ${resultPaths.length === 1 ? "file" : "files"} to download`
      : reorderActive && reorderChanged
        ? "Order changed"
        : "Ready";

  useEffect(() => {
    function loadOpenedFiles() {
      const openedPaths = window.__NODOC_OPEN_FILES__ || [];
      if (openedPaths.length) {
        const nextItems = pathItems(openedPaths);
        setFileItems(nextItems);
        setResult(null);
        rememberRecentFiles(nextItems.map((item) => item.name));
        setStatus(`Opened ${openedPaths.length} file${openedPaths.length === 1 ? "" : "s"} from Windows`);
      }
    }

    loadOpenedFiles();
    window.addEventListener("nodoc-ready", loadOpenedFiles);
    return () => window.removeEventListener("nodoc-ready", loadOpenedFiles);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    previewAbortRef.current?.abort();
    setSelectedPages([]);
    setPagePreview([]);
    setPreviewSessionId("");

    async function loadPreview() {
      if (!exactlyOnePdfSelected || mixedSources) {
        setPreviewBusy(false);
        return;
      }
      const controller = new AbortController();
      previewAbortRef.current = controller;
      setPreviewBusy(true);
      try {
        const response = hasPaths
          ? await previewPdfManifestPath(pathInputs, { signal: controller.signal })
          : await previewPdfManifestUpload(uploadedFiles, { signal: controller.signal });
        if (isCurrent) {
          setPagePreview(response.pages);
          setPreviewSessionId(response.preview_id || "");
          setStatus(`Loaded ${response.pages.length} page preview${response.pages.length === 1 ? "" : "s"}`);
        }
      } catch (err) {
        if (err.name === "AbortError") {
          if (isCurrent) {
            setStatus("Preview cancelled");
          }
          return;
        }
        if (isCurrent) {
          setStatus(`Preview error: ${err.message}`);
        }
      } finally {
        if (isCurrent) {
          setPreviewBusy(false);
        }
        if (previewAbortRef.current === controller) {
          previewAbortRef.current = null;
        }
      }
    }

    loadPreview();
    return () => {
      isCurrent = false;
      previewAbortRef.current?.abort();
    };
  }, [exactlyOnePdfSelected, hasPaths, mixedSources, previewTick, previewSourceKey]);

  useEffect(() => {
    const viewport = previewScrollRef.current;
    if (!viewport) {
      return undefined;
    }

    const updateViewport = () => {
      setPreviewViewport({
        height: viewport.clientHeight,
        width: viewport.clientWidth,
        scrollTop: viewport.scrollTop,
      });
    };

    updateViewport();
    viewport.addEventListener("scroll", updateViewport, { passive: true });
    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(viewport);
    return () => {
      viewport.removeEventListener("scroll", updateViewport);
      resizeObserver.disconnect();
    };
  }, [exactlyOnePdfSelected, pagePreview.length, activeTool]);

  useEffect(() => {
    if (previewScrollRef.current) {
      previewScrollRef.current.scrollTop = 0;
    }
  }, [activeTool, pagePreview.length, previewBusy]);

  useEffect(() => {
    let isCurrent = true;
    signatureAbortRef.current?.abort();
    setSignatureReport(null);
    setSignatureBusy(false);

    if (activeTool !== "digital_sign" || !exactlyOnePdfSelected || mixedSources) {
      return () => {};
    }

    const controller = new AbortController();
    signatureAbortRef.current = controller;
    setSignatureBusy(true);

    async function loadSignatureReport() {
      try {
        const response = hasPaths
          ? await signatureReportPath(pathInputs, { signal: controller.signal })
          : await signatureReportUpload(uploadedFiles, { signal: controller.signal });
        if (isCurrent) {
          setSignatureReport(response);
          setStatus(
            response.signature_count
              ? response.document_signed
                ? `Found ${response.signature_count} signature${response.signature_count === 1 ? "" : "s"}`
                : `Found ${response.signature_count} signature field${response.signature_count === 1 ? "" : "s"}`
              : "No signature fields found"
          );
        }
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        if (isCurrent) {
          setStatus(`Signature check error: ${err.message}`);
        }
      } finally {
        if (isCurrent) {
          setSignatureBusy(false);
        }
        if (signatureAbortRef.current === controller) {
          signatureAbortRef.current = null;
        }
      }
    }

    loadSignatureReport();
    return () => {
      isCurrent = false;
      signatureAbortRef.current?.abort();
    };
  }, [activeTool, exactlyOnePdfSelected, hasPaths, mixedSources, previewSourceKey]);

  useEffect(() => {
    if (!watermarkImageFile) {
      setWatermarkImagePreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(watermarkImageFile);
    setWatermarkImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [watermarkImageFile]);

  useEffect(() => {
    if (pageDragMode === null) {
      return;
    }

    function stopDragSelection() {
      setPageDragMode(null);
    }

    window.addEventListener("pointerup", stopDragSelection);
    window.addEventListener("pointercancel", stopDragSelection);
    return () => {
      window.removeEventListener("pointerup", stopDragSelection);
      window.removeEventListener("pointercancel", stopDragSelection);
    };
  }, [pageDragMode]);

  useEffect(() => {
    function handlePointerMove(event) {
      if (!watermarkDialDragRef.current) {
        return;
      }
      setWatermarkAngleFromPoint(event.clientX, event.clientY);
    }

    function stopWatermarkDial() {
      watermarkDialDragRef.current = false;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopWatermarkDial);
    window.addEventListener("pointercancel", stopWatermarkDial);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopWatermarkDial);
      window.removeEventListener("pointercancel", stopWatermarkDial);
    };
  }, []);

  useEffect(() => {
    function handleWindowDragEnter(event) {
      if (internalDragRef.current || transferHasInternalPageDrag(event.dataTransfer)) {
        event.preventDefault();
        return;
      }
      if (!transferHasFiles(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      dragDepthRef.current += 1;
      setDropOverlayActive(true);
    }

    function handleWindowDragOver(event) {
      if (internalDragRef.current || transferHasInternalPageDrag(event.dataTransfer)) {
        event.preventDefault();
        return;
      }
      if (!transferHasFiles(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      setDropOverlayActive(true);
    }

    function handleWindowDragLeave(event) {
      if (internalDragRef.current || transferHasInternalPageDrag(event.dataTransfer)) {
        event.preventDefault();
        return;
      }
      if (!transferHasFiles(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setDropOverlayActive(false);
      }
    }

    function handleWindowDrop(event) {
      if (internalDragRef.current || transferHasInternalPageDrag(event.dataTransfer)) {
        event.preventDefault();
        internalDragRef.current = false;
        dragDepthRef.current = 0;
        setDropOverlayActive(false);
        return;
      }
      if (!transferHasFiles(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      dragDepthRef.current = 0;
      setDropOverlayActive(false);
      setIsDragging(false);
      if (event.dataTransfer.files?.length) {
        updateFiles(event.dataTransfer.files);
      }
    }

    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("drop", handleWindowDrop);
    return () => {
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, []);

  useEffect(() => {
    const savedPreferences = window.localStorage.getItem(settingsKey);
    if (savedPreferences) {
      try {
        const preferences = JSON.parse(savedPreferences);
        if (preferences.activeGroup && groups.some((group) => group.id === preferences.activeGroup)) {
          setActiveGroup(preferences.activeGroup);
          const savedGroup = groups.find((group) => group.id === preferences.activeGroup);
          const savedTool = savedGroup?.tools.find((tool) => tool.id === preferences.activeTool);
          const fallbackTool = savedGroup?.tools.find((tool) => tool.status === "ready")?.id || savedGroup?.tools[0]?.id || "render";
          setActiveTool(savedTool?.id || fallbackTool);
        }
        if ([0, 90, 180, 270].includes(preferences.rotation)) {
          setRotation(preferences.rotation);
        }
        if (["selected", "all"].includes(preferences.rotateScope)) {
          setRotateScope(preferences.rotateScope);
        }
        if (["selected", "all"].includes(preferences.watermarkScope)) {
          setWatermarkScope(preferences.watermarkScope);
        }
        if (["text", "badge", "image"].includes(preferences.watermarkMode)) {
          setWatermarkMode(preferences.watermarkMode);
        }
        if (["verified", "question"].includes(preferences.watermarkPreset)) {
          setWatermarkPreset(preferences.watermarkPreset);
        }
        if (["center", "top-left", "top-right", "bottom-left", "bottom-right"].includes(preferences.watermarkPosition)) {
          setWatermarkPosition(preferences.watermarkPosition);
        }
        if (typeof preferences.watermarkAngle === "number") {
          setWatermarkAngle(preferences.watermarkAngle);
        }
        if (typeof preferences.watermarkSize === "number") {
          setWatermarkSize(preferences.watermarkSize);
        }
        if (typeof preferences.watermarkOpacity === "number") {
          setWatermarkOpacity(preferences.watermarkOpacity);
        }
        if (typeof preferences.watermarkColor === "string") {
          setWatermarkColor(preferences.watermarkColor);
        }
      } catch {
        window.localStorage.removeItem(settingsKey);
      }
    }

    setOutputFolder(window.localStorage.getItem(outputFolderKey) || "");
  }, []);

  useEffect(() => {
    async function loadPersistentState() {
      if (!canUseDesktopBridge()) {
        setJobHistory(readStoredList(historyKey));
        setRecentFiles(readStoredList(recentFilesKey));
        return;
      }

      try {
        const [historyResponse, recentResponse] = await Promise.all([getJobHistory(), getRecentFiles()]);
        setJobHistory((historyResponse.items || []).map((item) => ({
          id: item.id,
          createdAt: Date.parse(item.created_at) || Date.now(),
          tool: groups.flatMap((group) => group.tools).find((tool) => tool.id === item.kind)?.title || item.kind,
          paths: item.output_path ? [item.output_path] : [],
          outputs: item.output_path ? [pathName(item.output_path)] : [],
          count: item.output_path ? 1 : 0,
        })));
        setRecentFiles(recentResponse.names || []);
      } catch {
        setJobHistory(readStoredList(historyKey));
        setRecentFiles(readStoredList(recentFilesKey));
      }
    }

    void loadPersistentState();

    function handleReady() {
      void loadPersistentState();
    }

    window.addEventListener("nodoc-ready", handleReady);
    return () => {
      window.removeEventListener("nodoc-ready", handleReady);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      settingsKey,
      JSON.stringify({
        activeGroup,
        activeTool,
        rotation,
        rotateScope,
        watermarkScope,
        watermarkMode,
        watermarkPreset,
        watermarkPosition,
        watermarkAngle,
        watermarkSize,
        watermarkOpacity,
        watermarkColor,
      })
    );
  }, [activeGroup, activeTool, rotation, rotateScope, watermarkScope, watermarkMode, watermarkPreset, watermarkPosition, watermarkAngle, watermarkSize, watermarkOpacity, watermarkColor]);

  useEffect(() => {
    window.localStorage.setItem(historyKey, JSON.stringify(jobHistory));
  }, [jobHistory]);

  useEffect(() => {
    window.localStorage.setItem(recentFilesKey, JSON.stringify(recentFiles));
  }, [recentFiles]);

  useEffect(() => {
    if (outputFolder) {
      window.localStorage.setItem(outputFolderKey, outputFolder);
      return;
    }
    window.localStorage.removeItem(outputFolderKey);
  }, [outputFolder]);

  useEffect(() => {
    function handleMenuOpen() {
      void openFiles();
    }

    function handleMenuClear() {
      clearFiles();
    }

    function handleMenuOutputFolder() {
      void chooseOutputFolder();
    }

    function handleMenuCancel() {
      cancelCurrentWork();
    }

    function handleMenuSettings() {
      setShowSettings(true);
    }

    function handleMenuAbout() {
      setStatus("NoDoc is a local-first desktop PDF workspace.");
      setShowSettings(true);
    }

    window.addEventListener("nodoc-open-files", handleMenuOpen);
    window.addEventListener("nodoc-choose-output-folder", handleMenuOutputFolder);
    window.addEventListener("nodoc-clear-files", handleMenuClear);
    window.addEventListener("nodoc-cancel-task", handleMenuCancel);
    window.addEventListener("nodoc-open-settings", handleMenuSettings);
    window.addEventListener("nodoc-about", handleMenuAbout);
    return () => {
      window.removeEventListener("nodoc-open-files", handleMenuOpen);
      window.removeEventListener("nodoc-choose-output-folder", handleMenuOutputFolder);
      window.removeEventListener("nodoc-clear-files", handleMenuClear);
      window.removeEventListener("nodoc-cancel-task", handleMenuCancel);
      window.removeEventListener("nodoc-open-settings", handleMenuSettings);
      window.removeEventListener("nodoc-about", handleMenuAbout);
    };
  }, []);

  function rememberRecentFiles(names) {
    if (!names.length) {
      return;
    }
    setRecentFiles((current) => {
      const merged = [...names, ...current].filter(Boolean);
      const next = [...new Set(merged)].slice(0, 10);
      if (canUseDesktopBridge()) {
        void saveRecentFiles(next).catch(() => {});
      } else {
        window.localStorage.setItem(recentFilesKey, JSON.stringify(next));
      }
      return next;
    });
  }

  function pushHistoryEntry(toolId, paths) {
    const toolTitle = groups.flatMap((group) => group.tools).find((tool) => tool.id === toolId)?.title || toolId;
    const entry = {
      id: `${Date.now()}-${toolId}`,
      createdAt: Date.now(),
      tool: toolTitle,
      paths,
      outputs: paths.map((path) => pathName(path)),
      count: paths.length,
    };
    setJobHistory((current) => {
      const next = [entry, ...current].slice(0, 12);
      if (!canUseDesktopBridge()) {
        window.localStorage.setItem(historyKey, JSON.stringify(next));
      }
      return next;
    });
  }

  function loadPathItems(paths, statusMessage) {
    const cleanPaths = (paths || []).filter(Boolean);
    if (!cleanPaths.length) {
      setStatus("No files available for that action.");
      return;
    }
    const nextItems = pathItems(cleanPaths);
    setFileItems(nextItems);
    setResult(null);
    setSelectedPages([]);
    setPagePreview([]);
    setPreviewSessionId("");
    setSignatureReport(null);
    setSignatureBusy(false);
    setReorderDragPage(null);
    setPreviewTick((value) => value + 1);
    rememberRecentFiles(nextItems.map((item) => item.name));
    setStatus(statusMessage || `Loaded ${nextItems.length} file${nextItems.length === 1 ? "" : "s"}`);
  }

  function updateFiles(files) {
    const nextItems = uploadItems(files);
    setFileItems(nextItems);
    setResult(null);
    rememberRecentFiles(nextItems.map((item) => item.name));
    setStatus("Files loaded");
  }

  async function openFiles() {
    if (isBusy) {
      return;
    }

    if (canUseDesktopBridge()) {
      try {
        const paths = await pickFilesDialog();
        if (!paths?.length) {
          return;
        }
        const nextItems = pathItems(paths);
        setFileItems(nextItems);
        setResult(null);
        rememberRecentFiles(nextItems.map((item) => item.name));
        setStatus(`Opened ${nextItems.length} file${nextItems.length === 1 ? "" : "s"}`);
        return;
      } catch (err) {
        setStatus(`Desktop picker error: ${err.message}`);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  function removeFileAt(indexToRemove) {
    setFileItems((current) => current.filter((_, index) => index !== indexToRemove));
    setResult(null);
    setStatus("File removed");
  }

  function clearFiles() {
    previewAbortRef.current?.abort();
    signatureAbortRef.current?.abort();
    actionAbortRef.current?.abort();
    setFileItems([]);
    setResult(null);
    setSelectedPages([]);
    setPagePreview([]);
    setPreviewSessionId("");
    setSignatureReport(null);
    setSignatureBusy(false);
    setBusyLabel("");
    setPreviewBusy(false);
    setReorderDragPage(null);
    setStatus("Workspace cleared");
  }

  async function handleRevealPath(path) {
    if (!path) {
      setStatus("No path available to reveal.");
      return;
    }
    if (!canUseDesktopBridge()) {
      setStatus("Reveal in folder works in the desktop app.");
      return;
    }
    await withBusy("Opening folder...", async () => {
      try {
        await revealPath(path);
        setStatus("Opened containing folder");
      } catch (err) {
        setStatus(`Folder open error: ${err.message}`);
      }
    });
  }

  function reloadPreview() {
    if (!exactlyOnePdfSelected) {
      setStatus("Select exactly one PDF to reload the preview.");
      return;
    }
    setPreviewTick((value) => value + 1);
  }

  function chooseGroup(groupId) {
    const group = groups.find((item) => item.id === groupId);
    setActiveGroup(groupId);
    const firstReady = group?.tools.find((tool) => tool.status === "ready");
    setActiveTool(firstReady?.id || group?.tools[0]?.id || "render");
  }

  function chooseTool(tool) {
    setActiveTool(tool.id);
    if (tool.id !== "rotate") {
      setRotateScope("selected");
    }
    if (tool.id !== "watermark") {
      setWatermarkScope("selected");
    }
    if (tool.id !== "digital_sign") {
      setSignatureReport(null);
    }
    if (!["extract", "delete", "rotate", "watermark", "duplicate", "page_numbers"].includes(tool.id)) {
      setSelectedPages([]);
    }
    if (tool.status !== "ready") {
      setStatus(`${tool.title} is planned for a later build.`);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    setDropOverlayActive(false);
    dragDepthRef.current = 0;
    updateFiles(event.dataTransfer.files);
  }

  function togglePage(pageNumber) {
    setSelectedPages((current) =>
      current.includes(pageNumber)
        ? current.filter((page) => page !== pageNumber)
        : [...current, pageNumber].sort((a, b) => a - b)
    );
  }

  function selectAllPages() {
    setSelectedPages(pagePreview.map((page) => page.page));
  }

  function clearPages() {
    setSelectedPages([]);
  }

  function setPageSelection(pageNumber, shouldSelect) {
    setSelectedPages((current) => {
      const exists = current.includes(pageNumber);
      if (shouldSelect && !exists) {
        return [...current, pageNumber].sort((a, b) => a - b);
      }
      if (!shouldSelect && exists) {
        return current.filter((page) => page !== pageNumber);
      }
      return current;
    });
  }

  function beginPageDragSelection(pageNumber, event) {
    if (!pageToolActive || rotateAppliesToAll || reorderActive || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const shouldSelect = !selectedPages.includes(pageNumber);
    setPageDragMode(shouldSelect);
    setPageSelection(pageNumber, shouldSelect);
  }

  function continuePageDragSelection(pageNumber, event) {
    if (reorderActive || pageDragMode === null || event.buttons !== 1) {
      return;
    }
    setPageSelection(pageNumber, pageDragMode);
  }

  function endPageDragSelection() {
    setPageDragMode(null);
  }

  function movePreviewPage(fromPage, toPage) {
    if (fromPage === toPage) {
      return;
    }
    setPagePreview((current) => {
      const fromIndex = current.findIndex((page) => page.page === fromPage);
      const toIndex = current.findIndex((page) => page.page === toPage);
      if (fromIndex < 0 || toIndex < 0) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setResult(null);
    setStatus("Page order changed");
  }

  function resetPageOrder() {
    setPagePreview((current) => [...current].sort((a, b) => a.page - b.page));
    setReorderDragPage(null);
    setResult(null);
    setStatus("Page order reset");
  }

  function setWatermarkAngleFromPoint(clientX, clientY) {
    const dial = watermarkDialRef.current;
    if (!dial) {
      return;
    }
    const rect = dial.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawAngle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
    setWatermarkAngle(normalizeAngle(rawAngle + 90));
  }

  function beginWatermarkDial(event) {
    if (isBusy) {
      return;
    }
    event.preventDefault();
    watermarkDialDragRef.current = true;
    setWatermarkAngleFromPoint(event.clientX, event.clientY);
  }

  function updateWatermarkImage(files) {
    const [file] = Array.from(files || []);
    if (!file) {
      return;
    }
    if (!hasExtension(file.name, imageExtensions)) {
      setStatus("Choose a PNG, JPG, WEBP, or BMP watermark image.");
      return;
    }
    setWatermarkImageFile(file);
    setWatermarkMode("image");
  }

  function assertReady() {
    if (!readyToolIds.has(activeTool)) {
      return `${activeToolInfo?.title || "This tool"} is planned for later.`;
    }
    if (mixedSources) {
      return "Use one file source for each action.";
    }
    if (activeTool === "merge" && (!allSelectedArePdfs || fileItems.length < 2)) {
      return "Select two or more PDF files.";
    }
    if (activeTool === "images" && !allSelectedAreImages) {
      return "Select one or more image files.";
    }
    if (["split", "render", "extract", "delete", "rotate", "reorder", "password", "repair", "watermark", "digital_sign", "page_numbers"].includes(activeTool) && !exactlyOnePdfSelected) {
      return "Select exactly one PDF file.";
    }
    if (["extract", "delete", "duplicate"].includes(activeTool) && selectedPages.length === 0) {
      return "Pick pages from the preview.";
    }
    if (activeTool === "rotate" && rotateScope === "selected" && selectedPages.length === 0) {
      return "Pick pages to rotate or switch to All pages.";
    }
    if (activeTool === "reorder" && !reorderChanged) {
      return "Drag pages into a new order first.";
    }
    if (activeTool === "password" && !password.trim()) {
      return "Enter a password for the protected PDF.";
    }
    if (activeTool === "watermark" && watermarkScope === "selected" && selectedPages.length === 0) {
      return "Pick pages to watermark or switch to All pages.";
    }
    if (activeTool === "watermark" && watermarkMode === "text" && !watermarkText.trim()) {
      return "Enter watermark text.";
    }
    if (activeTool === "watermark" && watermarkMode === "image" && !watermarkImageFile) {
      return "Choose a watermark image.";
    }
    return "";
  }

  function cancelCurrentWork() {
    previewAbortRef.current?.abort();
    actionAbortRef.current?.abort();
    setBusyLabel("");
    setBusyProgress(null);
    setPreviewBusy(false);
    setPageDragMode(null);
    setReorderDragPage(null);
    setStatus("Current task cancelled");
  }

  async function withBusy(label, task) {
    const controller = new AbortController();
    actionAbortRef.current = controller;
    setBusyLabel(label);
    setBusyProgress(null);
    setStatus(label);
    try {
      await task(controller.signal);
    } finally {
      if (actionAbortRef.current === controller) {
        actionAbortRef.current = null;
      }
      setBusyLabel("");
      setBusyProgress(null);
    }
  }

  async function waitForJob(jobId, signal) {
    for (;;) {
      const job = await getJobStatus(jobId, { signal });
      const progressValue = Number.isFinite(job.progress) ? Math.max(0, Math.min(100, job.progress)) : null;
      const message = job.message || "Processing...";
      const progressText = progressValue === null ? message : `${message} ${progressValue}%`;

      setBusyLabel(progressText);
      setBusyProgress(progressValue);
      setStatus(progressText);

      if (job.status === "done") {
        return job.result || {};
      }
      if (job.status === "error") {
        throw new Error(job.error || "Background job failed");
      }

      await sleep(450, signal);
    }
  }

  async function handleHealthCheck() {
    await withBusy("Checking local engine...", async () => {
      try {
        const response = await checkHealth();
        setStatus(`Engine OK: ${response.status}`);
      } catch (err) {
        setStatus(`Engine error: ${err.message}`);
      }
    });
  }

  async function chooseOutputFolder() {
    if (!canUseDesktopBridge()) {
      setStatus("Output folder picker is available in the desktop app.");
      return;
    }

    try {
      const folder = await pickFolderDialog();
      if (!folder) {
        setStatus("Output folder unchanged");
        return;
      }
      setOutputFolder(folder);
      setStatus("Output folder saved");
    } catch (err) {
      setStatus(`Output folder error: ${err.message}`);
    }
  }

  async function runActiveTool() {
    const readinessError = assertReady();
    if (readinessError) {
      setStatus(readinessError);
      return;
    }

    await withBusy("Processing...", async (signal) => {
      setResult(null);
      try {
        let response;
        const requestOptions = { signal, asyncJob: asyncToolIds.has(activeTool) };
        const pageRange =
          activeTool === "rotate" && rotateScope === "all"
            ? ""
            : activeTool === "watermark" && watermarkScope === "all"
              ? ""
              : pagesToRange(selectedPages);

        if (activeTool === "merge") {
          response = hasPaths ? await mergePathFiles(pathInputs, requestOptions) : await mergeUploadedFiles(uploadedFiles, requestOptions);
        } else if (activeTool === "images") {
          response = hasPaths ? await imagesToPdfPaths(pathInputs, requestOptions) : await imagesToPdfUpload(uploadedFiles, requestOptions);
        } else if (activeTool === "split") {
          response = hasPaths ? await splitPdfPath(pathInputs, requestOptions) : await splitPdfUpload(uploadedFiles, requestOptions);
        } else if (activeTool === "render") {
          response = hasPaths ? await pdfToImagesPath(pathInputs, requestOptions) : await pdfToImagesUpload(uploadedFiles, requestOptions);
        } else if (activeTool === "extract") {
          response = hasPaths ? await extractPagesPath(pathInputs, pageRange, requestOptions) : await extractPagesUpload(uploadedFiles, pageRange, requestOptions);
        } else if (activeTool === "delete") {
          response = hasPaths ? await deletePagesPath(pathInputs, pageRange, requestOptions) : await deletePagesUpload(uploadedFiles, pageRange, requestOptions);
        } else if (activeTool === "rotate") {
          response = hasPaths ? await rotatePdfPath(pathInputs, rotation, pageRange, requestOptions) : await rotatePdfUpload(uploadedFiles, rotation, pageRange, requestOptions);
        } else if (activeTool === "reorder") {
          const pageOrder = pagePreview.map((page) => page.page).join(",");
          response = hasPaths ? await reorderPagesPath(pathInputs, pageOrder, requestOptions) : await reorderPagesUpload(uploadedFiles, pageOrder, requestOptions);
        } else if (activeTool === "reverse") {
          response = hasPaths ? await reversePagesPath(pathInputs, requestOptions) : await reversePagesUpload(uploadedFiles, requestOptions);
        } else if (activeTool === "duplicate") {
          const duplicatePages = pagesToRange(selectedPages);
          response = hasPaths ? await duplicatePagesPath(pathInputs, duplicatePages, requestOptions) : await duplicatePagesUpload(uploadedFiles, duplicatePages, requestOptions);
        } else if (activeTool === "page_numbers") {
          const numberPages = selectedPages.length ? pagesToRange(selectedPages) : "";
          const numberPayload = {
            pages: numberPages,
            position: "bottom-right",
            size: 12,
            opacity: 0.72,
            color: "#b02730",
            prefix: "",
            suffix: "",
            start: 1,
          };
          response = hasPaths
            ? await pageNumbersPath(pathInputs, numberPayload, requestOptions)
            : await pageNumbersUpload(uploadedFiles, numberPayload, requestOptions);
        } else if (activeTool === "password") {
          response = hasPaths ? await passwordProtectPath(pathInputs, password, requestOptions) : await passwordProtectUpload(uploadedFiles, password, requestOptions);
        } else if (activeTool === "repair") {
          response = hasPaths ? await repairPdfPath(pathInputs, requestOptions) : await repairPdfUpload(uploadedFiles, requestOptions);
        } else if (activeTool === "watermark") {
          const watermarkPayload = {
            text: watermarkText,
            mode: watermarkMode,
            preset: watermarkPreset,
            pages: pageRange,
            position: watermarkPosition,
            angle: watermarkAngle,
            size: watermarkSize,
            opacity: watermarkOpacity,
            color: watermarkColor,
          };
          response = watermarkMode === "image"
            ? hasPaths
              ? await watermarkImagePath(pathInputs, watermarkImageFile, watermarkPayload, requestOptions)
              : await watermarkImageUpload(uploadedFiles, watermarkImageFile, watermarkPayload, requestOptions)
            : hasPaths
              ? await watermarkTextPath(pathInputs, watermarkPayload, requestOptions)
              : await watermarkTextUpload(uploadedFiles, watermarkPayload, requestOptions);
        } else if (activeTool === "digital_sign") {
          response = hasPaths ? await signatureReportPath(pathInputs, { signal }) : await signatureReportUpload(uploadedFiles, { signal });
          setSignatureReport(response);
          setResult({ tool: activeTool, paths: [] });
          setStatus(
            response.signature_count
              ? response.document_signed
                ? `Found ${response.signature_count} signature${response.signature_count === 1 ? "" : "s"}`
                : `Found ${response.signature_count} signature field${response.signature_count === 1 ? "" : "s"}`
              : "No signature fields found"
          );
          return;
        }

        if (response?.job_id) {
          response = await waitForJob(response.job_id, signal);
        }

        const paths = outputPathsFromResult(response);
        setResult({ tool: activeTool, paths });
        pushHistoryEntry(activeTool, paths);
        setStatus(paths.length === 1 ? "Created 1 file" : `Created ${paths.length} files`);
      } catch (err) {
        if (err.name === "AbortError") {
          setStatus("Processing cancelled");
          return;
        }
        setStatus(`Error: ${err.message}`);
      }
    });
  }

  async function handleDownloadOne(path) {
    await withBusy("Preparing download...", async () => {
      try {
        if (canUseDesktopBridge()) {
          const targetPath = await pickSavePathDialog(pathName(path));
          if (!targetPath) {
            setStatus("Save cancelled");
            return;
          }
          await copyFileToPath(path, targetPath);
          setStatus("File saved");
          return;
        }

        await downloadResult(path);
        setStatus("Download started");
      } catch (err) {
        setStatus(`Download error: ${err.message}`);
      }
    });
  }

  async function handleDownloadZip(paths = resultPaths) {
    await withBusy("Preparing ZIP...", async () => {
      try {
        await downloadZip(paths);
        setStatus("ZIP download started");
      } catch (err) {
        setStatus(`ZIP error: ${err.message}`);
      }
    });
  }

  async function exportResultsToFolder(paths = resultPaths) {
    if (!paths.length) {
      setStatus("No result files ready to export.");
      return;
    }
    if (!canUseDesktopBridge()) {
      setStatus("Folder export works in the desktop app.");
      return;
    }
    if (!outputFolder) {
      setStatus("Choose an output folder first.");
      return;
    }

    await withBusy("Exporting files...", async () => {
      try {
        for (const path of paths) {
          await copyFileToPath(path, `${outputFolder}\\${pathName(path)}`);
        }
        setStatus(paths.length === 1 ? "Exported 1 file to output folder" : `Exported ${paths.length} files to output folder`);
      } catch (err) {
        setStatus(`Export error: ${err.message}`);
      }
    });
  }

  return (
    <main className="app-shell">
      {dropOverlayActive && (
        <div
          className="drop-overlay"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          onDragLeave={(event) => {
            event.preventDefault();
            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
            if (dragDepthRef.current === 0) {
              setDropOverlayActive(false);
            }
          }}
        >
          <div className="drop-overlay-card">
            <Icon name="upload" />
            <strong>Drop files into NoDoc</strong>
            <span>PDF, PNG, JPG, WEBP, BMP</span>
            <button type="button" onClick={() => void openFiles()} disabled={isBusy}>
              Browse files
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <aside className="settings-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="settings-header">
              <div>
                <h2>Settings</h2>
                <p>Only working local options, recent jobs, and quick cleanup.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setShowSettings(false)} title="Close settings">
                <Icon name="close" />
              </button>
            </div>

            <section className="settings-section">
              <h3>Workspace</h3>
              <div className="settings-actions">
                <button type="button" onClick={() => void openFiles()}>Open files</button>
                <button type="button" onClick={() => setPreviewTick((value) => value + 1)} disabled={!exactlyOnePdfSelected}>Reload preview</button>
                <button type="button" onClick={cancelCurrentWork} disabled={!showCancelAction}>Cancel task</button>
              </div>
              <div className="settings-actions">
                <button type="button" onClick={() => void chooseOutputFolder()} disabled={isBusy}>Choose output folder</button>
                <button type="button" onClick={() => setOutputFolder("")} disabled={!outputFolder || isBusy}>Clear output folder</button>
              </div>
              <p className="settings-note">
                {outputFolder ? `Output folder: ${outputFolder}` : "Downloads go to your current browser or desktop app download location."}
              </p>
            </section>

            <section className="settings-section">
              <div className="settings-section-title">
                <h3>Recent jobs</h3>
                <button type="button" onClick={() => setJobHistory([])} disabled={!jobHistory.length}>Clear history</button>
              </div>
              {jobHistory.length ? (
                <ul className="settings-list">
                  {jobHistory.map((entry) => (
                    <li key={entry.id}>
                      <div className="settings-list-main">
                        <strong>{entry.tool}</strong>
                        <span>{entry.outputs.join(", ")}</span>
                        <em>{formatTime(entry.createdAt)}</em>
                      </div>
                      <div className="settings-list-actions">
                        <button type="button" onClick={() => loadPathItems(entry.paths || [], "Loaded result into workspace")} disabled={isBusy || !entry.paths?.length}>
                          <Icon name="openExternal" />
                          <span>Use</span>
                        </button>
                        {entry.paths?.length === 1 ? (
                          <button type="button" onClick={() => handleDownloadOne(entry.paths[0])} disabled={isBusy}>
                            <Icon name="download" />
                            <span>Download</span>
                          </button>
                        ) : (
                          <button type="button" onClick={() => handleDownloadZip(entry.paths || [])} disabled={isBusy || !entry.paths?.length}>
                            <Icon name="download" />
                            <span>ZIP</span>
                          </button>
                        )}
                        {canUseDesktopBridge() && outputFolder && entry.paths?.length ? (
                          <button type="button" onClick={() => void exportResultsToFolder(entry.paths)} disabled={isBusy}>
                            <Icon name="folder" />
                            <span>Export</span>
                          </button>
                        ) : null}
                        {canUseDesktopBridge() && entry.paths?.length ? (
                          <button type="button" onClick={() => void handleRevealPath(entry.paths[0])} disabled={isBusy}>
                            <Icon name="openExternal" />
                            <span>Show</span>
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="settings-note">No finished jobs yet.</p>
              )}
            </section>

            <section className="settings-section">
              <div className="settings-section-title">
                <h3>Recent files</h3>
                <button type="button" onClick={() => setRecentFiles([])} disabled={!recentFiles.length}>Clear list</button>
              </div>
              {recentFiles.length ? (
                <ul className="settings-list compact">
                  {recentFiles.map((name) => (
                    <li key={name}>
                      <strong>{name}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="settings-note">No recent file names stored yet.</p>
              )}
            </section>
          </aside>
        </div>
      )}

      {isBusy && (
        <div className="busy-bar" role="status" aria-live="polite">
          <span>{busyProgress !== null ? <i style={{ width: `${busyProgress}%` }} /> : null}</span>
          <strong>{busyLabel}</strong>
        </div>
      )}

      <section className="titlebar">
        <div className="brand-lockup">
          <img src="/nodoc-logo.png" alt="NoDoc logo" />
          <div>
            <strong>NoDoc</strong>
            <span>{sourceMode === "open-with" ? "Opened from Windows" : "Local workspace"}</span>
          </div>
        </div>
        <div className="quick-actions">
          <button type="button" onClick={() => void openFiles()} disabled={isBusy} title="Browse files">
            <Icon name="upload" />
            <span>Open</span>
          </button>
          <button type="button" onClick={handleHealthCheck} disabled={isBusy} title="Check local engine">
            <Icon name="reload" />
            <span>Engine</span>
          </button>
          <button type="button" onClick={() => setShowSettings(true)} disabled={isBusy} title="Open settings">
            <Icon name="settings" />
            <span>Settings</span>
          </button>
        </div>
      </section>

      <nav className="category-tabs" aria-label="Tool categories">
        {groups.map((group) => (
          <button
            className={activeGroup === group.id ? "is-active" : ""}
            key={group.id}
            type="button"
            onClick={() => chooseGroup(group.id)}
          >
            {group.label}
          </button>
        ))}
      </nav>

      <section className="ribbon">
        <div className="ribbon-tools">
          {activeTools.map((tool) => (
            <button
              className={`tool-button ${activeTool === tool.id ? "is-active" : ""} ${tool.status === "planned" ? "is-planned" : ""}`}
              key={tool.id}
              type="button"
              title={`${tool.title}: ${tool.detail}`}
              onClick={() => chooseTool(tool)}
              disabled={isBusy}
            >
              <Icon name={tool.icon} />
              <span>{tool.title}</span>
              <em>{tool.status === "ready" ? tool.needs : "Later"}</em>
            </button>
          ))}
        </div>

        <div className="ribbon-settings">
          <div className="workflow-card">
            <div className="workflow-status">
              <span className={`state-pill ${isBusy ? "is-planned" : "is-ready"}`}>{actionLabel}</span>
              <strong>{selectionLabel || (fileItems.length ? `${fileItems.length} file${fileItems.length === 1 ? "" : "s"} loaded` : "Drop or open files")}</strong>
            </div>
            <p>{status}</p>
            {resultPaths.length > 0 && (
              <div className="workflow-downloads">
                {resultPaths.length === 1 ? (
                  <button type="button" onClick={() => handleDownloadOne(resultPaths[0])} disabled={isBusy}>
                    <Icon name="download" />
                    <span>Download file</span>
                  </button>
                ) : (
                  <button type="button" onClick={handleDownloadZip} disabled={isBusy}>
                    <Icon name="download" />
                    <span>Download ZIP</span>
                  </button>
                )}
                {canUseDesktopBridge() && outputFolder ? (
                  <button type="button" onClick={() => void exportResultsToFolder()} disabled={isBusy}>
                    <Icon name="folder" />
                    <span>Export</span>
                  </button>
                ) : null}
                <button type="button" onClick={() => loadPathItems(resultPaths, "Loaded result into workspace")} disabled={isBusy}>
                  <Icon name="openExternal" />
                  <span>Use result</span>
                </button>
                {canUseDesktopBridge() ? (
                  <button type="button" onClick={() => void handleRevealPath(resultPaths[0] || outputFolder || pathFolder(resultPaths[0] || ""))} disabled={isBusy}>
                    <Icon name="folder" />
                    <span>Show folder</span>
                  </button>
                ) : null}
                <span>{resultPaths.slice(0, 3).map((path) => pathName(path)).join(", ")}</span>
              </div>
            )}
          </div>

          <div className="ribbon-action-row">
            {activeTool === "rotate" && (
              <>
                <div className="segmented-control rotate-control" aria-label="Rotation">
                  {[0, 90, 180, 270].map((degrees) => (
                    <button
                      className={rotation === degrees ? "is-active" : ""}
                      key={degrees}
                      type="button"
                      title={`Rotate ${degrees} degrees`}
                      aria-label={`Rotate ${degrees} degrees`}
                      onClick={() => setRotation(degrees)}
                      disabled={isBusy}
                    >
                      <Icon name="rotate" />
                      <span>{degrees}</span>
                    </button>
                  ))}
                </div>

                <div className="segmented-control scope-control" aria-label="Rotate scope">
                  {[
                    { id: "selected", label: "Selected" },
                    { id: "all", label: "All pages" },
                  ].map((scope) => (
                    <button
                      className={rotateScope === scope.id ? "is-active" : ""}
                      key={scope.id}
                      type="button"
                      onClick={() => setRotateScope(scope.id)}
                      disabled={isBusy}
                    >
                      <span>{scope.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {activeTool === "password" && (
              <label className="field compact-field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="PDF password"
                />
              </label>
            )}

            <button className="primary-action" type="button" onClick={runActiveTool} disabled={isBusy}>
              <Icon name="check" />
              <span>{activeTool === "digital_sign" ? "Check" : readyToolIds.has(activeTool) ? "Apply" : "Planned"}</span>
            </button>

            {showCancelAction && (
              <button type="button" className="secondary-action" onClick={cancelCurrentWork}>
                <Icon name="close" />
                <span>{isBusy ? "Cancel" : "Reset"}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="workspace">
        <aside className="file-panel">
          <div className="panel-heading">
            <h2>Files</h2>
            <div className="panel-heading-actions">
              <span>{fileItems.length}</span>
              {fileItems.length > 0 && (
                <button type="button" className="icon-button" onClick={clearFiles} disabled={isBusy} title="Clear files">
                  <Icon name="close" />
                </button>
              )}
            </div>
          </div>

          <section
            className={`dropzone ${isDragging ? "is-dragging" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={handleDrop}
          >
            <Icon name="upload" />
            <strong>Drop files</strong>
            <span className="dropzone-hint">PDF, PNG, JPG, WEBP, BMP</span>
            <button type="button" onClick={() => void openFiles()} disabled={isBusy}>
              Browse
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp"
              onChange={(event) => updateFiles(event.target.files ?? [])}
            />
          </section>

          {fileItems.length ? (
            <ul className="file-list">
              {fileNames.map((name, index) => (
                <li key={`${name}-${index}`}>
                  <Icon name={hasExtension(name, imageExtensions) ? "image" : "pdf"} />
                  <span title={fileItems[index].path || name}>{name}</span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => removeFileAt(index)}
                    disabled={isBusy}
                    title={`Remove ${name}`}
                  >
                    <Icon name="close" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">No files loaded</p>
          )}
        </aside>

        <section className="document-panel">
          <div className="document-header">
            <div>
              <h1>{activeToolInfo?.title}</h1>
              <p>{activeToolInfo?.detail}</p>
            </div>
            <span className={`state-pill ${readyToolIds.has(activeTool) ? "is-ready" : "is-planned"}`}>
              {readyToolIds.has(activeTool) ? "Ready" : "Planned"}
            </span>
          </div>

          {exactlyOnePdfSelected ? (
            <div className="preview-panel">
              <div className="panel-heading">
                <h2>Pages</h2>
              <div className="preview-meta">
                <span>{previewBusy ? "..." : `${pagePreview.length} total`}</span>
                {pageToolActive && <span>{selectionLabel}</span>}
                {reorderActive && reorderChanged && <span>Order changed</span>}
              </div>
            </div>

              {pageToolActive && (
                <div className="preview-toolbar">
                  <div>
                    <strong>{pagePreview.length} total</strong>
                    <span>
                      {activeTool === "rotate" && rotateAppliesToAll
                        ? "All pages targeted"
                        : activeTool === "watermark" && watermarkAllPages
                          ? "All pages targeted"
                          : `${selectedPages.length} selected`}
                    </span>
                  </div>

                  <div className="preview-toolbar-actions">
                    {!pageSelectionLocked && (
                      <>
                        <button type="button" onClick={selectAllPages} disabled={!pagePreview.length || isBusy}>
                          Select all
                        </button>
                        <button type="button" onClick={clearPages} disabled={!selectedPages.length || isBusy}>
                          Unselect all
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {reorderActive && (
                <div className="preview-toolbar">
                  <div>
                    <strong>{pagePreview.length} total</strong>
                    <span>{reorderChanged ? "Reordered preview" : "Original order"}</span>
                  </div>

                  <div className="preview-toolbar-actions">
                    <button type="button" onClick={resetPageOrder} disabled={!reorderChanged || isBusy}>
                      Reset order
                    </button>
                  </div>
                </div>
              )}

              {activeTool === "digital_sign" && (
                <div className="signature-report">
                  <div className="signature-report-head">
                    <div>
                      <strong>Signature check</strong>
                      <span>
                        {signatureBusy
                          ? "Inspecting document"
                          : signatureReport
                            ? `${signatureReport.signature_count} field${signatureReport.signature_count === 1 ? "" : "s"} found`
                            : "No report yet"}
                      </span>
                    </div>
                    <div className={`signature-pill is-${signatureReport?.status || "idle"}`}>
                      {signatureBusy
                        ? "Checking"
                        : signatureReport
                          ? signatureReport.status === "signed"
                            ? "Signed"
                            : signatureReport.status === "unsigned"
                              ? "Needs review"
                              : "None found"
                          : "Ready"}
                    </div>
                  </div>

                  {signatureBusy ? (
                    <div className="signature-empty">
                      <span />
                      <p>Reading signature fields and validation markers</p>
                    </div>
                  ) : signatureReport ? (
                    <div className="signature-report-body">
                      <div className="signature-summary">
                        <strong>{signatureReport.document_signed ? "Signature present" : "No valid signature yet"}</strong>
                        <p>
                          {signatureReport.document_signed
                            ? "The file contains signature fields with ByteRange and Contents data."
                            : signatureReport.signature_count
                              ? "Signature fields exist, but they are incomplete or need review."
                              : "No signature fields were detected in this document."}
                        </p>
                      </div>
                      <div className="signature-field-list">
                        {signatureReport.fields.length ? (
                          signatureReport.fields.map((field) => (
                            <article key={field.name} className="signature-field-card">
                              <div className="signature-field-head">
                                <strong>{field.name}</strong>
                                <span className={field.signed ? "is-signed" : "is-warning"}>
                                  {field.signed ? "Structure OK" : "Attention"}
                                </span>
                              </div>
                              <p>{field.filter || "No filter"}{field.subfilter ? ` | ${field.subfilter}` : ""}</p>
                              {field.issues.length > 0 && <em>{field.issues.join(", ")}</em>}
                            </article>
                          ))
                        ) : (
                          <div className="signature-empty compact">
                            <p>No signature fields detected.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="signature-empty">
                      <p>Open a PDF to inspect signatures.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTool === "watermark" && (
                <div className="watermark-editor">
                  <div className="watermark-editor-head">
                    <div>
                      <strong>Watermark editor</strong>
                      <span>{watermarkAllPages ? "All pages" : `${selectedPages.length} selected`}</span>
                    </div>
                    <button type="button" onClick={() => setWatermarkText("NoDoc")} disabled={isBusy}>
                      Reset text
                    </button>
                  </div>

                  <div className="watermark-editor-body">
                    <div className="watermark-preview-shell">
                      <div className="watermark-preview-page" style={previewPaperStyle}>
                        <div className="watermark-preview-size">{previewPageLabel}</div>
                        {previewPage ? (
                          <LazyThumbImage
                            previewSessionId={previewSessionId}
                            pageNumber={previewPageNumber}
                            fallbackImage={previewPage.image}
                            altText="Selected PDF page preview"
                            rootRef={previewScrollRef}
                          />
                        ) : (
                          <div className="watermark-preview-empty">Preview</div>
                        )}
                        {watermarkMode === "badge" ? (
                          <div
                            className={`watermark-preview-badge is-${watermarkPreset}`}
                            style={{
                              ...watermarkPlacementStyle,
                              opacity: clamp(watermarkOpacity, 0.05, 1),
                              transform: `translate(-50%, -50%) rotate(${watermarkAngle}deg)`,
                              background: watermarkPreset === "question" ? "#f2cd53" : watermarkColor,
                              color: watermarkPreset === "question" ? "#1f1f1f" : "#ffffff",
                              width: `${clamp(watermarkSize * 2.4, 84, 220)}px`,
                              height: `${clamp(watermarkSize * 2.4, 84, 220)}px`,
                            }}
                          >
                            <strong>{watermarkPreset === "question" ? "?" : "V"}</strong>
                            <span>{watermarkText.trim() || "NoDoc"}</span>
                          </div>
                        ) : watermarkMode === "image" ? (
                          watermarkImagePreview ? (
                            <img
                              className="watermark-preview-mark-image"
                              src={watermarkImagePreview}
                              alt="Watermark image preview"
                              draggable="false"
                              style={{
                                ...watermarkPlacementStyle,
                                opacity: clamp(watermarkOpacity, 0.05, 1),
                                width: `${clamp(watermarkSize * 3.2, 48, 360)}px`,
                                transform: `translate(-50%, -50%) rotate(${watermarkAngle}deg)`,
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              className="watermark-image-empty"
                              onClick={() => watermarkImageInputRef.current?.click()}
                              disabled={isBusy}
                            >
                              Choose image mark
                            </button>
                          )
                        ) : (
                          <div
                            className="watermark-preview-text"
                            style={{
                              ...watermarkPlacementStyle,
                              opacity: clamp(watermarkOpacity, 0.05, 1),
                              color: watermarkColor,
                              fontSize: `${clamp(watermarkSize, 18, 140)}px`,
                              transform: `translate(-50%, -50%) rotate(${watermarkAngle}deg)`,
                            }}
                          >
                            {watermarkText.trim() || "NoDoc"}
                          </div>
                        )}
                      </div>
                      <p className="watermark-preview-note">
                        Live preview uses the selected PDF page so placement, angle, size, and opacity are visible before Apply.
                      </p>
                    </div>

                    <div className="watermark-editor-scroll">
                      <div className="watermark-grid">
                        <div className="field">
                          <span>Mode</span>
                          <div className="segmented-control scope-control watermark-mode-control">
                            {[
                              { id: "text", label: "Text watermark" },
                              { id: "badge", label: "Badge / mark" },
                              { id: "image", label: "Image / signature" },
                            ].map((mode) => (
                              <button
                                className={watermarkMode === mode.id ? "is-active" : ""}
                                key={mode.id}
                                type="button"
                                onClick={() => setWatermarkMode(mode.id)}
                                disabled={isBusy}
                              >
                                <span>{mode.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {watermarkMode !== "image" ? (
                          <label className="field">
                            <span>{watermarkMode === "badge" ? "Label" : "Text"}</span>
                            <input
                              type="text"
                              value={watermarkText}
                              onChange={(event) => setWatermarkText(event.target.value)}
                              placeholder={watermarkMode === "badge" ? "Stamp label" : "Watermark text"}
                              maxLength={120}
                            />
                          </label>
                        ) : (
                          <div className="field">
                            <span>Image</span>
                            <div className="watermark-image-picker">
                              <button type="button" onClick={() => watermarkImageInputRef.current?.click()} disabled={isBusy}>
                                Choose image
                              </button>
                              <span title={watermarkImageFile?.name || ""}>{watermarkImageFile?.name || "No image selected"}</span>
                              {watermarkImageFile && (
                                <button type="button" onClick={() => setWatermarkImageFile(null)} disabled={isBusy}>
                                  Remove
                                </button>
                              )}
                              <input
                                ref={watermarkImageInputRef}
                                type="file"
                                accept=".png,.jpg,.jpeg,.webp,.bmp"
                                onChange={(event) => updateWatermarkImage(event.target.files)}
                              />
                            </div>
                          </div>
                        )}

                        {watermarkMode === "badge" && (
                        <div className="field">
                          <span>Badge</span>
                          <div className="badge-presets">
                            {[
                              { id: "verified", label: "Verified", icon: "V" },
                              { id: "question", label: "Question", icon: "?" },
                            ].map((preset) => (
                              <button
                                key={preset.id}
                                type="button"
                                className={watermarkPreset === preset.id ? "is-active" : ""}
                                onClick={() => setWatermarkPreset(preset.id)}
                                disabled={isBusy}
                              >
                                <strong>{preset.icon}</strong>
                                <span>{preset.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        )}

                        <div className="field">
                          <span>Pages</span>
                          <div className="segmented-control scope-control">
                            {[
                              { id: "selected", label: "Selected" },
                              { id: "all", label: "All pages" },
                            ].map((scope) => (
                              <button
                                className={watermarkScope === scope.id ? "is-active" : ""}
                                key={scope.id}
                                type="button"
                                onClick={() => setWatermarkScope(scope.id)}
                                disabled={isBusy}
                              >
                                <span>{scope.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <label className="field">
                          <span>Position</span>
                          <select value={watermarkPosition} onChange={(event) => setWatermarkPosition(event.target.value)} disabled={isBusy}>
                            <option value="center">Center</option>
                            <option value="top-left">Top left</option>
                            <option value="top-right">Top right</option>
                            <option value="bottom-left">Bottom left</option>
                            <option value="bottom-right">Bottom right</option>
                          </select>
                        </label>

                        <div className="field">
                          <span>Angle</span>
                          <div className="watermark-angle">
                            <button
                              type="button"
                              className="watermark-dial"
                              ref={watermarkDialRef}
                              onPointerDown={beginWatermarkDial}
                              disabled={isBusy}
                              aria-label="Rotate watermark"
                            >
                              <span className="watermark-dial-ring" />
                              <span
                                className="watermark-dial-arm"
                                style={{ transform: `rotate(${normalizeAngle(watermarkAngle)}deg)` }}
                              />
                              <span className="watermark-dial-knob" />
                            </button>
                            <div className="watermark-angle-copy">
                              <strong>{Math.round(normalizeAngle(watermarkAngle))}°</strong>
                              <span>Drag or tap a preset</span>
                            </div>
                          </div>
                          <div className="watermark-quick-angles">
                            {quickWatermarkAngles.map((angle) => (
                              <button
                                key={angle}
                                type="button"
                                className={Math.round(normalizeAngle(watermarkAngle)) === angle ? "is-active" : ""}
                                onClick={() => setWatermarkAngle(angle)}
                                disabled={isBusy}
                              >
                                {angle}°
                              </button>
                            ))}
                            <input
                              className="watermark-angle-input"
                              type="number"
                              value={Math.round(normalizeAngle(watermarkAngle))}
                              min={-180}
                              max={180}
                              step={1}
                              onChange={(event) => setWatermarkAngle(Number(event.target.value || 0))}
                              disabled={isBusy}
                            />
                          </div>
                        </div>

                        <label className="field">
                          <span>Size</span>
                          <div className="field-inline">
                            <input
                              type="range"
                              value={watermarkSize}
                              onChange={(event) => setWatermarkSize(Number(event.target.value))}
                              min={12}
                              max={140}
                              step={1}
                              disabled={isBusy}
                            />
                            <input
                              className="field-inline-input"
                              type="number"
                              value={watermarkSize}
                              onChange={(event) => setWatermarkSize(Number(event.target.value || 0))}
                              min={12}
                              max={140}
                              step={1}
                              disabled={isBusy}
                            />
                          </div>
                        </label>

                        <label className="field">
                          <span>Opacity</span>
                          <div className="field-inline">
                            <input
                              type="range"
                              value={watermarkOpacity}
                              onChange={(event) => setWatermarkOpacity(Number(event.target.value))}
                              min={0.05}
                              max={1}
                              step={0.01}
                              disabled={isBusy}
                            />
                            <input
                              className="field-inline-input"
                              type="number"
                              value={Math.round(watermarkOpacity * 100)}
                              onChange={(event) => setWatermarkOpacity(clamp(Number(event.target.value || 0) / 100, 0.05, 1))}
                              min={5}
                              max={100}
                              step={1}
                              disabled={isBusy}
                            />
                          </div>
                        </label>

                        <label className="field">
                          <span>{watermarkMode === "image" ? "Tint color (text/badge only)" : "Color"}</span>
                          <input
                            type="color"
                            value={watermarkColor}
                            onChange={(event) => setWatermarkColor(event.target.value)}
                            disabled={isBusy || watermarkMode === "image"}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {previewBusy ? (
                <div className="preview-loading">
                  <span />
                  <p>Rendering preview</p>
                </div>
              ) : (
                <div className="page-grid-viewport" ref={previewScrollRef}>
                  <div className={`page-grid preview-${activeTool}`}>
                    <div className="page-grid-spacer" aria-hidden="true" style={{ height: `${topSpacerHeight}px` }} />
                    {visiblePages.map((page, index) => {
                      const selected = selectedPages.includes(page.page);
                      const rotationApplies = rotateAppliesToAll || selected;
                      return (
                        <button
                          className={`page-thumb ${pageActionClass(activeTool, selected, rotationApplies)} ${reorderDragPage === page.page ? "is-dragging-page" : ""}`}
                          key={page.page}
                          style={
                            activeTool === "rotate" && rotationApplies
                              ? {
                                  "--preview-rotation": `${rotation}deg`,
                                  "--preview-scale": rotation === 0 ? "1" : rotation === 180 ? "0.92" : "0.78",
                                }
                              : undefined
                          }
                          type="button"
                          title={reorderActive ? "Drag to reorder pages" : pageToolActive ? "Drag across pages to multi-select" : `Page ${page.page}`}
                          draggable={reorderActive && !isBusy}
                          onDragStart={(event) => {
                            if (!reorderActive) {
                              return;
                            }
                            event.stopPropagation();
                            internalDragRef.current = true;
                            dragDepthRef.current = 0;
                            setDropOverlayActive(false);
                            setReorderDragPage(page.page);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("application/x-nodoc-page", String(page.page));
                          }}
                          onDragOver={(event) => {
                            if (!reorderActive || isBusy) {
                              return;
                            }
                            event.preventDefault();
                            event.stopPropagation();
                            event.dataTransfer.dropEffect = "move";
                          }}
                          onDrop={(event) => {
                            if (!reorderActive || isBusy) {
                              return;
                            }
                            event.preventDefault();
                            event.stopPropagation();
                            const draggedPage = Number(event.dataTransfer.getData("application/x-nodoc-page") || reorderDragPage);
                            movePreviewPage(draggedPage, page.page);
                            internalDragRef.current = false;
                            setReorderDragPage(null);
                          }}
                          onDragEnd={(event) => {
                            event.stopPropagation();
                            internalDragRef.current = false;
                            dragDepthRef.current = 0;
                            setDropOverlayActive(false);
                            setReorderDragPage(null);
                          }}
                          onPointerDown={(event) => beginPageDragSelection(page.page, event)}
                          onPointerEnter={(event) => continuePageDragSelection(page.page, event)}
                          onPointerUp={endPageDragSelection}
                          onPointerCancel={endPageDragSelection}
                          onClick={(event) => {
                            if (reorderActive) {
                              event.preventDefault();
                              return;
                            }
                            if (!pageToolActive || rotateAppliesToAll) {
                              event.preventDefault();
                              if (pageToolActive && !rotateAppliesToAll) {
                                togglePage(page.page);
                              }
                            }
                          }}
                          onKeyDown={(event) => {
                            if (!pageToolActive || rotateAppliesToAll) {
                              return;
                            }
                            if (event.key === " " || event.key === "Enter") {
                              event.preventDefault();
                              togglePage(page.page);
                            }
                          }}
                          disabled={isBusy}
                        >
                          {reorderActive && <strong className="page-thumb-order">#{visibleStartIndex + index + 1}</strong>}
                          <LazyThumbImage
                            previewSessionId={previewSessionId}
                            pageNumber={page.page}
                            fallbackImage={page.image}
                            altText={`Page ${page.page}`}
                            rootRef={previewScrollRef}
                          />
                          {reorderActive && <em className="page-thumb-hint">Drag</em>}
                          <span>{page.page}</span>
                        </button>
                      );
                    })}
                    <div className="page-grid-spacer" aria-hidden="true" style={{ height: `${bottomSpacerHeight}px` }} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="blank-canvas">
              <img src="/nodoc-logo.png" alt="NoDoc" />
              <h2>{fileItems.length ? "Preview is ready when one PDF is selected" : "Drop files to begin"}</h2>
              <p>Start in Convert for quick exports, then move to Organize for page work.</p>
            </div>
          )}
        </section>
      </section>

      <footer className="statusbar">
        <p>{status}</p>
        <div className="result-actions">
          {resultPaths.length > 0 && (
            <>
              <span>{resultPaths.length === 1 ? pathName(resultPaths[0]) : `${resultPaths.length} output files ready`}</span>
              {resultPaths.length === 1 ? (
                <button type="button" onClick={() => handleDownloadOne(resultPaths[0])} disabled={isBusy}>
                  <Icon name="download" />
                  <span>Download</span>
                </button>
              ) : (
                <button type="button" onClick={handleDownloadZip} disabled={isBusy}>
                  <Icon name="download" />
                  <span>Download ZIP</span>
                </button>
              )}
              {canUseDesktopBridge() && outputFolder ? (
                <button type="button" onClick={() => void exportResultsToFolder()} disabled={isBusy}>
                  <Icon name="folder" />
                  <span>Export</span>
                </button>
              ) : null}
              <button type="button" onClick={() => loadPathItems(resultPaths, "Loaded result into workspace")} disabled={isBusy}>
                <Icon name="openExternal" />
                <span>Use</span>
              </button>
              {canUseDesktopBridge() ? (
                <button type="button" onClick={() => void handleRevealPath(resultPaths[0] || outputFolder || pathFolder(resultPaths[0] || ""))} disabled={isBusy}>
                  <Icon name="folder" />
                  <span>Show folder</span>
                </button>
              ) : null}
            </>
          )}
        </div>
      </footer>
    </main>
  );
}
