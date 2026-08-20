import { useEffect, useRef, useState } from "react";

import { BusyBar } from "./components/BusyBar";
import { CropEditor } from "./components/CropEditor";
import { DocumentPanel } from "./components/DocumentPanel";
import { DropOverlay } from "./components/DropOverlay";
import { FilePanel } from "./components/FilePanel";
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
  checkHealth,
  copyFileToPath,
  deletePagesPath,
  deletePagesUpload,
  downloadResult,
  downloadZip,
  extractPagesPath,
  extractPagesUpload,
  getJobStatus,
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
  splitPdfPath,
  splitPdfUpload,
  watermarkImagePath,
  watermarkImageUpload,
  watermarkTextPath,
  watermarkTextUpload,
} from "./api";
import { useGlobalFileDrop } from "./hooks/useGlobalFileDrop";
import { useDocumentViewModel } from "./hooks/useDocumentViewModel";
import { useMenuEvents } from "./hooks/useMenuEvents";
import { useOpenedFiles } from "./hooks/useOpenedFiles";
import { usePreviewManifest } from "./hooks/usePreviewManifest";
import { usePreviewViewport } from "./hooks/usePreviewViewport";
import { useReaderNavigation } from "./hooks/useReaderNavigation";
import { useSignatureReport } from "./hooks/useSignatureReport";
import { useWatermarkDial } from "./hooks/useWatermarkDial";
import {
  hasExtension,
  outputPathsFromResult,
  pagesToRange,
  pathItems,
  pathName,
  sleep,
  uploadItems,
  normalizeAngle,
} from "./utils/fileHelpers";

