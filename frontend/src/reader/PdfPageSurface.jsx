import { memo, useEffect, useRef, useState } from "react";

import { TextLayer } from "./pdfjs";

export const PdfPageSurface = memo(function PdfPageSurface({
  activeMatch,
  interactionMode,
  pageMeta,
  pdfDocument,
  scale,
  shouldRender,
}) {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const textLayerInstanceRef = useRef(null);
  const textItemsRef = useRef([]);
  const [renderState, setRenderState] = useState("idle");

  const width = Math.max(1, pageMeta.width * scale);
  const height = Math.max(1, pageMeta.height * scale);

  useEffect(() => {
    if (!pdfDocument || !shouldRender) {
      return undefined;
    }

    let disposed = false;
    let renderTask = null;
    let textLayer = null;
    setRenderState("loading");

    async function renderPage() {
      try {
        const page = await pdfDocument.getPage(pageMeta.page);
        if (disposed) {
          return;
        }
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const textContainer = textLayerRef.current;
        if (!canvas || !textContainer) {
          return;
        }

        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
        canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const context = canvas.getContext("2d", { alpha: false });
        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        await renderTask.promise;
        if (disposed) {
          return;
        }

        textLayerInstanceRef.current?.cancel();
        textContainer.replaceChildren();
        textContainer.style.setProperty("--total-scale-factor", String(viewport.scale));
        const textContent = await page.getTextContent({ includeMarkedContent: true });
        textLayer = new TextLayer({ textContentSource: textContent, container: textContainer, viewport });
        textLayerInstanceRef.current = textLayer;
        await textLayer.render();
        textItemsRef.current = textLayer.textContentItemsStr;
        if (!disposed) {
          setRenderState("ready");
        }
        page.cleanup();
      } catch (error) {
        if (!disposed && error?.name !== "RenderingCancelledException" && error?.name !== "AbortException") {
          setRenderState("error");
        }
      }
    }

    void renderPage();
    return () => {
      disposed = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [pageMeta.page, pdfDocument, scale, shouldRender]);

  useEffect(() => {
    const textLayer = textLayerInstanceRef.current;
    if (!textLayer) {
      return;
    }
    const query = activeMatch?.query?.trim().toLocaleLowerCase() || "";
    let occurrence = 0;
    textLayer.textDivs.forEach((element, index) => {
      element.classList.remove("is-search-match", "is-active-search-match");
      if (!query) {
        return;
      }
      const value = (textItemsRef.current[index] || "").toLocaleLowerCase();
      if (!value.includes(query)) {
        return;
      }
      element.classList.add("is-search-match");
      if (activeMatch.page === pageMeta.page && occurrence === activeMatch.occurrence) {
        element.classList.add("is-active-search-match");
      }
      occurrence += Math.max(1, value.split(query).length - 1);
    });
  }, [activeMatch, pageMeta.page, renderState]);

  useEffect(() => {
    if (shouldRender) {
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 1;
        canvas.height = 1;
      }
      textLayerRef.current?.replaceChildren();
      textLayerInstanceRef.current = null;
      textItemsRef.current = [];
      setRenderState("idle");
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [shouldRender]);

  return (
    <div
      className={`pdf-page-surface ${interactionMode === "edit" ? "is-editing" : ""}`}
      style={{ height: `${height}px`, width: `${width}px` }}
    >
      <canvas ref={canvasRef} width="1" height="1" aria-hidden="true" />
      <div ref={textLayerRef} className="textLayer" />
      {renderState === "loading" && <div className="pdf-page-loading">Rendering page</div>}
      {renderState === "error" && <div className="pdf-page-error">Page could not be rendered</div>}
    </div>
  );
});
