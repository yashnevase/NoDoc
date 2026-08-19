import { useEffect } from "react";

export function usePreviewViewport({
  activeTool,
  exactlyOnePdfSelected,
  pagePreviewLength,
  previewBusy,
  previewScrollRef,
  setPreviewViewport,
}) {
  useEffect(() => {
    const viewport = previewScrollRef.current;
    if (!viewport) {
      return undefined;
    }

    const updateViewport = () => {
      setPreviewViewport({
        height: viewport.clientHeight,
        width: viewport.clientWidth,
        scrollTop: viewport.scrollTop,
      });
    };

    updateViewport();
    viewport.addEventListener("scroll", updateViewport, { passive: true });
    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(viewport);
    return () => {
      viewport.removeEventListener("scroll", updateViewport);
      resizeObserver.disconnect();
    };
  }, [exactlyOnePdfSelected, pagePreviewLength, activeTool, previewScrollRef, setPreviewViewport]);

  useEffect(() => {
    if (previewScrollRef.current) {
      previewScrollRef.current.scrollTop = 0;
    }
  }, [activeTool, pagePreviewLength, previewBusy, previewScrollRef]);
}