export default function App() {
  const [fileItems, setFileItems] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dropOverlayActive, setDropOverlayActive] = useState(false);
  const [activeGroup, setActiveGroup] = useState("convert");
  const [activeTool, setActiveTool] = useState("render");
  const [selectedPages, setSelectedPages] = useState([]);
  const [pagePreview, setPagePreview] = useState([]);
  const [readerPageIndex, setReaderPageIndex] = useState(0);
  const [readerZoom, setReaderZoom] = useState(1);
  const [rotation, setRotation] = useState(90);
  const [rotateScope, setRotateScope] = useState("selected");
  const [compressPreset, setCompressPreset] = useState("balanced");
  const [cropScope, setCropScope] = useState("selected");
  const [crop, setCrop] = useState({ left: 0, top: 0, right: 0, bottom: 0 });
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
  const {
    bottomSpacerHeight,
    currentReaderIndex,
    currentReaderPage,
    previewPage,
    previewPageLabel,
    previewPageNumber,
    previewPaperStyle,
    readerPageLabel,
    readerPaperStyle,
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
  const pageToolActive = ["extract", "delete", "rotate", "watermark", "duplicate", "crop", "metadata"].includes(activeTool);
  const reorderActive = activeTool === "reorder";
  const watermarkAllPages = activeTool === "watermark" && watermarkScope === "all";
  const cropAllPages = activeTool === "crop" && cropScope === "all";
  const reorderChanged = pagePreview.length > 0 && pagePreview.some((page, index) => page.page !== index + 1);
  const rotateAppliesToAll = activeTool === "rotate" && rotateScope === "all";
  const pageSelectionLocked = rotateAppliesToAll || watermarkAllPages || cropAllPages;
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
  const { rememberRecentFiles, pushHistoryEntry } = useWorkspacePersistence({
    activeGroup,
    activeTool,
    compressPreset,
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
    watermarkAngle,
    watermarkColor,
    watermarkMode,
    watermarkOpacity,
    watermarkPosition,
    watermarkPreset,
    watermarkScope,
    watermarkSize,
  });
  usePreviewViewport({
    activeTool,
    exactlyOnePdfSelected,
    pagePreviewLength: pagePreview.length,
    previewBusy,
    previewScrollRef,
    setPreviewViewport,
  });
  useOpenedFiles({
    rememberRecentFiles,
    setFileItems,
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
  useReaderNavigation({
    pagePreviewLength: pagePreview.length,
    readerActive,
    setReaderPageIndex,
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
    setSelectedPages([]);
    setResult(null);
    setStatus("Page order changed");
  }

  function resetPageOrder() {
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
      setResult({ tool: activeTool, paths: outputPathsFromResult(response) });
      setStatus("Metadata removed");
    } catch (err) {
      setStatus(`Metadata error: ${err.message}`);
    }
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
  if (["reader", "split", "render", "extract", "delete", "rotate", "reorder", "compress", "password", "repair", "watermark", "digital_sign", "page_numbers", "crop", "metadata"].includes(activeTool) && !exactlyOnePdfSelected) {
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
        activeGroup={activeGroup}
        activeTool={activeTool}
        activeTools={activeTools}
        cancelCurrentWork={cancelCurrentWork}
        chooseGroup={chooseGroup}
        chooseTool={chooseTool}
        compressPreset={compressPreset}
        currentReaderIndex={currentReaderIndex}
        exportResultsToFolder={exportResultsToFolder}
        fileItems={fileItems}
        handleDownloadOne={handleDownloadOne}
        handleDownloadZip={handleDownloadZip}
        handleHealthCheck={handleHealthCheck}
        handleRevealPath={handleRevealPath}
        isBusy={isBusy}
        loadPathItems={loadPathItems}
        openFiles={() => void openFiles()}
        outputFolder={outputFolder}
        pagePreview={pagePreview}
        password={password}
        readerActive={readerActive}
        readerZoom={readerZoom}
        resultPaths={resultPaths}
        rotateScope={rotateScope}
        rotation={rotation}
        runActiveTool={runActiveTool}
        selectionLabel={selectionLabel}
        setCompressPreset={setCompressPreset}
        setPassword={setPassword}
        setReaderPageIndex={setReaderPageIndex}
        setReaderZoom={setReaderZoom}
        setRotateScope={setRotateScope}
        setRotation={setRotation}
        setShowSettings={setShowSettings}
        showCancelAction={showCancelAction}
        sourceMode={sourceMode}
        status={status}
      />

      <section className="workspace">
        <FilePanel
          clearFiles={clearFiles}
          fileInputRef={fileInputRef}
          fileItems={fileItems}
          fileNames={fileNames}
          handleDrop={handleDrop}
          isBusy={isBusy}
          isDragging={isDragging}
          onBrowse={() => void openFiles()}
          onDragState={setIsDragging}
          removeFileAt={removeFileAt}
          updateFiles={updateFiles}
        />

        <DocumentPanel
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
          endPageDragSelection={endPageDragSelection}
          exactlyOnePdfSelected={exactlyOnePdfSelected}
          fileItems={fileItems}
          internalDragRef={internalDragRef}
          isBusy={isBusy}
          movePreviewPage={movePreviewPage}
          pagePreview={pagePreview}
          pageSelectionLocked={pageSelectionLocked}
          pageToolActive={pageToolActive}
          previewBusy={previewBusy}
          previewPage={previewPage}
          previewPageLabel={previewPageLabel}
          previewPageNumber={previewPageNumber}
          previewPaperStyle={previewPaperStyle}
          previewScrollRef={previewScrollRef}
          previewSessionId={previewSessionId}
          readerActive={readerActive}
          readerPageLabel={readerPageLabel}
          readerPaperStyle={readerPaperStyle}
          readerZoom={readerZoom}
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
          loadMetadata={loadMetadata}
          metadata={metadata}
          metadataForm={metadataForm}
          removeAllMetadata={removeAllMetadata}
          setDropOverlayActive={setDropOverlayActive}
          setReaderPageIndex={setReaderPageIndex}
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
          topSpacerHeight={topSpacerHeight}
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
        exportResultsToFolder={exportResultsToFolder}
        handleDownloadOne={handleDownloadOne}
        handleDownloadZip={handleDownloadZip}
        handleRevealPath={handleRevealPath}
        isBusy={isBusy}
        loadPathItems={loadPathItems}
        outputFolder={outputFolder}
        resultPaths={resultPaths}
        status={status}
      />
    </main>
  );
}
