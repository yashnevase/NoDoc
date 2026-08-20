// Thin client for talking to the local Python sidecar.

function desktopInvoke(command, args = {}) {
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (!invoke) {
    throw new Error("Desktop bridge is not available");
  }
  return invoke(command, args);
}

export function canUseDesktopBridge() {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__?.invoke === "function";
}

function sidecarBase() {
  const cfg = window.__PRIVATEPDF__;
  if (cfg?.port && cfg?.token) {
    return { base: `http://127.0.0.1:${cfg.port}`, token: cfg.token };
  }

  const port = import.meta.env.VITE_PRIVATEPDF_PORT;
  const token = import.meta.env.VITE_PRIVATEPDF_TOKEN;
  if (!port || !token) {
    throw new Error("Sidecar connection info not available yet");
  }

  return { base: `http://127.0.0.1:${port}`, token };
}

async function readJson(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return body;
}

function uploadForm(files, fields = {}) {
  const form = new FormData();
  files.forEach((file) => {
    form.append("files", file);
  });
  Object.entries(fields).forEach(([key, value]) => {
    form.append(key, String(value));
  });
  return form;
}

function buildRequestPath(path, options = {}) {
  if (!options.asyncJob) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}async_job=true`;
}

async function postUpload(path, files, fields, options = {}) {
  const { base, token } = sidecarBase();
  const res = await fetch(`${base}${buildRequestPath(path, options)}`, {
    method: "POST",
    headers: {
      "x-privatepdf-token": token,
    },
    body: uploadForm(files, fields),
    signal: options.signal,
  });
  return readJson(res);
}

async function postJson(path, body, options = {}) {
  const { base, token } = sidecarBase();
  const res = await fetch(`${base}${buildRequestPath(path, options)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-privatepdf-token": token,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  return readJson(res);
}

async function postForm(path, form, options = {}) {
  const { base, token } = sidecarBase();
  const res = await fetch(`${base}${buildRequestPath(path, options)}`, {
    method: "POST",
    headers: {
      "x-privatepdf-token": token,
    },
    body: form,
    signal: options.signal,
  });
  return readJson(res);
}

function fileNameFromDisposition(disposition, fallback) {
  const match = /filename="?([^"]+)"?/i.exec(disposition || "");
  return match?.[1] || fallback;
}

