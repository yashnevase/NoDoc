import { useEffect } from "react";

import { clamp } from "../utils/fileHelpers";

export function useReaderNavigation({ pagePreviewLength, readerActive, setReaderPageIndex }) {
  useEffect(() => {
    if (!pagePreviewLength) {
      setReaderPageIndex(0);
      return;
    }
    setReaderPageIndex((current) => clamp(current, 0, pagePreviewLength - 1));
  }, [pagePreviewLength, setReaderPageIndex]);

  useEffect(() => {
    if (!readerActive) {
      return undefined;
    }

    function handleReaderKeys(event) {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
          return;
        }
      }
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        setReaderPageIndex((current) => clamp(current + 1, 0, Math.max(0, pagePreviewLength - 1)));
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setReaderPageIndex((current) => clamp(current - 1, 0, Math.max(0, pagePreviewLength - 1)));
      }
    }

    window.addEventListener("keydown", handleReaderKeys);
    return () => {
      window.removeEventListener("keydown", handleReaderKeys);
    };
  }, [pagePreviewLength, readerActive, setReaderPageIndex]);
}
