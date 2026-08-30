import { useEffect, useState } from "react";

import { fetchPreviewDocument } from "../api";
import { getDocument } from "./pdfjs";

export function usePdfDocument(previewSessionId) {
  const [state, setState] = useState({ document: null, error: "", loading: false });

  useEffect(() => {
    if (!previewSessionId) {
      setState({ document: null, error: "", loading: false });
      return undefined;
    }

    const controller = new AbortController();
    let loadingTask = null;
    let disposed = false;
    setState({ document: null, error: "", loading: true });

    async function load() {
      try {
        const data = await fetchPreviewDocument(previewSessionId, { signal: controller.signal });
        loadingTask = getDocument({ data: new Uint8Array(data) });
        const document = await loadingTask.promise;
        if (!disposed) {
          setState({ document, error: "", loading: false });
        }
      } catch (error) {
        if (!disposed && error?.name !== "AbortError") {
          setState({ document: null, error: error?.message || "The PDF could not be opened.", loading: false });
        }
      }
    }

    void load();
    return () => {
      disposed = true;
      controller.abort();
      void loadingTask?.destroy();
    };
  }, [previewSessionId]);

  return state;
}
