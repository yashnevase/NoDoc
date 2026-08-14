import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkHealth,
  deletePagesPath,
  deletePagesUpload,
  downloadResult,
  downloadZip,
  extractPagesPath,
  extractPagesUpload,
  imagesToPdfPaths,
  imagesToPdfUpload,
  mergePathFiles,
  mergeUploadedFiles,
  passwordProtectPath,
  passwordProtectUpload,
  pdfToImagesPath,
  pdfToImagesUpload,
  pdfToTextPath,
  pdfToTextUpload,
  previewPdfPath,
  previewPdfUpload,
  removeMetadataPath,
  removeMetadataUpload,
  rotatePdfPath,
  rotatePdfUpload,
  splitPdfPath,
  splitPdfUpload,
} from "./api";

const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
const settingsKey = "nodoc-ui-preferences";
const historyKey = "nodoc-job-history";
const recentFilesKey = "nodoc-recent-files";

const groups = [
  {
    id: "convert",
    label: "Convert",
    tools: [
      { id: "render", icon: "image", title: "PDF to JPG", detail: "PDF pages to PNG images", needs: "1 PDF", status: "ready" },
      { id: "images", icon: "pdf", title: "JPG to PDF", detail: "Images to one PDF", needs: "Images", status: "ready" },
      { id: "pdf_txt", icon: "text", title: "PDF to TXT", detail: "Extract embedded text", needs: "1 PDF", status: "ready" },
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
      { id: "reorder", icon: "reorder", title: "Reorder", detail: "Drag pages into order", needs: "Quick next", status: "planned" },
      { id: "batch", icon: "batch", title: "Batch", detail: "Run tools on many files", needs: "Later", status: "planned" },
    ],
  },
  {
    id: "edit",
    label: "Edit",
    tools: [
      { id: "watermark", icon: "stamp", title: "Watermark", detail: "Add text or image mark", needs: "Quick next", status: "planned" },
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
      { id: "digital_sign", icon: "sign", title: "Sign", detail: "Digital signatures", needs: "Complex", status: "planned" },
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
      { id: "metadata", icon: "tag", title: "Metadata", detail: "Remove hidden metadata", needs: "1 PDF", status: "ready" },
      { id: "repair", icon: "repair", title: "Repair", detail: "Best effort repair", needs: "Later", status: "planned" },
      { id: "compare", icon: "compare", title: "Compare", detail: "Visual or text diff", needs: "Later", status: "planned" },
      { id: "pdfa", icon: "archive", title: "PDF/A", detail: "Archive validation", needs: "Complex", status: "planned" },
    ],
  },
];

const readyToolIds = new Set(groups.flatMap((group) => group.tools.filter((tool) => tool.status === "ready").map((tool) => tool.id)));

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
    upload: <><path d="M12 17V5" /><path d="M7 10l5-5 5 5" /><path d="M5 19h14" /></>,
    download: <><path d="M12 5v12" /><path d="M7 12l5 5 5-5" /><path d="M5 19h14" /></>,
    close: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
    reload: <><path d="M19 8a7 7 0 1 0 1 6" /><path d="M19 4v4h-4" /></>,
    check: <><path d="M5 12l4 4L19 6" /></>,
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

