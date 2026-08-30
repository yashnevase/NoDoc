import { useEffect, useRef, useState } from "react";

import { BusyBar } from "./components/BusyBar";
import { CropEditor } from "./components/CropEditor";
import { DocumentPanel } from "./components/DocumentPanel";
import { DropOverlay } from "./components/DropOverlay";
import { DocumentTabs } from "./components/DocumentTabs";
import { HeaderRibbon } from "./components/HeaderRibbon";
import { MetadataEditor } from "./components/MetadataEditor";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { StatusBar } from "./components/StatusBar";
import {
  asyncToolIds,
  groups,
  imageExtensions,
  readyToolIds,
} from "./config/tools";
import { useWorkspacePersistence } from "./hooks/useWorkspacePersistence";
import {
  canUseDesktopBridge,
  cancelJob,
  checkHealth,
  cleanupResults,
  copyFileToPath,
  deletePagesPath,
  deletePagesUpload,
  downloadResult,
  downloadZip,
  extractPagesPath,
  extractPagesUpload,
  getJobStatus,
  getOcrLanguages,
  imagesToPdfPaths,
  imagesToPdfUpload,
  mergePathFiles,
  mergeUploadedFiles,
  passwordProtectPath,
  passwordProtectUpload,
  pdfToImagesPath,
  pdfToImagesUpload,
  ocrTextPath,
  ocrTextUpload,
  pickFilesDialog,
  pickFolderDialog,
  pickSavePathDialog,
  previewPdfPath,
  previewPdfUpload,
  reorderPagesPath,
  reorderPagesUpload,
  reversePagesPath,
  reversePagesUpload,
  duplicatePagesPath,
  duplicatePagesUpload,
  cropPdfPath,
  cropPdfUpload,
  compressPdfPath,
  compressPdfUpload,
  drawPdfPath,
  drawPdfUpload,
  highlightPdfPath,
  highlightPdfUpload,
  redactPdfPath,
  redactPdfUpload,
  metadataPath,
  metadataUpload,
  metadataViewPath,
  metadataViewUpload,
  pageNumbersPath,
  pageNumbersUpload,
  repairPdfPath,
  repairPdfUpload,
  revealPath,
  rotatePdfPath,
  rotatePdfUpload,
  signatureReportPath,
  signatureReportUpload,
  searchablePdfPath,
  searchablePdfUpload,
  searchTextPath,
  searchTextUpload,
  splitPdfPath,
  splitPdfUpload,
  watermarkImagePath,
  watermarkImageUpload,
  watermarkTextPath,
  watermarkTextUpload,
} from "./api";
import { useGlobalFileDrop } from "./hooks/useGlobalFileDrop";
import { useDocumentViewModel } from "./hooks/useDocumentViewModel";
import { useDocumentWorkspace } from "./hooks/useDocumentWorkspace";
import { useMenuEvents } from "./hooks/useMenuEvents";
import { useOpenedFiles } from "./hooks/useOpenedFiles";
import { usePreviewManifest } from "./hooks/usePreviewManifest";
import { usePreviewViewport } from "./hooks/usePreviewViewport";
import { useSignatureReport } from "./hooks/useSignatureReport";
import { useWatermarkDial } from "./hooks/useWatermarkDial";
import {
  hasExtension,
  joinNativePath,
  outputPathsFromResult,
  pagesToRange,
  pathItems,
  pathName,
  sleep,
  uploadItems,
  normalizeAngle,
} from "./utils/fileHelpers";
import {
  canRedoRevision,
  canUndoRevision,
  commitRevisionState,
  currentRevision,
  redoRevisionState,
  revisionLabel,
  undoRevisionState,
} from "./utils/revisionHistory";

const materializedPdfTools = new Set([
  "extract", "delete", "rotate", "reorder", "reverse", "duplicate", "compress",
  "page_numbers", "repair", "watermark", "sign", "text", "draw",
  "highlight", "crop", "redact", "searchable", "metadata",
]);
const documentWideTools = new Set(["compress", "repair", "password", "searchable", "metadata", "reverse"]);

