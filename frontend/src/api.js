// Thin client for talking to the local Python sidecar.

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

async function postUpload(path, files, fields, options = {}) {
  const { base, token } = sidecarBase();
  const res = await fetch(`${base}${path}`, {
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
  const res = await fetch(`${base}${path}`, {
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

export function pdfToTextUpload(files, options) {
  return postUpload("/organize/pdf-to-text-upload", files, undefined, options);
}

export function pdfToTextPath(paths, options) {
  return postJson("/organize/pdf-to-text", { input_paths: paths }, options);
}

export function previewPdfUpload(files, options) {
  return postUpload("/organize/preview-pdf-upload", files, undefined, options);
}

export function previewPdfPath(paths, options) {
  return postJson("/organize/preview-pdf", { input_paths: paths }, options);
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

export function passwordProtectUpload(files, password, options) {
  return postUpload("/organize/password-protect-upload", files, { password }, options);
}

export function passwordProtectPath(paths, password, options) {
  return postJson(`/organize/password-protect?password=${encodeURIComponent(password)}`, { input_paths: paths }, options);
}

export function removeMetadataUpload(files, options) {
  return postUpload("/organize/remove-metadata-upload", files, undefined, options);
}

export function removeMetadataPath(paths, options) {
  return postJson("/organize/remove-metadata", { input_paths: paths }, options);
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
