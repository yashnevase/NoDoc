import { memo, useEffect, useRef, useState } from "react";

import { useNearViewport } from "./useNearViewport";

export const PdfThumbnail = memo(function PdfThumbnail({ pageMeta, pdfDocument, rootRef }) {
  const holderRef = useRef(null);
  const canvasRef = useRef(null);
  const near = useNearViewport(holderRef, rootRef, "450px 0px");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!near || !pdfDocument) {
      return undefined;
    }
    let disposed = false;
    let renderTask = null;

    async function render() {
      const page = await pdfDocument.getPage(pageMeta.page);
      if (disposed) {
        return;
      }
      const scale = Math.min(0.34, 112 / Math.max(1, pageMeta.width));
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      renderTask = page.render({
        canvasContext: canvas.getContext("2d", { alpha: false }),
        viewport,
        transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      });
      await renderTask.promise;
      if (!disposed) {
        setLoading(false);
      }
      page.cleanup();
    }

    void render().catch(() => setLoading(false));
    return () => {
      disposed = true;
      renderTask?.cancel();
    };
  }, [near, pageMeta.height, pageMeta.page, pageMeta.width, pdfDocument]);

  useEffect(() => {
    if (near) {
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 1;
        canvas.height = 1;
      }
      setLoading(true);
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [near]);

  return (
    <div
      className={`pdf-thumbnail-surface ${loading ? "is-loading" : ""}`}
      ref={holderRef}
      style={{ aspectRatio: `${pageMeta.width} / ${pageMeta.height}` }}
    >
      <canvas ref={canvasRef} width="1" height="1" aria-hidden="true" />
    </div>
  );
});
