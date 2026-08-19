import { useEffect } from "react";

import { previewPdfManifestPath, previewPdfManifestUpload } from "../api";

export function usePreviewManifest({
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
}) {
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
}