async function saveBlobResponse(res, fallbackName) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Download failed: ${res.status}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileNameFromDisposition(res.headers.get("content-disposition"), fallbackName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function checkHealth(options = {}) {
  const { base } = sidecarBase();
  const res = await fetch(`${base}/health`, { signal: options.signal });
  return readJson(res);
}

export async function getRecentFiles(options = {}) {
  const { base, token } = sidecarBase();
  const res = await fetch(`${base}/library/recent`, {
    headers: {
      "x-privatepdf-token": token,
    },
    signal: options.signal,
  });
  return readJson(res);
}

export async function saveRecentFiles(names, options = {}) {
  const { base, token } = sidecarBase();
  const res = await fetch(`${base}/library/recent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-privatepdf-token": token,
    },
    body: JSON.stringify({ names }),
    signal: options.signal,
  });
  return readJson(res);
}

export async function getJobHistory(options = {}) {
  const { base, token } = sidecarBase();
  const res = await fetch(`${base}/library/history`, {
    headers: {
      "x-privatepdf-token": token,
    },
    signal: options.signal,
  });
  return readJson(res);
}

export async function getJobStatus(jobId, options = {}) {
  const { base, token } = sidecarBase();
  const res = await fetch(`${base}/results/jobs/${encodeURIComponent(jobId)}`, {
    headers: {
      "x-privatepdf-token": token,
    },
    signal: options.signal,
  });
  return readJson(res);
}

export function pickFilesDialog() {
  return desktopInvoke("pick_files");
}

export function pickSavePathDialog(defaultName) {
  return desktopInvoke("pick_save_path", { defaultName });
}

export function pickFolderDialog() {
  return desktopInvoke("pick_folder");
}

export function copyFileToPath(sourcePath, targetPath) {
  return desktopInvoke("copy_file_to_path", { sourcePath, targetPath });
}

export function revealPath(path) {
  return desktopInvoke("reveal_path", { path });
}

export function mergeUploadedFiles(files, options) {
  return postUpload("/organize/merge-upload", files, undefined, options);
}

export function mergePathFiles(paths, options) {
  return postJson("/organize/merge", { input_paths: paths }, options);
}

export function imagesToPdfUpload(files, options) {
  return postUpload("/organize/images-to-pdf-upload", files, undefined, options);
}

export function imagesToPdfPaths(paths, options) {
  return postJson("/organize/images-to-pdf", { input_paths: paths }, options);
}

export function splitPdfUpload(files, options) {
  return postUpload("/organize/split-pdf-upload", files, undefined, options);
}

export function splitPdfPath(paths, options) {
  return postJson("/organize/split-pdf", { input_paths: paths }, options);
}

export function pdfToImagesUpload(files, options) {
  return postUpload("/organize/pdf-to-images-upload", files, undefined, options);
}

export function pdfToImagesPath(paths, options) {
  return postJson("/organize/pdf-to-images", { input_paths: paths }, options);
}

export function previewPdfUpload(files, options) {
  return postUpload("/organize/preview-pdf-upload", files, undefined, options);
}

export function previewPdfPath(paths, options) {
  return postJson("/organize/preview-pdf", { input_paths: paths }, options);
}

export function previewPdfManifestUpload(files, options) {
  return postUpload("/organize/preview-manifest-upload", files, undefined, options);
}

export function previewPdfManifestPath(paths, options) {
  return postJson("/organize/preview-manifest", { input_paths: paths }, options);
}

export async function previewPdfPage(previewIdOrPath, page, options = {}) {
  const { base, token } = sidecarBase();
  const params = new URLSearchParams({ page: String(page) });
  if (previewIdOrPath) {
    const looksLikeFilePath =
      /[\\/]/.test(previewIdOrPath) || /^[A-Za-z]:[\\/]/.test(previewIdOrPath);
    params.set(looksLikeFilePath ? "path" : "preview_id", previewIdOrPath);
  }
  if (typeof options.scale === "number") {
    params.set("scale", String(options.scale));
  }
  const res = await fetch(`${base}/organize/preview-page?${params.toString()}`, {
    headers: {
      "x-privatepdf-token": token,
    },
    signal: options.signal,
  });
  return readJson(res);
}

export function extractPagesUpload(files, pages, options) {
  return postUpload("/organize/extract-pages-upload", files, { pages }, options);
}

export function extractPagesPath(paths, pages, options) {
  return postJson(`/organize/extract-pages?pages=${encodeURIComponent(pages)}`, { input_paths: paths }, options);
}

export function deletePagesUpload(files, pages, options) {
  return postUpload("/organize/delete-pages-upload", files, { pages }, options);
}

export function deletePagesPath(paths, pages, options) {
  return postJson(`/organize/delete-pages?pages=${encodeURIComponent(pages)}`, { input_paths: paths }, options);
}

export function rotatePdfUpload(files, degrees, pages, options) {
  return postUpload("/organize/rotate-pdf-upload", files, { degrees, pages }, options);
}

export function rotatePdfPath(paths, degrees, pages, options) {
  return postJson(`/organize/rotate-pdf?degrees=${degrees}&pages=${encodeURIComponent(pages)}`, { input_paths: paths }, options);
}

export function reorderPagesUpload(files, order, options) {
  return postUpload("/organize/reorder-pages-upload", files, { order }, options);
}

export function reorderPagesPath(paths, order, options) {
  return postJson(`/organize/reorder-pages?order=${encodeURIComponent(order)}`, { input_paths: paths }, options);
}

export function reversePagesUpload(files, options) {
  return postUpload("/organize/reverse-pages-upload", files, undefined, options);
}

export function reversePagesPath(paths, options) {
  return postJson("/organize/reverse-pages", { input_paths: paths }, options);
}

export function duplicatePagesUpload(files, pages, options) {
  return postUpload("/organize/duplicate-pages-upload", files, { pages }, options);
}

export function duplicatePagesPath(paths, pages, options) {
  return postJson(`/organize/duplicate-pages?pages=${encodeURIComponent(pages)}`, { input_paths: paths }, options);
}

export function pageNumbersUpload(files, payload, options) {
  return postUpload("/organize/page-numbers-upload", files, payload, options);
}

export function pageNumbersPath(paths, payload, options) {
  const params = new URLSearchParams();
  params.set("pages", payload.pages || "");
  params.set("position", payload.position || "bottom-right");
  params.set("size", String(payload.size ?? 12));
  params.set("opacity", String(payload.opacity ?? 0.7));
  params.set("color", payload.color || "#b02730");
  params.set("prefix", payload.prefix || "");
  params.set("suffix", payload.suffix || "");
  params.set("start", String(payload.start ?? 1));
  return postJson(`/organize/page-numbers?${params.toString()}`, { input_paths: paths }, options);
}

export function cropPdfUpload(files, payload, options) {
  return postUpload("/organize/crop-pdf-upload", files, payload, options);
}

export function cropPdfPath(paths, payload, options) {
  const params = new URLSearchParams();
  params.set("pages", payload.pages || "");
  params.set("left", String(payload.left ?? 0));
  params.set("top", String(payload.top ?? 0));
  params.set("right", String(payload.right ?? 0));
  params.set("bottom", String(payload.bottom ?? 0));
  return postJson(`/organize/crop-pdf?${params.toString()}`, { input_paths: paths }, options);
}

export function redactPdfUpload(files, payload, options) {
  return postUpload("/organize/redact-pdf-upload", files, {
    regions: JSON.stringify(payload.regions || []),
    color: payload.color || "#000000",
  }, options);
}

export function redactPdfPath(paths, payload, options) {
  return postJson("/organize/redact-pdf", {
    input_paths: paths,
    regions: payload.regions || [],
    color: payload.color || "#000000",
  }, options);
}

export function highlightPdfUpload(files, payload, options) {
  return postUpload("/organize/highlight-pdf-upload", files, {
    regions: JSON.stringify(payload.regions || []),
    color: payload.color || "#f2cd53",
    opacity: payload.opacity ?? 0.34,
  }, options);
}

export function highlightPdfPath(paths, payload, options) {
  return postJson("/organize/highlight-pdf", {
    input_paths: paths,
    regions: payload.regions || [],
    color: payload.color || "#f2cd53",
    opacity: payload.opacity ?? 0.34,
  }, options);
}

export function drawPdfUpload(files, payload, options) {
  return postUpload("/organize/draw-pdf-upload", files, {
    strokes: JSON.stringify(payload.strokes || []),
    color: payload.color || "#b02730",
    opacity: payload.opacity ?? 0.92,
    thickness: payload.thickness ?? 3,
  }, options);
}

export function drawPdfPath(paths, payload, options) {
  return postJson("/organize/draw-pdf", {
    input_paths: paths,
    strokes: payload.strokes || [],
    color: payload.color || "#b02730",
    opacity: payload.opacity ?? 0.92,
    thickness: payload.thickness ?? 3,
  }, options);
}

export function metadataViewPath(paths, options) {
  return postJson("/organize/metadata-view", { input_paths: paths }, options);
}

export function metadataPath(paths, payload, options) {
  return postJson("/organize/metadata", { input_paths: paths, ...payload }, options);
}

export function metadataViewUpload(files, options) {
  return postUpload("/organize/metadata-view-upload", files, undefined, options);
}

export function metadataUpload(files, payload, options) {
  return postUpload("/organize/metadata-upload", files, payload, options);
}

export function searchTextPath(paths, query, options) {
  return postJson("/organize/search-text", { input_paths: paths, query }, options);
}

export function searchTextUpload(files, query, options) {
  return postUpload("/organize/search-text-upload", files, { query }, options);
}

export function ocrTextPath(paths, lang, options) {
  return postJson("/organize/ocr-text", { input_paths: paths, lang }, options);
}

export function ocrTextUpload(files, lang, options) {
  return postUpload("/organize/ocr-text-upload", files, { lang }, options);
}

export function searchablePdfPath(paths, lang, options) {
  return postJson("/organize/searchable-pdf", { input_paths: paths, lang }, options);
}

export function searchablePdfUpload(files, lang, options) {
  return postUpload("/organize/searchable-pdf-upload", files, { lang }, options);
}

export function passwordProtectUpload(files, password, options) {
  return postUpload("/organize/password-protect-upload", files, { password }, options);
}

export function passwordProtectPath(paths, password, options) {
  return postJson(`/organize/password-protect?password=${encodeURIComponent(password)}`, { input_paths: paths }, options);
}

export function repairPdfUpload(files, options) {
  return postUpload("/organize/repair-pdf-upload", files, undefined, options);
}

export function repairPdfPath(paths, options) {
  return postJson("/organize/repair-pdf", { input_paths: paths }, options);
}

export function compressPdfUpload(files, preset, options) {
  return postUpload("/organize/compress-pdf", files, { preset }, options);
}

export function compressPdfPath(paths, preset, options) {
  return postJson(`/organize/compress-pdf?preset=${encodeURIComponent(preset || "balanced")}`, { input_paths: paths }, options);
}

export function signatureReportPath(paths, options) {
  return postJson("/organize/signature-report", { input_paths: paths }, options);
}

export function signatureReportUpload(files, options) {
  return postUpload("/organize/signature-report-upload", files, undefined, options);
}

function watermarkFields(payload) {
  return {
    text: payload.text,
    mode: payload.mode || "text",
    preset: payload.preset || "verified",
    pages: payload.pages || "",
    position: payload.position || "center",
    angle: payload.angle,
    size: payload.size,
    opacity: payload.opacity,
    color: payload.color,
  };
}

export function watermarkTextUpload(files, payload, options) {
  return postUpload("/organize/watermark-text-upload", files, watermarkFields(payload), options);
}

export function watermarkTextPath(paths, payload, options) {
  const params = new URLSearchParams();
  params.set("text", payload.text);
  params.set("mode", payload.mode || "text");
  params.set("preset", payload.preset || "verified");
  params.set("pages", payload.pages || "");
  params.set("position", payload.position || "center");
  params.set("angle", String(payload.angle));
  params.set("size", String(payload.size));
  params.set("opacity", String(payload.opacity));
  params.set("color", payload.color || "#b02730");
  return postJson(`/organize/watermark-text?${params.toString()}`, { input_paths: paths }, options);
}

export function watermarkImageUpload(files, imageFile, payload, options) {
  const form = new FormData();
  files.forEach((file) => {
    form.append("files", file);
  });
  form.append("image", imageFile);
  form.append("pages", payload.pages || "");
  form.append("position", payload.position || "center");
  form.append("angle", String(payload.angle));
  form.append("size", String(payload.size));
  form.append("opacity", String(payload.opacity));
  return postForm("/organize/watermark-image-upload", form, options);
}

export function watermarkImagePath(paths, imageFile, payload, options) {
  const form = new FormData();
  form.append("input_path", paths[0] || "");
  form.append("image", imageFile);
  form.append("pages", payload.pages || "");
  form.append("position", payload.position || "center");
  form.append("angle", String(payload.angle));
  form.append("size", String(payload.size));
  form.append("opacity", String(payload.opacity));
  return postForm("/organize/watermark-image-upload", form, options);
}

export async function downloadResult(path) {
  const { base, token } = sidecarBase();
  const res = await fetch(`${base}/results/download?path=${encodeURIComponent(path)}`, {
    headers: {
      "x-privatepdf-token": token,
    },
  });
  await saveBlobResponse(res, path.split(/[\\/]/).pop() || "nodoc-result");
}

export async function downloadZip(paths) {
  const { base, token } = sidecarBase();
  const res = await fetch(`${base}/results/zip`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-privatepdf-token": token,
    },
    body: JSON.stringify({ paths }),
  });
  await saveBlobResponse(res, "nodoc-results.zip");
}
