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

async function postUpload(path, files, fields) {
  const { base, token } = sidecarBase();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "x-privatepdf-token": token,
    },
    body: uploadForm(files, fields),
  });
  return readJson(res);
}

async function postJson(path, body) {
  const { base, token } = sidecarBase();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-privatepdf-token": token,
    },
    body: JSON.stringify(body),
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

export async function checkHealth() {
  const { base } = sidecarBase();
  const res = await fetch(`${base}/health`);
  return readJson(res);
}

export function mergeUploadedFiles(files) {
  return postUpload("/organize/merge-upload", files);
}

export function mergePathFiles(paths) {
  return postJson("/organize/merge", { input_paths: paths });
}

export function imagesToPdfUpload(files) {
  return postUpload("/organize/images-to-pdf-upload", files);
}

export function imagesToPdfPaths(paths) {
  return postJson("/organize/images-to-pdf", { input_paths: paths });
}

export function splitPdfUpload(files) {
  return postUpload("/organize/split-pdf-upload", files);
}

export function splitPdfPath(paths) {
  return postJson("/organize/split-pdf", { input_paths: paths });
}

export function pdfToImagesUpload(files) {
  return postUpload("/organize/pdf-to-images-upload", files);
}

export function pdfToImagesPath(paths) {
  return postJson("/organize/pdf-to-images", { input_paths: paths });
}

export function previewPdfUpload(files) {
  return postUpload("/organize/preview-pdf-upload", files);
}

export function previewPdfPath(paths) {
  return postJson("/organize/preview-pdf", { input_paths: paths });
}

export function extractPagesUpload(files, pages) {
  return postUpload("/organize/extract-pages-upload", files, { pages });
}

export function extractPagesPath(paths, pages) {
  return postJson(`/organize/extract-pages?pages=${encodeURIComponent(pages)}`, { input_paths: paths });
}

export function deletePagesUpload(files, pages) {
  return postUpload("/organize/delete-pages-upload", files, { pages });
}

export function deletePagesPath(paths, pages) {
  return postJson(`/organize/delete-pages?pages=${encodeURIComponent(pages)}`, { input_paths: paths });
}

export function rotatePdfUpload(files, degrees, pages) {
  return postUpload("/organize/rotate-pdf-upload", files, { degrees, pages });
}

export function rotatePdfPath(paths, degrees, pages) {
  return postJson(`/organize/rotate-pdf?degrees=${degrees}&pages=${encodeURIComponent(pages)}`, { input_paths: paths });
}

export function passwordProtectUpload(files, password) {
  return postUpload("/organize/password-protect-upload", files, { password });
}

export function passwordProtectPath(paths, password) {
  return postJson(`/organize/password-protect?password=${encodeURIComponent(password)}`, { input_paths: paths });
}

export function removeMetadataUpload(files) {
  return postUpload("/organize/remove-metadata-upload", files);
}

export function removeMetadataPath(paths) {
  return postJson("/organize/remove-metadata", { input_paths: paths });
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