function transferHasFiles(dataTransfer) {
  if (!dataTransfer) {
    return false;
  }
  return Array.from(dataTransfer.types || []).includes("Files");
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
  const [status, setStatus] = useState("Ready");
  const [result, setResult] = useState(null);
  const [busyLabel, setBusyLabel] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [pageDragMode, setPageDragMode] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [openMenu, setOpenMenu] = useState("");
  const [jobHistory, setJobHistory] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  const [previewTick, setPreviewTick] = useState(0);
  const fileInputRef = useRef(null);
  const dragDepthRef = useRef(0);
  const menuRef = useRef(null);
  const previewAbortRef = useRef(null);
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
  const isBusy = Boolean(busyLabel);
  const showCancelAction = isBusy || previewBusy;
  const pageToolActive = ["extract", "delete", "rotate"].includes(activeTool);
  const rotateAppliesToAll = activeTool === "rotate" && rotateScope === "all";
  const selectionLabel = pageToolActive && pagePreview.length
    ? rotateAppliesToAll
      ? `${pagePreview.length}/${pagePreview.length} selected`
      : `${selectedPages.length}/${pagePreview.length} selected`
    : "";
  const actionLabel = isBusy ? busyLabel : resultPaths.length ? `Ready ${resultPaths.length === 1 ? "file" : "files"} to download` : "Ready";

  const menuItems = useMemo(
    () => ({
      file: [
        { label: "Open files", action: () => fileInputRef.current?.click() },
        { label: "New workspace", action: () => clearFiles() },
      ],
      edit: [
        { label: "Select all pages", action: () => selectAllPages(), disabled: !pagePreview.length || rotateAppliesToAll },
        { label: "Unselect all pages", action: () => clearPages(), disabled: !selectedPages.length || rotateAppliesToAll },
      ],
      view: [
        { label: "Reload preview", action: () => reloadPreview(), disabled: !exactlyOnePdfSelected },
        { label: "Check engine", action: () => handleHealthCheck() },
      ],
      tools: [
        { label: "Download latest file", action: () => resultPaths[0] && handleDownloadOne(resultPaths[0]), disabled: resultPaths.length !== 1 },
        { label: "Download ZIP", action: () => handleDownloadZip(), disabled: resultPaths.length < 2 },
        { label: "Cancel current task", action: () => cancelCurrentWork(), disabled: !showCancelAction },
      ],
      help: [
        { label: "About NoDoc", action: () => setStatus("NoDoc is a local-first PDF workspace for offline conversion and organization.") },
        { label: "How downloads work", action: () => setStatus("Results download to your browser or desktop app default download location.") },
      ],
    }),
    [pagePreview.length, rotateAppliesToAll, selectedPages.length, exactlyOnePdfSelected, resultPaths, showCancelAction]
  );

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
          ? await previewPdfPath(pathInputs, { signal: controller.signal })
          : await previewPdfUpload(uploadedFiles, { signal: controller.signal });
        if (isCurrent) {
          setPagePreview(response.pages);
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
    function handleWindowDragEnter(event) {
      if (!transferHasFiles(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      dragDepthRef.current += 1;
      setDropOverlayActive(true);
    }

    function handleWindowDragOver(event) {
      if (!transferHasFiles(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      setDropOverlayActive(true);
    }

    function handleWindowDragLeave(event) {
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
    if (!savedPreferences) {
      setJobHistory(readStoredList(historyKey));
      setRecentFiles(readStoredList(recentFilesKey));
      return;
    }

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
    } catch {
      window.localStorage.removeItem(settingsKey);
    }

    setJobHistory(readStoredList(historyKey));
    setRecentFiles(readStoredList(recentFilesKey));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      settingsKey,
      JSON.stringify({ activeGroup, activeTool, rotation, rotateScope })
    );
  }, [activeGroup, activeTool, rotation, rotateScope]);

  useEffect(() => {
    window.localStorage.setItem(historyKey, JSON.stringify(jobHistory));
  }, [jobHistory]);

  useEffect(() => {
    window.localStorage.setItem(recentFilesKey, JSON.stringify(recentFiles));
  }, [recentFiles]);

  useEffect(() => {
    function handleMenuOpen() {
      fileInputRef.current?.click();
    }

    function handleMenuClear() {
      clearFiles();
    }

    function handleMenuAbout() {
      setStatus("NoDoc is a local-first desktop PDF workspace.");
    }

    window.addEventListener("nodoc-open-files", handleMenuOpen);
    window.addEventListener("nodoc-clear-files", handleMenuClear);
    window.addEventListener("nodoc-about", handleMenuAbout);
    return () => {
      window.removeEventListener("nodoc-open-files", handleMenuOpen);
      window.removeEventListener("nodoc-clear-files", handleMenuClear);
      window.removeEventListener("nodoc-about", handleMenuAbout);
    };
  }, []);

  useEffect(() => {
    function handleOutsideMenuClick(event) {
      if (!menuRef.current?.contains(event.target)) {
        setOpenMenu("");
      }
    }

    window.addEventListener("pointerdown", handleOutsideMenuClick);
    return () => window.removeEventListener("pointerdown", handleOutsideMenuClick);
  }, []);

  function rememberRecentFiles(names) {
    if (!names.length) {
      return;
    }
    setRecentFiles((current) => {
      const merged = [...names, ...current].filter(Boolean);
      return [...new Set(merged)].slice(0, 10);
    });
  }

  function pushHistoryEntry(toolId, paths) {
    const toolTitle = groups.flatMap((group) => group.tools).find((tool) => tool.id === toolId)?.title || toolId;
    const entry = {
      id: `${Date.now()}-${toolId}`,
      createdAt: Date.now(),
      tool: toolTitle,
      outputs: paths.map((path) => pathName(path)),
      count: paths.length,
    };
    setJobHistory((current) => [entry, ...current].slice(0, 12));
  }

  function updateFiles(files) {
    const nextItems = uploadItems(files);
    setFileItems(nextItems);
    setResult(null);
    rememberRecentFiles(nextItems.map((item) => item.name));
    setStatus("Files loaded");
  }

  function removeFileAt(indexToRemove) {
    setFileItems((current) => current.filter((_, index) => index !== indexToRemove));
    setResult(null);
    setStatus("File removed");
  }

  function clearFiles() {
    previewAbortRef.current?.abort();
    actionAbortRef.current?.abort();
    setFileItems([]);
    setResult(null);
    setSelectedPages([]);
    setPagePreview([]);
    setBusyLabel("");
    setPreviewBusy(false);
    setStatus("Workspace cleared");
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
    if (!pageToolActive || rotateAppliesToAll || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const shouldSelect = !selectedPages.includes(pageNumber);
    setPageDragMode(shouldSelect);
    setPageSelection(pageNumber, shouldSelect);
  }

  function continuePageDragSelection(pageNumber, event) {
    if (pageDragMode === null || event.buttons !== 1) {
      return;
    }
    setPageSelection(pageNumber, pageDragMode);
  }

  function endPageDragSelection() {
    setPageDragMode(null);
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
    if (["split", "render", "pdf_txt", "extract", "delete", "rotate", "password", "metadata"].includes(activeTool) && !exactlyOnePdfSelected) {
      return "Select exactly one PDF file.";
    }
    if (["extract", "delete"].includes(activeTool) && selectedPages.length === 0) {
      return "Pick pages from the preview.";
    }
    if (activeTool === "rotate" && rotateScope === "selected" && selectedPages.length === 0) {
      return "Pick pages to rotate or switch to All pages.";
    }
    if (activeTool === "password" && !password.trim()) {
      return "Enter a password for the protected PDF.";
    }
    return "";
  }

  function cancelCurrentWork() {
    previewAbortRef.current?.abort();
    actionAbortRef.current?.abort();
    setBusyLabel("");
    setPreviewBusy(false);
    setPageDragMode(null);
    setStatus("Current task cancelled");
  }

  async function withBusy(label, task) {
    const controller = new AbortController();
    actionAbortRef.current = controller;
    setBusyLabel(label);
    setStatus(label);
    try {
      await task(controller.signal);
    } finally {
      if (actionAbortRef.current === controller) {
        actionAbortRef.current = null;
      }
      setBusyLabel("");
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
        const pageRange = activeTool === "rotate" && rotateScope === "all" ? "" : pagesToRange(selectedPages);

        if (activeTool === "merge") {
          response = hasPaths ? await mergePathFiles(pathInputs, { signal }) : await mergeUploadedFiles(uploadedFiles, { signal });
        } else if (activeTool === "images") {
          response = hasPaths ? await imagesToPdfPaths(pathInputs, { signal }) : await imagesToPdfUpload(uploadedFiles, { signal });
        } else if (activeTool === "split") {
          response = hasPaths ? await splitPdfPath(pathInputs, { signal }) : await splitPdfUpload(uploadedFiles, { signal });
        } else if (activeTool === "render") {
          response = hasPaths ? await pdfToImagesPath(pathInputs, { signal }) : await pdfToImagesUpload(uploadedFiles, { signal });
        } else if (activeTool === "pdf_txt") {
          response = hasPaths ? await pdfToTextPath(pathInputs, { signal }) : await pdfToTextUpload(uploadedFiles, { signal });
        } else if (activeTool === "extract") {
          response = hasPaths ? await extractPagesPath(pathInputs, pageRange, { signal }) : await extractPagesUpload(uploadedFiles, pageRange, { signal });
        } else if (activeTool === "delete") {
          response = hasPaths ? await deletePagesPath(pathInputs, pageRange, { signal }) : await deletePagesUpload(uploadedFiles, pageRange, { signal });
        } else if (activeTool === "rotate") {
          response = hasPaths ? await rotatePdfPath(pathInputs, rotation, pageRange, { signal }) : await rotatePdfUpload(uploadedFiles, rotation, pageRange, { signal });
        } else if (activeTool === "password") {
          response = hasPaths ? await passwordProtectPath(pathInputs, password, { signal }) : await passwordProtectUpload(uploadedFiles, password, { signal });
        } else if (activeTool === "metadata") {
          response = hasPaths ? await removeMetadataPath(pathInputs, { signal }) : await removeMetadataUpload(uploadedFiles, { signal });
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
        await downloadResult(path);
        setStatus("Download started");
      } catch (err) {
        setStatus(`Download error: ${err.message}`);
      }
    });
  }

  async function handleDownloadZip() {
    await withBusy("Preparing ZIP...", async () => {
      try {
        await downloadZip(resultPaths);
        setStatus("ZIP download started");
      } catch (err) {
        setStatus(`ZIP error: ${err.message}`);
      }
    });
  }

  function renderMenu(id, label) {
    return (
      <div className="app-menu-slot" key={id}>
        <button
          className={`app-menu-button ${openMenu === id ? "is-open" : ""}`}
          type="button"
          onClick={() => setOpenMenu((current) => (current === id ? "" : id))}
        >
          {label}
        </button>
        {openMenu === id && (
          <div className="app-menu-popover">
            {menuItems[id].map((item) => (
              <button
                className="app-menu-item"
                key={item.label}
                type="button"
                onClick={() => {
                  setOpenMenu("");
                  item.action();
                }}
                disabled={item.disabled}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
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
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
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
                <button type="button" onClick={() => fileInputRef.current?.click()}>Open files</button>
                <button type="button" onClick={() => setPreviewTick((value) => value + 1)} disabled={!exactlyOnePdfSelected}>Reload preview</button>
                <button type="button" onClick={cancelCurrentWork} disabled={!showCancelAction}>Cancel task</button>
              </div>
              <p className="settings-note">Downloads go to your current browser or desktop app download location.</p>
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
                      <strong>{entry.tool}</strong>
                      <span>{entry.outputs.join(", ")}</span>
                      <em>{formatTime(entry.createdAt)}</em>
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
          <span />
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
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isBusy} title="Browse files">
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

      <section className="app-menu-bar" ref={menuRef}>
        <div className="app-menu-groups">
          {renderMenu("file", "File")}
          <button className="app-menu-button" type="button" onClick={clearFiles}>New</button>
          {renderMenu("edit", "Edit")}
          {renderMenu("view", "View")}
          {renderMenu("tools", "Tools")}
          {renderMenu("help", "Help")}
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
              <span>{readyToolIds.has(activeTool) ? "Apply" : "Planned"}</span>
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
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
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
                </div>
              </div>

              {pageToolActive && (
                <div className="preview-toolbar">
                  <div>
                    <strong>{pagePreview.length} total</strong>
                    <span>{activeTool === "rotate" && rotateAppliesToAll ? "All pages targeted" : `${selectedPages.length} selected`}</span>
                  </div>

                  <div className="preview-toolbar-actions">
                    {!rotateAppliesToAll && (
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

              {previewBusy ? (
                <div className="preview-loading">
                  <span />
                  <p>Rendering preview</p>
                </div>
              ) : (
                <div className={`page-grid preview-${activeTool}`}>
                  {pagePreview.map((page) => {
                    const selected = selectedPages.includes(page.page);
                    const rotationApplies = rotateAppliesToAll || selected;
                    return (
                      <button
                        className={`page-thumb ${pageActionClass(activeTool, selected, rotationApplies)}`}
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
                        title={pageToolActive ? "Drag across pages to multi-select" : `Page ${page.page}`}
                        onPointerDown={(event) => beginPageDragSelection(page.page, event)}
                        onPointerEnter={(event) => continuePageDragSelection(page.page, event)}
                        onPointerUp={endPageDragSelection}
                        onPointerCancel={endPageDragSelection}
                        onClick={(event) => {
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
                        <img src={page.image} alt={`Page ${page.page}`} />
                        <span>{page.page}</span>
                      </button>
                    );
                  })}
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
            </>
          )}
        </div>
      </footer>
    </main>
  );
}