function operationId() {
  return globalThis.crypto?.randomUUID?.() || `operation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const {
    activeDocument,
    activeDocumentId,
    activeSession,
    addDocuments,
    clearDocuments,
    closeDocument,
    documents: fileItems,
    markExported,
    restoreWorkspace,
    sessions: documentSessions,
    setActiveDocumentId,
    setActivePageIndex: setReaderPageIndex,
    setSelectedPages,
    updateActiveSession,
  } = useDocumentWorkspace();
  const [isDragging, setIsDragging] = useState(false);
  const [dropOverlayActive, setDropOverlayActive] = useState(false);
  const [activeGroup, setActiveGroup] = useState("convert");
  const [activeTool, setActiveTool] = useState("render");
  const [pagePreview, setPagePreview] = useState([]);
  const [readerZoom, setReaderZoom] = useState(1);
  const [rotation, setRotation] = useState(90);
  const [rotateScope, setRotateScope] = useState("selected");
  const [compressPreset, setCompressPreset] = useState("balanced");
  const [cropScope, setCropScope] = useState("selected");
  const [crop, setCrop] = useState({ left: 0, top: 0, right: 0, bottom: 0 });
  const [drawStrokes, setDrawStrokes] = useState({});
  const [drawColor, setDrawColor] = useState("#b02730");
  const [drawOpacity, setDrawOpacity] = useState(0.92);
  const [drawThickness, setDrawThickness] = useState(3);
  const [activeDrawPage, setActiveDrawPage] = useState(null);
  const [highlightRegions, setHighlightRegions] = useState({});
  const [highlightColor, setHighlightColor] = useState("#f2cd53");
  const [highlightOpacity, setHighlightOpacity] = useState(0.34);
  const [activeHighlightPage, setActiveHighlightPage] = useState(null);
  const [redactRegions, setRedactRegions] = useState({});
  const [redactColor, setRedactColor] = useState("#121212");
  const [activeRedactionPage, setActiveRedactionPage] = useState(null);
  const [metadataForm, setMetadataForm] = useState({
    title: "",
    author: "",
    subject: "",
    keywords: "",
    creator: "",
    producer: "",
  });
  const [metadata, setMetadata] = useState(null);
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
  const [ocrLanguage, setOcrLanguage] = useState("eng");
  const [ocrLanguages, setOcrLanguages] = useState([]);
  const [ocrTextPreview, setOcrTextPreview] = useState("");
  const [ocrPageCount, setOcrPageCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchSummary, setSearchSummary] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [result, setResult] = useState(null);
  const [busyLabel, setBusyLabel] = useState("");
  const [busyProgress, setBusyProgress] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewSessionId, setPreviewSessionId] = useState("");
  const [pageDragMode, setPageDragMode] = useState(null);
  const [reorderDragPage, setReorderDragPage] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [themeMode, setThemeMode] = useState("system");
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
  const searchAbortRef = useRef(null);
  const actionAbortRef = useRef(null);
  const activeSubmissionRef = useRef("");
  const pageSelectionAnchorRef = useRef(null);
  const ocrEngineHint = ocrLanguages.length
    ? `Local OCR ready: ${ocrLanguages.join(", ")}`
    : "OCR uses local Tesseract. The installed languages are checked before processing.";

  const selectedPages = activeSession.selectedPages;
  const readerPageIndex = activeSession.activePageIndex;

  const activeTools = groups.find((group) => group.id === activeGroup)?.tools || [];
  const activeToolInfo = groups.flatMap((group) => group.tools).find((tool) => tool.id === activeTool);
  const workingRevision = currentRevision(activeSession);
  const workingPath = workingRevision?.paths?.[0] || "";
  const workingDocument = activeDocument && workingPath
    ? { ...activeDocument, source: "path", path: workingPath, file: undefined, revisionId: workingRevision.id }
    : activeDocument;
  const batchInputTool = ["merge", "images"].includes(activeTool);
  const operationItems = batchInputTool ? fileItems : workingDocument ? [workingDocument] : [];
  const uploadedFiles = operationItems.filter((item) => item.source === "upload").map((item) => item.file);
  const pathInputs = operationItems.filter((item) => item.source === "path").map((item) => item.path);
  const hasUploads = uploadedFiles.length > 0;
  const hasPaths = pathInputs.length > 0;
  const mixedSources = hasUploads && hasPaths;
  const sourceMode = hasPaths ? "open-with" : "selected";
  const pdfItems = operationItems.filter((item) => item.name.toLowerCase().endsWith(".pdf"));
  const batchPdfItems = fileItems.filter((item) => item.name.toLowerCase().endsWith(".pdf"));
  const batchImageItems = fileItems.filter((item) => hasExtension(item.name, imageExtensions));
  const allSelectedArePdfs = fileItems.length > 0 && batchPdfItems.length === fileItems.length;
  const allSelectedAreImages = fileItems.length > 0 && batchImageItems.length === fileItems.length;
  const exactlyOnePdfSelected = operationItems.length === 1 && pdfItems.length === 1;
  const previewSourceKey = `${activeDocumentId}:${activeSession.revisionVersion || 0}:` + operationItems.map((item) => item.source === "path" ? `p:${item.path}` : `u:${item.name}:${item.file.size}:${item.file.lastModified}`).join("|");
  const resultPaths = activeTool === "reader" && workingRevision
    ? workingRevision.paths
    : result?.paths || workingRevision?.paths || [];
  const documentRevisionLabel = revisionLabel(activeSession);
  const canUndoDocument = canUndoRevision(activeSession) || Boolean(activeSession.draftUndo?.length);
  const canRedoDocument = canRedoRevision(activeSession) || Boolean(activeSession.draftRedo?.length);
  const {
    bottomSpacerHeight,
    currentReaderIndex,
    currentReaderPage,
    previewPage,
    previewPageLabel,
    previewPageNumber,
    previewPaperStyle,
    readerPageLabel,
    topSpacerHeight,
    visiblePages,
    visibleStartIndex,
    watermarkPlacementStyle,
  } = useDocumentViewModel({
    pagePreview,
    previewViewport,
    readerPageIndex,
    readerZoom,
    watermarkPosition,
  });
  const isBusy = Boolean(busyLabel);
  const showCancelAction = isBusy || previewBusy;
  const readerActive = activeTool === "reader";
  const pageToolActive = ["extract", "delete", "rotate", "watermark", "sign", "text", "duplicate", "crop", "metadata", "redact", "highlight", "draw"].includes(activeTool);
  const reorderActive = activeTool === "reorder";
  const watermarkAllPages = activeTool === "watermark" && watermarkScope === "all";
  const signAllPages = activeTool === "sign" && watermarkScope === "all";
  const textAllPages = activeTool === "text" && watermarkScope === "all";
  const cropAllPages = activeTool === "crop" && cropScope === "all";
  const reorderChanged = pagePreview.length > 0 && pagePreview.some((page, index) => page.page !== index + 1);
  const rotateAppliesToAll = activeTool === "rotate" && rotateScope === "all";
  const drawStrokeCount = Object.values(drawStrokes).reduce((sum, strokes) => sum + strokes.length, 0);
  const highlightRegionCount = Object.values(highlightRegions).reduce((sum, regions) => sum + regions.length, 0);
  const redactionRegionCount = Object.values(redactRegions).reduce((sum, regions) => sum + regions.length, 0);
  const pageSelectionLocked = rotateAppliesToAll || watermarkAllPages || signAllPages || textAllPages || cropAllPages;
  const selectionLabel = pageToolActive && pagePreview.length
    ? pageSelectionLocked
      ? `All ${pagePreview.length} pages`
      : selectedPages.length === 1
        ? `Page ${selectedPages[0]}`
        : `${selectedPages.length} pages selected`
    : "";
  const actionLabel = isBusy
    ? busyLabel
    : resultPaths.length
      ? `Ready ${resultPaths.length === 1 ? "file" : "files"} to download`
      : reorderActive && reorderChanged
        ? "Order changed"
        : "Ready";
  const { rememberRecentFiles, pushHistoryEntry } = useWorkspacePersistence({
    activeGroup,
    activeTool,
    activeDocumentId,
    compressPreset,
    documentSessions,
    documents: fileItems,
    jobHistory,
    outputFolder,
    readerZoom,
    recentFiles,
    rotateScope,
    rotation,
    setActiveGroup,
    setActiveTool,
    setCompressPreset,
    setJobHistory,
    setOutputFolder,
    setReaderZoom,
    setRecentFiles,
    setRotateScope,
    setRotation,
    setWatermarkAngle,
    setWatermarkColor,
    setWatermarkMode,
    setWatermarkOpacity,
    setWatermarkPosition,
    setWatermarkPreset,
    setWatermarkScope,
    setWatermarkSize,
    setThemeMode,
    watermarkAngle,
    watermarkColor,
    watermarkMode,
    watermarkOpacity,
    watermarkPosition,
    watermarkPreset,
    watermarkScope,
    watermarkSize,
    themeMode,
    restoreWorkspace,
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      document.documentElement.dataset.theme = themeMode === "system" ? (media.matches ? "dark" : "light") : themeMode;
      document.documentElement.dataset.themeMode = themeMode;
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [themeMode]);

  useEffect(() => {
    let cancelled = false;
    const loadLanguages = async () => {
      try {
        const response = await getOcrLanguages();
        if (!cancelled) {
          setOcrLanguages(response.languages || []);
        }
      } catch {
        if (!cancelled) {
          setOcrLanguages([]);
        }
      }
    };
    void loadLanguages();
    window.addEventListener("nodoc-ready", loadLanguages);
    return () => {
      cancelled = true;
      window.removeEventListener("nodoc-ready", loadLanguages);
    };
  }, []);

  useEffect(() => {
    function handleHistoryShortcut(event) {
      if (!(event.metaKey || event.ctrlKey) || (event.key.toLowerCase() !== "z" && event.key.toLowerCase() !== "y")) {
        return;
      }
      const redo = event.key.toLowerCase() === "y" || event.shiftKey;
      if (redo ? canRedoDocument : canUndoDocument) {
        event.preventDefault();
        redo ? redoDocumentChange() : undoDocumentChange();
      }
    }
    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, [activeDocumentId, activeSession, canRedoDocument, canUndoDocument, isBusy]);

  useEffect(() => {
    const hasUnsavedWork = Object.values(documentSessions).some((session) => {
      const revision = currentRevision(session);
      return session.dirty || revision && session.exportedRevisionId !== revision.id;
    });
    if (!hasUnsavedWork) {
      return undefined;
    }
    function warnBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [documentSessions]);
  usePreviewViewport({
    activeTool,
    exactlyOnePdfSelected,
    pagePreviewLength: pagePreview.length,
    previewBusy,
    previewScrollRef,
    setPreviewViewport,
  });
  useOpenedFiles({
    addDocuments,
    rememberRecentFiles,
    setActiveGroup,
    setActiveTool,
    setResult,
    setStatus,
  });
  usePreviewManifest({
    exactlyOnePdfSelected,
    hasPaths,
    mixedSources,
    pathInputs,
    previewAbortRef,
    previewSourceKey,
    previewTick,
    setPagePreview,
    setPreviewBusy,
    setPreviewSessionId,
    setSelectedPages,
    setStatus,
    uploadedFiles,
  });
  useSignatureReport({
    activeTool,
    exactlyOnePdfSelected,
    hasPaths,
    mixedSources,
    pathInputs,
    previewSourceKey,
    setSignatureBusy,
    setSignatureReport,
    setStatus,
    signatureAbortRef,
    uploadedFiles,
  });
  useWatermarkDial({
    setWatermarkAngleFromPoint,
    watermarkDialDragRef,
  });
  useGlobalFileDrop({
    dragDepthRef,
    internalDragRef,
    setDropOverlayActive,
    setIsDragging,
    updateFiles,
  });
  useMenuEvents({
    cancelCurrentWork,
    chooseOutputFolder,
    clearFiles,
    openFiles,
    setShowSettings,
    setStatus,
  });

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
    searchAbortRef.current?.abort();
    setSearchQuery("");
    setSearchResults([]);
    setSearchSummary("");
    setSearchBusy(false);
    setOcrTextPreview("");
    setOcrPageCount(0);
  }, [previewSourceKey, exactlyOnePdfSelected]);

  function captureEditorState() {
    return {
      activeDrawPage,
      activeHighlightPage,
      activeRedactionPage,
      compressPreset,
      crop,
      cropScope,
      drawColor,
      drawOpacity,
      drawStrokes,
      drawThickness,
      highlightColor,
      highlightOpacity,
      highlightRegions,
      metadata,
      metadataForm,
      ocrLanguage,
      password,
      pagePreview,
      redactColor,
      redactRegions,
      rotateScope,
      rotation,
      signatureReport,
      watermarkAngle,
      watermarkColor,
      watermarkImageFile,
      watermarkMode,
      watermarkOpacity,
      watermarkPosition,
      watermarkPreset,
      watermarkScope,
      watermarkSize,
      watermarkText,
    };
  }

  function restoreEditorState(state = {}) {
    setRotation(state.rotation ?? 90);
    setRotateScope(state.rotateScope ?? "selected");
    setCompressPreset(state.compressPreset ?? "balanced");
    setCropScope(state.cropScope ?? "selected");
    setCrop(state.crop ?? { left: 0, top: 0, right: 0, bottom: 0 });
    setDrawStrokes(state.drawStrokes ?? {});
    setDrawColor(state.drawColor ?? "#b02730");
    setDrawOpacity(state.drawOpacity ?? 0.92);
    setDrawThickness(state.drawThickness ?? 3);
    setActiveDrawPage(state.activeDrawPage ?? null);
    setHighlightRegions(state.highlightRegions ?? {});
    setHighlightColor(state.highlightColor ?? "#f2cd53");
    setHighlightOpacity(state.highlightOpacity ?? 0.34);
    setActiveHighlightPage(state.activeHighlightPage ?? null);
    setRedactRegions(state.redactRegions ?? {});
    setRedactColor(state.redactColor ?? "#121212");
    setActiveRedactionPage(state.activeRedactionPage ?? null);
    setMetadata(state.metadata ?? null);
    setMetadataForm(state.metadataForm ?? { title: "", author: "", subject: "", keywords: "", creator: "", producer: "" });
    setPassword(state.password ?? "");
    if (Array.isArray(state.pagePreview)) {
      setPagePreview(state.pagePreview);
    }
    setWatermarkText(state.watermarkText ?? "NoDoc");
    setWatermarkMode(state.watermarkMode ?? "text");
    setWatermarkPreset(state.watermarkPreset ?? "verified");
    setWatermarkScope(state.watermarkScope ?? "selected");
    setWatermarkPosition(state.watermarkPosition ?? "center");
    setWatermarkAngle(state.watermarkAngle ?? -45);
    setWatermarkSize(state.watermarkSize ?? 48);
    setWatermarkOpacity(state.watermarkOpacity ?? 0.22);
    setWatermarkColor(state.watermarkColor ?? "#b02730");
    setWatermarkImageFile(state.watermarkImageFile ?? null);
    setSignatureReport(state.signatureReport ?? null);
    setOcrLanguage(state.ocrLanguage ?? "eng");
  }

  function activateDocument(documentId) {
    if (!documentId || documentId === activeDocumentId || isBusy) {
      return;
    }
    updateActiveSession({ activeGroup, activeTool, editState: captureEditorState() });
    const nextSession = documentSessions[documentId];
    setActiveDocumentId(documentId);
    setActiveGroup(nextSession?.activeGroup || "tools");
    setActiveTool(nextSession?.activeTool || "reader");
    restoreEditorState(nextSession?.editState);
    const paths = nextSession?.workingPaths || [];
    setResult(paths.length ? { tool: nextSession?.activeTool || "reader", paths } : null);
    setStatus(`Active document: ${fileItems.find((item) => item.id === documentId)?.name || "document"}`);
  }

  function loadPathItems(paths, statusMessage) {
    const cleanPaths = (paths || []).filter(Boolean);
    if (!cleanPaths.length) {
      setStatus("No files available for that action.");
      return;
    }
    const nextItems = pathItems(cleanPaths);
    addDocuments(nextItems);
    if (nextItems.some((item) => item.name.toLowerCase().endsWith(".pdf"))) {
      setActiveGroup("tools");
      setActiveTool("reader");
    }
    setResult(null);
    setSelectedPages([]);
    setPagePreview([]);
    setPreviewSessionId("");
    setSignatureReport(null);
    setSignatureBusy(false);
    searchAbortRef.current?.abort();
    setSearchQuery("");
    setSearchResults([]);
    setSearchSummary("");
    setSearchBusy(false);
    setDrawStrokes({});
    setActiveDrawPage(null);
    setHighlightRegions({});
    setActiveHighlightPage(null);
    setRedactRegions({});
    setActiveRedactionPage(null);
    setReorderDragPage(null);
    setPreviewTick((value) => value + 1);
    rememberRecentFiles(nextItems.map((item) => item.name));
    setStatus(statusMessage || `Loaded ${nextItems.length} file${nextItems.length === 1 ? "" : "s"}`);
  }

  function updateFiles(files) {
    const nextItems = uploadItems(files);
    addDocuments(nextItems);
    if (nextItems.some((item) => item.name.toLowerCase().endsWith(".pdf"))) {
      setActiveGroup("tools");
      setActiveTool("reader");
    }
    setResult(null);
    setDrawStrokes({});
    setActiveDrawPage(null);
    setHighlightRegions({});
    setActiveHighlightPage(null);
    setRedactRegions({});
    setActiveRedactionPage(null);
    searchAbortRef.current?.abort();
    setSearchQuery("");
    setSearchResults([]);
    setSearchSummary("");
    setSearchBusy(false);
    setOcrTextPreview("");
    setOcrPageCount(0);
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
        addDocuments(nextItems);
        if (nextItems.some((item) => item.name.toLowerCase().endsWith(".pdf"))) {
          setActiveGroup("tools");
          setActiveTool("reader");
        }
        setResult(null);
        setDrawStrokes({});
        setActiveDrawPage(null);
        setHighlightRegions({});
        setActiveHighlightPage(null);
        setRedactRegions({});
        setActiveRedactionPage(null);
        searchAbortRef.current?.abort();
        setSearchQuery("");
        setSearchResults([]);
        setSearchSummary("");
        setSearchBusy(false);
        setOcrTextPreview("");
        setOcrPageCount(0);
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

  function removeDocument(documentId) {
    const session = documentSessions[documentId];
    const current = currentRevision(session);
    const hasUnexportedRevision = current && session.exportedRevisionId !== current.id;
    if ((session?.dirty || hasUnexportedRevision) && !window.confirm(session?.dirty
      ? "This document has unapplied changes. Close it anyway?"
      : "This working revision has not been exported. Close it anyway?")) {
      return;
    }
    if (documentId === activeDocumentId) {
      previewAbortRef.current?.abort();
      const index = fileItems.findIndex((item) => item.id === documentId);
      const remaining = fileItems.filter((item) => item.id !== documentId);
      const replacement = remaining[Math.min(index, Math.max(0, remaining.length - 1))];
      if (replacement) {
        activateDocument(replacement.id);
      }
    }
    const temporaryPaths = [...new Set((session?.revisions || []).flatMap((revision) => revision.paths || []))];
    if (temporaryPaths.length) {
      void cleanupResults(temporaryPaths, { releaseWorkspace: true }).catch(() => {});
    }
    closeDocument(documentId);
    setResult(null);
    setStatus("Document closed");
  }

  function clearFiles() {
    const hasUnsavedWork = Object.values(documentSessions).some((session) => {
      const current = currentRevision(session);
      return session.dirty || current && session.exportedRevisionId !== current.id;
    });
    if (hasUnsavedWork && !window.confirm("Some documents have unapplied or unexported changes. Clear the workspace anyway?")) {
      return;
    }
    previewAbortRef.current?.abort();
    signatureAbortRef.current?.abort();
    actionAbortRef.current?.abort();
    searchAbortRef.current?.abort();
    const temporaryPaths = [...new Set(Object.values(documentSessions).flatMap((session) =>
      (session.revisions || []).flatMap((revision) => revision.paths || [])
    ))];
    if (temporaryPaths.length) {
      void cleanupResults(temporaryPaths, { releaseWorkspace: true }).catch(() => {});
    }
    clearDocuments();
    setResult(null);
    setSelectedPages([]);
    setPagePreview([]);
    setPreviewSessionId("");
    setSignatureReport(null);
    setSignatureBusy(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchSummary("");
    setSearchBusy(false);
    setOcrTextPreview("");
    setOcrPageCount(0);
    setDrawStrokes({});
    setActiveDrawPage(null);
    setHighlightRegions({});
    setActiveHighlightPage(null);
    setRedactRegions({});
    setActiveRedactionPage(null);
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
    const toolId = firstReady?.id || group?.tools[0]?.id || "render";
    setActiveTool(toolId);
    updateActiveSession({ activeGroup: groupId, activeTool: toolId, editState: captureEditorState() });
  }

  function chooseTool(tool) {
    setActiveTool(tool.id);
    updateActiveSession({ activeGroup, activeTool: tool.id, editState: captureEditorState() });
    if (tool.id !== "rotate") {
      setRotateScope("selected");
    }
    if (tool.id !== "watermark") {
      setWatermarkScope("selected");
    }
    if (tool.id === "sign") {
      setWatermarkMode("image");
      setWatermarkScope("selected");
      setWatermarkPosition("bottom-right");
      setWatermarkAngle(0);
      setWatermarkSize(42);
      setWatermarkOpacity(0.9);
    }
    if (tool.id === "text") {
      setWatermarkMode("text");
      setWatermarkPreset("verified");
      setWatermarkScope("selected");
      setWatermarkPosition("center");
      setWatermarkAngle(0);
      setWatermarkSize(28);
      setWatermarkOpacity(1);
    }
    if (tool.id !== "digital_sign") {
      setSignatureReport(null);
    }
    if (!["extract", "delete", "rotate", "watermark", "text", "duplicate", "page_numbers"].includes(tool.id)) {
      setSelectedPages([]);
    }
    if (tool.id !== "draw") {
      setActiveDrawPage(null);
    }
    if (tool.id !== "highlight") {
      setActiveHighlightPage(null);
    }
    if (tool.id !== "redact") {
      setActiveRedactionPage(null);
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

  function selectReaderPage(pageNumber, event) {
    const additive = event.metaKey || event.ctrlKey;
    if (event.shiftKey && pageSelectionAnchorRef.current) {
      const start = Math.min(pageSelectionAnchorRef.current, pageNumber);
      const end = Math.max(pageSelectionAnchorRef.current, pageNumber);
      const range = Array.from({ length: end - start + 1 }, (_, index) => start + index);
      setSelectedPages((current) => additive ? [...new Set([...current, ...range])].sort((a, b) => a - b) : range);
      return;
    }
    pageSelectionAnchorRef.current = pageNumber;
    if (additive) {
      togglePage(pageNumber);
      return;
    }
    setSelectedPages([pageNumber]);
  }

  function beginDocumentEdit(key = "editor") {
    if (!activeDocument) {
      return;
    }
    const snapshot = captureEditorState();
    const now = Date.now();
    updateActiveSession((session) => {
      const history = session.draftUndo || [];
      const last = history[history.length - 1];
      const coalesced = last?.key === key && now - last.at < 500;
      return {
        dirty: true,
        draftUndo: coalesced ? history : [...history.slice(-49), { key, at: now, snapshot }],
        draftRedo: [],
      };
    });
  }

  function showRevision(nextSession, message) {
    const revision = currentRevision(nextSession);
    setResult(revision?.paths?.length ? { tool: revision.operationType, paths: revision.paths } : null);
    setActiveGroup("tools");
    setActiveTool("reader");
    restoreEditorState({});
    setPagePreview([]);
    setSelectedPages([]);
    updateActiveSession({ ...nextSession, activeGroup: "tools", activeTool: "reader", editState: {}, dirty: false });
    setStatus(message);
  }

  function undoDocumentChange() {
    if (isBusy || !activeDocument) {
      return;
    }
    const draftUndo = activeSession.draftUndo || [];
    if (draftUndo.length) {
      const previous = draftUndo[draftUndo.length - 1];
      const current = captureEditorState();
      restoreEditorState(previous.snapshot);
      updateActiveSession({
        dirty: draftUndo.length > 1,
        draftUndo: draftUndo.slice(0, -1),
        draftRedo: [...(activeSession.draftRedo || []), { key: previous.key, at: Date.now(), snapshot: current }],
      });
      setStatus("Undid unapplied edit");
      return;
    }
    if (activeSession.revisionIndex >= 0) {
      showRevision(undoRevisionState(activeSession), activeSession.revisionIndex === 0 ? "Returned to original" : "Previous revision restored");
    }
  }

  function redoDocumentChange() {
    if (isBusy || !activeDocument) {
      return;
    }
    const draftRedo = activeSession.draftRedo || [];
    if (draftRedo.length) {
      const next = draftRedo[draftRedo.length - 1];
      const current = captureEditorState();
      restoreEditorState(next.snapshot);
      updateActiveSession({
        dirty: true,
        draftUndo: [...(activeSession.draftUndo || []), { key: next.key, at: Date.now(), snapshot: current }],
        draftRedo: draftRedo.slice(0, -1),
      });
      setStatus("Redid unapplied edit");
      return;
    }
    if (canRedoRevision(activeSession)) {
      showRevision(redoRevisionState(activeSession), "Next revision restored");
    }
  }

  function selectAllPages() {
    setSelectedPages(pagePreview.map((page) => page.page));
  }

  function clearPages() {
    setSelectedPages([]);
  }

  function addRedactionRect(pageNumber, rect) {
    beginDocumentEdit("redaction");
    setRedactRegions((current) => ({
      ...current,
      [pageNumber]: [...(current[pageNumber] || []), rect],
    }));
    setActiveRedactionPage(pageNumber);
    setSelectedPages([pageNumber]);
    setResult(null);
    setStatus(`Redaction box added on page ${pageNumber}`);
  }

  function addHighlightRect(pageNumber, rect) {
    beginDocumentEdit("highlight");
    setHighlightRegions((current) => ({
      ...current,
      [pageNumber]: [...(current[pageNumber] || []), rect],
    }));
    setActiveHighlightPage(pageNumber);
    setSelectedPages([pageNumber]);
    setResult(null);
    setStatus(`Highlight added on page ${pageNumber}`);
  }

  function addDrawStroke(pageNumber, points) {
    beginDocumentEdit("drawing");
    setDrawStrokes((current) => ({
      ...current,
      [pageNumber]: [...(current[pageNumber] || []), { points }],
    }));
    setActiveDrawPage(pageNumber);
    setSelectedPages([pageNumber]);
    setResult(null);
    setStatus(`Drawing added on page ${pageNumber}`);
  }

  function removeRedactionRect(pageNumber, indexToRemove) {
    beginDocumentEdit("redaction");
    setRedactRegions((current) => {
      const next = { ...current };
      const pageRects = [...(next[pageNumber] || [])];
      pageRects.splice(indexToRemove, 1);
      if (pageRects.length) {
        next[pageNumber] = pageRects;
      } else {
        delete next[pageNumber];
      }
      return next;
    });
    setResult(null);
    setStatus(`Redaction box removed from page ${pageNumber}`);
  }

  function updateRedactionRect(pageNumber, indexToUpdate, rect) {
    beginDocumentEdit("redaction");
    setRedactRegions((current) => ({
      ...current,
      [pageNumber]: (current[pageNumber] || []).map((item, index) => index === indexToUpdate ? rect : item),
    }));
    setResult(null);
    setStatus(`Redaction box updated on page ${pageNumber}`);
  }

  function clearRedactionsForPage(pageNumber) {
    beginDocumentEdit("redaction");
    setRedactRegions((current) => {
      if (!current[pageNumber]?.length) {
        return current;
      }
      const next = { ...current };
      delete next[pageNumber];
      return next;
    });
    setResult(null);
    setStatus(`Cleared redactions on page ${pageNumber}`);
  }

  function clearAllRedactions() {
    beginDocumentEdit("redaction");
    setRedactRegions({});
    setResult(null);
    setStatus("All redaction boxes cleared");
  }

  function removeHighlightRect(pageNumber, indexToRemove) {
    beginDocumentEdit("highlight");
    setHighlightRegions((current) => {
      const next = { ...current };
      const pageRects = [...(next[pageNumber] || [])];
      pageRects.splice(indexToRemove, 1);
      if (pageRects.length) {
        next[pageNumber] = pageRects;
      } else {
        delete next[pageNumber];
      }
      return next;
    });
    setResult(null);
    setStatus(`Highlight removed from page ${pageNumber}`);
  }

  function updateHighlightRect(pageNumber, indexToUpdate, rect) {
    beginDocumentEdit("highlight");
    setHighlightRegions((current) => ({
      ...current,
      [pageNumber]: (current[pageNumber] || []).map((item, index) => index === indexToUpdate ? rect : item),
    }));
    setResult(null);
    setStatus(`Highlight updated on page ${pageNumber}`);
  }

  function clearHighlightsForPage(pageNumber) {
    beginDocumentEdit("highlight");
    setHighlightRegions((current) => {
      if (!current[pageNumber]?.length) {
        return current;
      }
      const next = { ...current };
      delete next[pageNumber];
      return next;
    });
    setResult(null);
    setStatus(`Highlights cleared for page ${pageNumber}`);
  }

  function clearAllHighlights() {
    beginDocumentEdit("highlight");
    setHighlightRegions({});
    setResult(null);
    setStatus("All highlight boxes cleared");
  }

  function removeLastDrawStroke(pageNumber) {
    beginDocumentEdit("drawing");
    setDrawStrokes((current) => {
      const next = { ...current };
      const pageStrokes = [...(next[pageNumber] || [])];
      pageStrokes.pop();
      if (pageStrokes.length) {
        next[pageNumber] = pageStrokes;
      } else {
        delete next[pageNumber];
      }
      return next;
    });
    setResult(null);
    setStatus(`Last drawing stroke removed from page ${pageNumber}`);
  }

  function clearDrawStrokesForPage(pageNumber) {
    beginDocumentEdit("drawing");
    setDrawStrokes((current) => {
      if (!current[pageNumber]?.length) {
        return current;
      }
      const next = { ...current };
      delete next[pageNumber];
      return next;
    });
    setResult(null);
    setStatus(`Drawing cleared for page ${pageNumber}`);
  }

  function clearAllDrawStrokes() {
    beginDocumentEdit("drawing");
    setDrawStrokes({});
    setResult(null);
    setStatus("All drawing strokes cleared");
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
    beginDocumentEdit("page-order");
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
    setSelectedPages([]);
    setResult(null);
    setStatus("Page order changed");
  }

  function resetPageOrder() {
    beginDocumentEdit("page-order");
    setPagePreview((current) => [...current].sort((a, b) => a.page - b.page));
    setSelectedPages([]);
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
    beginDocumentEdit("watermark-angle");
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
    beginDocumentEdit("watermark-image");
  }

  async function loadMetadata() {
    const requestOptions = { signal: previewAbortRef.current?.signal };
    try {
      const response = hasPaths
        ? await metadataViewPath(pathInputs, requestOptions)
        : await metadataViewUpload(uploadedFiles, requestOptions);
      const loaded = response?.metadata || {};
      setMetadata(loaded);
      setMetadataForm({
        title: loaded.Title || "",
        author: loaded.Author || "",
        subject: loaded.Subject || "",
        keywords: loaded.Keywords || "",
        creator: loaded.Creator || "",
        producer: loaded.Producer || "",
      });
      setStatus("Metadata loaded");
    } catch (err) {
      setStatus(`Metadata error: ${err.message}`);
    }
  }

  async function removeAllMetadata() {
    const requestOptions = { signal: previewAbortRef.current?.signal };
    try {
      const response = hasPaths
        ? await metadataPath(pathInputs, { remove_all: true }, requestOptions)
        : await metadataUpload(uploadedFiles, { remove_all: true }, requestOptions);
      const paths = outputPathsFromResult(response);
      setResult({ tool: activeTool, paths });
      materializeWorkingRevision("metadata", paths, {
        id: operationId(),
        documentId: activeDocumentId,
        sourceRevisionId: workingRevision?.id || "original",
        operationType: "metadata",
        targetPageScope: "entire-document",
        createdAt: new Date().toISOString(),
      });
      setStatus("Metadata removed in a new working revision");
    } catch (err) {
      setStatus(`Metadata error: ${err.message}`);
    }
  }

  async function runReaderSearch() {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchSummary("");
      setStatus("Enter text to search.");
      return;
    }
    if (!exactlyOnePdfSelected || mixedSources) {
      setStatus("Select exactly one PDF to search.");
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearchBusy(true);
    setStatus(`Searching for "${query}"...`);
    try {
      const response = hasPaths
        ? await searchTextPath(pathInputs, query, { signal: controller.signal })
        : await searchTextUpload(uploadedFiles, query, { signal: controller.signal });
      const matches = response.matches || [];
      setSearchResults(matches);
      setSearchSummary(
        matches.length
          ? `${response.total_matches} match${response.total_matches === 1 ? "" : "es"} on ${response.pages_with_matches} page${response.pages_with_matches === 1 ? "" : "s"}`
          : "No matches"
      );
      if (matches.length > 0) {
        setStatus(`Found ${response.total_matches} match${response.total_matches === 1 ? "" : "es"}`);
      } else {
        setStatus("No matching text found.");
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setStatus("Search cancelled");
        return;
      }
      setStatus(`Search error: ${err.message}`);
    } finally {
      if (searchAbortRef.current === controller) {
        searchAbortRef.current = null;
      }
      setSearchBusy(false);
    }
  }

  function clearReaderSearch() {
    searchAbortRef.current?.abort();
    setSearchQuery("");
    setSearchResults([]);
    setSearchSummary("");
    setSearchBusy(false);
    setStatus("Search cleared");
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
  if (["reader", "split", "render", "extract", "delete", "rotate", "reorder", "compress", "password", "repair", "watermark", "sign", "text", "digital_sign", "page_numbers", "crop", "metadata", "redact", "highlight", "draw", "image_text", "searchable"].includes(activeTool) && !exactlyOnePdfSelected) {
      return "Select exactly one PDF file.";
    }
    if (["extract", "delete", "duplicate", "crop"].includes(activeTool) && selectedPages.length === 0) {
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
    if (activeTool === "text" && watermarkScope === "selected" && selectedPages.length === 0) {
      return "Pick pages for the text stamp or switch to All pages.";
    }
    if (activeTool === "watermark" && watermarkMode === "text" && !watermarkText.trim()) {
      return "Enter watermark text.";
    }
    if (activeTool === "text" && !watermarkText.trim()) {
      return "Enter text to place on the page.";
    }
    if (activeTool === "watermark" && watermarkMode === "image" && !watermarkImageFile) {
      return "Choose a watermark image.";
    }
    if (activeTool === "sign" && !watermarkImageFile) {
      return "Choose a signature image.";
    }
    if (activeTool === "draw" && drawStrokeCount === 0) {
      return "Draw at least one pen stroke on a page preview.";
    }
    if (activeTool === "highlight" && highlightRegionCount === 0) {
      return "Draw at least one highlight box on a page preview.";
    }
    if (activeTool === "redact" && redactionRegionCount === 0) {
      return "Draw at least one redaction box on a page preview.";
    }
    return "";
  }

  async function cancelCurrentWork() {
    const jobId = activeSession.pendingJobId;
    if (jobId) {
      setStatus("Cancelling local processing...");
      try {
        const job = await cancelJob(jobId);
        if (job.status === "cancelled") {
          setStatus("Processing cancelled");
        } else {
          setStatus("Cancelling after the current processing step...");
        }
      } catch (err) {
        setStatus(`Unable to cancel the local job: ${err.message}`);
        return;
      }
      return;
    }
    previewAbortRef.current?.abort();
    actionAbortRef.current?.abort();
    setBusyLabel("");
    setBusyProgress(null);
    setPreviewBusy(false);
    setPageDragMode(null);
    setReorderDragPage(null);
    if (!jobId) {
      setStatus(isBusy ? "Stopped waiting; local processing may still finish" : "Current task cancelled");
    }
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
      if (job.status === "cancelled") {
        const error = new Error("Processing cancelled");
        error.name = "JobCancelled";
        throw error;
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

  function materializeWorkingRevision(tool, paths, operation) {
    const isWorkingPdf = materializedPdfTools.has(tool)
      && paths.length === 1
      && paths[0].toLowerCase().endsWith(".pdf");
    if (!isWorkingPdf) {
      return false;
    }
    const discardedPaths = (activeSession.revisions || [])
      .slice((activeSession.revisionIndex ?? -1) + 1)
      .flatMap((revision) => revision.paths || []);
    if (discardedPaths.length) {
      void cleanupResults(discardedPaths).catch(() => {});
    }
    const revision = { ...operation, id: operationId(), operationType: tool, paths, status: "ready" };
    const cleanEditorState = {
      ...captureEditorState(),
      pagePreview: [],
      drawStrokes: {},
      highlightRegions: {},
      redactRegions: {},
      activeDrawPage: null,
      activeHighlightPage: null,
      activeRedactionPage: null,
    };
    updateActiveSession((session) => ({
      ...commitRevisionState(session, revision),
      activeGroup: "tools",
      activeTool: "reader",
      editState: cleanEditorState,
      dirty: false,
      processing: false,
      pendingJobId: "",
      draftUndo: [],
      draftRedo: [],
      lastOperation: revision,
    }));
    setDrawStrokes({});
    setHighlightRegions({});
    setRedactRegions({});
    setActiveDrawPage(null);
    setActiveHighlightPage(null);
    setActiveRedactionPage(null);
    setPagePreview([]);
    setSelectedPages([]);
    setActiveGroup("tools");
    setActiveTool("reader");
    setStatus(`Working revision ${activeSession.revisionIndex + 2} ready for preview`);
    return true;
  }

  async function runActiveTool() {
    const readinessError = assertReady();
    if (readinessError) {
      setStatus(readinessError);
      return;
    }

    const submissionKey = `${activeDocumentId}:${activeSession.revisionVersion || 0}:${activeTool}`;
    if (activeSession.pendingJobId) {
      setStatus("Wait for the active local job to finish or cancel it first.");
      return;
    }
    if (activeSubmissionRef.current === submissionKey) {
      setStatus("That operation is already running.");
      return;
    }
    activeSubmissionRef.current = submissionKey;
    const operation = {
      id: operationId(),
      documentId: activeDocumentId,
      sourceRevisionId: workingRevision?.id || "original",
      operationType: activeTool,
      targetPageScope: pageSelectionLocked || documentWideTools.has(activeTool) || activeTool === "page_numbers" && !selectedPages.length
        ? "all"
        : pagesToRange(selectedPages) || `page-${readerPageIndex + 1}`,
      settings: {
        angle: watermarkAngle,
        color: ["draw", "highlight", "redact"].includes(activeTool)
          ? { draw: drawColor, highlight: highlightColor, redact: redactColor }[activeTool]
          : watermarkColor,
        compressionPreset: compressPreset,
        crop: activeTool === "crop" ? crop : undefined,
        imageName: watermarkImageFile?.name,
        opacity: { draw: drawOpacity, highlight: highlightOpacity }[activeTool] ?? watermarkOpacity,
        pageOrder: activeTool === "reorder" ? pagePreview.map((page) => page.page) : undefined,
        rotation: activeTool === "rotate" ? rotation : undefined,
        size: watermarkSize,
        text: ["text", "watermark"].includes(activeTool) ? watermarkText : undefined,
        thickness: activeTool === "draw" ? drawThickness : undefined,
      },
      createdAt: new Date().toISOString(),
    };
    updateActiveSession({ processing: true, pendingJobId: "", lastOperation: { ...operation, status: "processing" } });

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
              : activeTool === "text" && watermarkScope === "all"
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
        } else if (activeTool === "image_text") {
          response = hasPaths
            ? await ocrTextPath(pathInputs, ocrLanguage, requestOptions)
            : await ocrTextUpload(uploadedFiles, ocrLanguage, requestOptions);
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
        } else if (activeTool === "compress") {
          response = hasPaths
            ? await compressPdfPath(pathInputs, compressPreset, requestOptions)
            : await compressPdfUpload(uploadedFiles, compressPreset, requestOptions);
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
        } else if (activeTool === "sign") {
          const signPayload = {
            pages: pageRange,
            position: watermarkPosition,
            angle: watermarkAngle,
            size: watermarkSize,
            opacity: watermarkOpacity,
          };
          response = hasPaths
            ? await watermarkImagePath(pathInputs, watermarkImageFile, signPayload, requestOptions)
            : await watermarkImageUpload(uploadedFiles, watermarkImageFile, signPayload, requestOptions);
        } else if (activeTool === "text") {
          const textPayload = {
            text: watermarkText,
            mode: "text",
            preset: "verified",
            pages: pageRange,
            position: watermarkPosition,
            angle: watermarkAngle,
            size: watermarkSize,
            opacity: watermarkOpacity,
            color: watermarkColor,
          };
          response = hasPaths
            ? await watermarkTextPath(pathInputs, textPayload, requestOptions)
            : await watermarkTextUpload(uploadedFiles, textPayload, requestOptions);
        } else if (activeTool === "draw") {
          const drawPayload = {
            color: drawColor,
            opacity: drawOpacity,
            thickness: drawThickness,
            strokes: Object.entries(drawStrokes).flatMap(([page, strokes]) =>
              strokes.map((stroke) => ({ page: Number(page), points: stroke.points }))
            ),
          };
          response = hasPaths
            ? await drawPdfPath(pathInputs, drawPayload, requestOptions)
            : await drawPdfUpload(uploadedFiles, drawPayload, requestOptions);
        } else if (activeTool === "highlight") {
          const highlightPayload = {
            color: highlightColor,
            opacity: highlightOpacity,
            regions: Object.entries(highlightRegions).flatMap(([page, regions]) =>
              regions.map((region) => ({ page: Number(page), ...region }))
            ),
          };
          response = hasPaths
            ? await highlightPdfPath(pathInputs, highlightPayload, requestOptions)
            : await highlightPdfUpload(uploadedFiles, highlightPayload, requestOptions);
        } else if (activeTool === "crop") {
          const cropPayload = {
            pages: pageRange,
            left: crop.left,
            top: crop.top,
            right: crop.right,
            bottom: crop.bottom,
          };
          response = hasPaths
            ? await cropPdfPath(pathInputs, cropPayload, requestOptions)
            : await cropPdfUpload(uploadedFiles, cropPayload, requestOptions);
        } else if (activeTool === "redact") {
          const redactPayload = {
            color: redactColor,
            regions: Object.entries(redactRegions).flatMap(([page, regions]) =>
              regions.map((region) => ({ page: Number(page), ...region }))
            ),
          };
          response = hasPaths
            ? await redactPdfPath(pathInputs, redactPayload, requestOptions)
            : await redactPdfUpload(uploadedFiles, redactPayload, requestOptions);
        } else if (activeTool === "searchable") {
          response = hasPaths
            ? await searchablePdfPath(pathInputs, ocrLanguage, requestOptions)
            : await searchablePdfUpload(uploadedFiles, ocrLanguage, requestOptions);
        } else if (activeTool === "metadata") {
          const metadataPayload = {
            title: metadataForm.title,
            author: metadataForm.author,
            subject: metadataForm.subject,
            keywords: metadataForm.keywords,
            creator: metadataForm.creator,
            producer: metadataForm.producer,
            remove_all: false,
          };
          response = hasPaths
            ? await metadataPath(pathInputs, metadataPayload, requestOptions)
            : await metadataUpload(uploadedFiles, metadataPayload, requestOptions);
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
          updateActiveSession({ pendingJobId: response.job_id });
          response = await waitForJob(response.job_id, signal);
        }

        if (activeTool === "image_text") {
          setOcrTextPreview(response.text || "");
          setOcrPageCount(response.page_count || 0);
        }

        const paths = outputPathsFromResult(response);
        setResult({ tool: activeTool, paths });
        if (!materializeWorkingRevision(activeTool, paths, operation)) {
          updateActiveSession({ processing: false, pendingJobId: "", lastOperation: { ...operation, paths, status: "ready" } });
          setStatus(paths.length === 1 ? "Created 1 file" : `Created ${paths.length} files`);
        }
        pushHistoryEntry(activeTool, paths);
      } catch (err) {
        if (err.name === "JobCancelled") {
          updateActiveSession({ processing: false, pendingJobId: "", lastOperation: { ...operation, status: "cancelled" } });
          setStatus("Processing cancelled");
          return;
        }
        if (err.name === "AbortError") {
          updateActiveSession({ processing: false, pendingJobId: "", lastOperation: { ...operation, status: "waiting-stopped" } });
          setStatus("Stopped waiting; local processing may still finish");
          return;
        }
        updateActiveSession({ processing: false, pendingJobId: "", lastOperation: { ...operation, status: "error", error: err.message } });
        setStatus(`Error: ${err.message}`);
      }
    });
    activeSubmissionRef.current = "";
    updateActiveSession({ processing: false });
  }

  async function handleDownloadOne(path) {
    const exportsWorkingRevision = Boolean(workingRevision?.paths.includes(path));
    if (activeTool === "reader" && workingRevision && !exportsWorkingRevision) {
      setStatus("This result is not the revision currently shown in preview.");
      return;
    }
    await withBusy("Preparing download...", async () => {
      try {
        if (canUseDesktopBridge()) {
          const targetPath = await pickSavePathDialog(pathName(path));
          if (!targetPath) {
            setStatus("Save cancelled");
            return;
          }
          await copyFileToPath(path, targetPath);
          if (exportsWorkingRevision) {
            markExported(workingRevision.id);
          }
          setStatus("File saved");
          return;
        }

        await downloadResult(path);
        if (exportsWorkingRevision) {
          markExported(workingRevision.id);
        }
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
          await copyFileToPath(path, joinNativePath(outputFolder, pathName(path)));
        }
        if (workingRevision && paths.length === workingRevision.paths.length && paths.every((path) => workingRevision.paths.includes(path))) {
          markExported(workingRevision.id);
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
        <DropOverlay
          dragDepthRef={dragDepthRef}
          handleDrop={handleDrop}
          isBusy={isBusy}
          onBrowse={() => void openFiles()}
          onClose={() => setDropOverlayActive(false)}
        />
      )}

      {showSettings && (
        <SettingsDrawer
          canUseDesktop={canUseDesktopBridge()}
          exactlyOnePdfSelected={exactlyOnePdfSelected}
          exportResultsToFolder={exportResultsToFolder}
          handleDownloadOne={handleDownloadOne}
          handleDownloadZip={handleDownloadZip}
          handleRevealPath={handleRevealPath}
          isBusy={isBusy}
          jobHistory={jobHistory}
          loadPathItems={loadPathItems}
          onCancelCurrentWork={cancelCurrentWork}
          onChooseOutputFolder={() => void chooseOutputFolder()}
          onClearOutputFolder={() => setOutputFolder("")}
          onClose={() => setShowSettings(false)}
          onOpenFiles={() => void openFiles()}
          onReloadPreview={() => setPreviewTick((value) => value + 1)}
          onSetJobHistory={setJobHistory}
          onSetRecentFiles={setRecentFiles}
          outputFolder={outputFolder}
          recentFiles={recentFiles}
          showCancelAction={showCancelAction}
        />
      )}

      <BusyBar label={busyLabel} progress={busyProgress} />

      <HeaderRibbon
        actionLabel={actionLabel}
        activeDocumentName={activeDocument?.name}
        activeGroup={activeGroup}
        activeTool={activeTool}
        activeTools={activeTools}
        cancelCurrentWork={cancelCurrentWork}
        canRedoDocument={canRedoDocument}
        canUndoDocument={canUndoDocument}
        chooseGroup={chooseGroup}
        chooseTool={chooseTool}
        compressPreset={compressPreset}
        fileItems={fileItems}
        handleDownloadOne={handleDownloadOne}
        handleDownloadZip={handleDownloadZip}
        handleHealthCheck={handleHealthCheck}
        isBusy={isBusy}
        openFiles={() => void openFiles()}
        redoDocumentChange={redoDocumentChange}
        password={password}
        resultPaths={resultPaths}
        rotateScope={rotateScope}
        rotation={rotation}
        runActiveTool={runActiveTool}
        selectionLabel={selectionLabel}
        setCompressPreset={(value) => { beginDocumentEdit("compression"); setCompressPreset(value); }}
        setPassword={(value) => { beginDocumentEdit("password"); setPassword(value); }}
        setRotateScope={(value) => { beginDocumentEdit("rotation"); setRotateScope(value); }}
        setRotation={(value) => { beginDocumentEdit("rotation"); setRotation(value); }}
        setShowSettings={setShowSettings}
        showCancelAction={showCancelAction}
        sourceMode={sourceMode}
        status={status}
        themeMode={themeMode}
        undoDocumentChange={undoDocumentChange}
        setThemeMode={setThemeMode}
      />

      <DocumentTabs
          activeDocumentId={activeDocumentId}
          documents={fileItems}
          fileInputRef={fileInputRef}
          isBusy={isBusy}
          onActivate={activateDocument}
          onAdd={() => void openFiles()}
          onClose={removeDocument}
          sessions={documentSessions}
          updateFiles={updateFiles}
      />

      <section className="workspace">
        <DocumentPanel
          activeDocument={activeDocument}
          activeTool={activeTool}
          activeToolInfo={activeToolInfo}
          beginPageDragSelection={beginPageDragSelection}
          beginWatermarkDial={beginWatermarkDial}
          bottomSpacerHeight={bottomSpacerHeight}
          clearPages={clearPages}
          continuePageDragSelection={continuePageDragSelection}
          currentReaderIndex={currentReaderIndex}
          currentReaderPage={currentReaderPage}
          dragDepthRef={dragDepthRef}
          drawColor={drawColor}
          drawOpacity={drawOpacity}
          drawStrokes={drawStrokes}
          drawThickness={drawThickness}
          endPageDragSelection={endPageDragSelection}
          exactlyOnePdfSelected={exactlyOnePdfSelected}
          fileItems={fileItems}
          internalDragRef={internalDragRef}
          isBusy={isBusy}
          movePreviewPage={movePreviewPage}
          onOpenFiles={() => void openFiles()}
          pagePreview={pagePreview}
          pageSelectionLocked={pageSelectionLocked}
          pageToolActive={pageToolActive}
          selectReaderPage={selectReaderPage}
          previewBusy={previewBusy}
          previewPage={previewPage}
          previewPageLabel={previewPageLabel}
          previewPageNumber={previewPageNumber}
          previewPaperStyle={previewPaperStyle}
          previewScrollRef={previewScrollRef}
          previewSessionId={previewSessionId}
          readerActive={readerActive}
          readerPageLabel={readerPageLabel}
          readerZoom={readerZoom}
          revisionStateLabel={documentRevisionLabel}
          searchBusy={searchBusy}
          searchQuery={searchQuery}
          searchResults={searchResults}
          searchSummary={searchSummary}
          reorderActive={reorderActive}
          reorderChanged={reorderChanged}
          reorderDragPage={reorderDragPage}
          resetPageOrder={resetPageOrder}
          rotateAppliesToAll={rotateAppliesToAll}
          rotation={rotation}
          selectAllPages={selectAllPages}
          selectedPages={selectedPages}
          selectionLabel={selectionLabel}
          crop={crop}
          cropScope={cropScope}
          highlightColor={highlightColor}
          highlightOpacity={highlightOpacity}
          highlightRegions={highlightRegions}
          loadMetadata={loadMetadata}
          beginDocumentEdit={beginDocumentEdit}
          metadata={metadata}
          metadataForm={metadataForm}
          ocrEngineHint={ocrEngineHint}
          ocrLanguage={ocrLanguage}
          ocrLanguages={ocrLanguages}
          ocrPageCount={ocrPageCount}
          ocrTextPreview={ocrTextPreview}
          removeAllMetadata={removeAllMetadata}
          redactColor={redactColor}
          redactRegions={redactRegions}
          activeDrawPage={activeDrawPage}
          activeHighlightPage={activeHighlightPage}
          activeRedactionPage={activeRedactionPage}
          addDrawStroke={addDrawStroke}
          addHighlightRect={addHighlightRect}
          addRedactionRect={addRedactionRect}
          removeLastDrawStroke={removeLastDrawStroke}
          removeHighlightRect={removeHighlightRect}
          updateHighlightRect={updateHighlightRect}
          clearDrawStrokesForPage={clearDrawStrokesForPage}
          clearAllDrawStrokes={clearAllDrawStrokes}
          clearHighlightsForPage={clearHighlightsForPage}
          clearAllHighlights={clearAllHighlights}
          removeRedactionRect={removeRedactionRect}
          updateRedactionRect={updateRedactionRect}
          clearRedactionsForPage={clearRedactionsForPage}
          clearAllRedactions={clearAllRedactions}
          setDropOverlayActive={setDropOverlayActive}
          setActiveDrawPage={setActiveDrawPage}
          setActiveHighlightPage={setActiveHighlightPage}
          setActiveRedactionPage={setActiveRedactionPage}
          setDrawColor={setDrawColor}
          setDrawOpacity={setDrawOpacity}
          setDrawThickness={setDrawThickness}
          setHighlightColor={setHighlightColor}
          setHighlightOpacity={setHighlightOpacity}
          setOcrLanguage={setOcrLanguage}
          setReaderPageIndex={setReaderPageIndex}
          setReaderZoom={setReaderZoom}
          setSearchQuery={setSearchQuery}
          setRedactColor={setRedactColor}
          setReorderDragPage={setReorderDragPage}
          setCrop={setCrop}
          setCropScope={setCropScope}
          setMetadataForm={setMetadataForm}
          setWatermarkAngle={setWatermarkAngle}
          setWatermarkColor={setWatermarkColor}
          setWatermarkImageFile={setWatermarkImageFile}
          setWatermarkMode={setWatermarkMode}
          setWatermarkOpacity={setWatermarkOpacity}
          setWatermarkPosition={setWatermarkPosition}
          setWatermarkPreset={setWatermarkPreset}
          setWatermarkScope={setWatermarkScope}
          setWatermarkSize={setWatermarkSize}
          setWatermarkText={setWatermarkText}
          signatureBusy={signatureBusy}
          signatureReport={signatureReport}
          togglePage={togglePage}
          signAllPages={signAllPages}
          textAllPages={textAllPages}
          topSpacerHeight={topSpacerHeight}
          runReaderSearch={runReaderSearch}
          clearReaderSearch={clearReaderSearch}
          updateWatermarkImage={updateWatermarkImage}
          visiblePages={visiblePages}
          visibleStartIndex={visibleStartIndex}
          watermarkAllPages={watermarkAllPages}
          watermarkAngle={watermarkAngle}
          watermarkColor={watermarkColor}
          watermarkDialRef={watermarkDialRef}
          watermarkImageFile={watermarkImageFile}
          watermarkImageInputRef={watermarkImageInputRef}
          watermarkImagePreview={watermarkImagePreview}
          watermarkMode={watermarkMode}
          watermarkOpacity={watermarkOpacity}
          watermarkPlacementStyle={watermarkPlacementStyle}
          watermarkPosition={watermarkPosition}
          watermarkPreset={watermarkPreset}
          watermarkScope={watermarkScope}
          watermarkSize={watermarkSize}
          watermarkText={watermarkText}
        />
      </section>

      <StatusBar
        status={status}
      />
    </main>
  );
}
