export function hasExtension(fileName, extensions) {
  const lower = fileName.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

export function pathName(path) {
  return path.split(/[\\/]/).pop() || path;
}

export function joinNativePath(folder, name) {
  const separator = folder.includes("\\") && !folder.includes("/") ? "\\" : "/";
  return `${String(folder).replace(/[\\/]+$/, "")}${separator}${name}`;
}

export function outputPathsFromResult(result) {
  if (result.output_path) {
    return [result.output_path];
  }
  return result.output_paths || [];
}

export function sleep(ms, signal) {
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

export function pagesToRange(pages) {
  return [...pages].sort((a, b) => a - b).join(",");
}

export function pageActionClass(toolId, selected, rotationApplies) {
  if (toolId === "delete" && selected) {
    return "will-delete";
  }
  if (toolId === "extract" && selected) {
    return "will-extract";
  }
  if (toolId === "rotate" && rotationApplies) {
    return "will-rotate";
  }
  if (toolId === "redact" && selected) {
    return "will-delete";
  }
  if (toolId === "reorder") {
    return "will-reorder";
  }
  if (selected) {
    return "is-selected";
  }
  return "";
}

export function uploadItems(files) {
  return Array.from(files).map((file) => ({ source: "upload", file, name: file.name }));
}

export function pathItems(paths) {
  return paths.map((path) => ({ source: "path", path, name: pathName(path) }));
}

export function pathFolder(path) {
  const normalized = String(path || "").replace(/\//g, "\\");
  const lastSeparator = normalized.lastIndexOf("\\");
  return lastSeparator >= 0 ? normalized.slice(0, lastSeparator) : normalized;
}

export function transferHasFiles(dataTransfer) {
  if (!dataTransfer) {
    return false;
  }
  const items = Array.from(dataTransfer.items || []);
  if (items.length) {
    return items.some((item) => item.kind === "file");
  }
  return Array.from(dataTransfer.files || []).length > 0;
}

export function transferHasInternalPageDrag(dataTransfer) {
  if (!dataTransfer) {
    return false;
  }
  return Array.from(dataTransfer.types || []).includes("application/x-nodoc-page");
}

export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}

export function readStoredList(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "[]");
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

export function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

export function normalizeAngle(angle) {
  const value = angle % 360;
  return value < 0 ? value + 360 : value;
}
