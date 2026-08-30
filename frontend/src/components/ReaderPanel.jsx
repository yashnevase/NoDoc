import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { clamp } from "../utils/fileHelpers";
import { PdfPageSurface } from "../reader/PdfPageSurface";
import { PdfThumbnail } from "../reader/PdfThumbnail";
import { usePdfDocument } from "../reader/usePdfDocument";
import { Icon } from "./Icon";

function isFormTarget(target) {
  return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function ReaderPanel({
  currentReaderIndex,
  currentReaderPage,
  editMode = false,
  isBusy,
  onSelectPage,
  pagePreview,
  previewBusy,
  previewSessionId,
  readerZoom,
  searchBusy,
  searchQuery,
  searchResults,
  searchSummary,
  selectedPages = [],
  setSearchQuery,
  setReaderPageIndex,
  setReaderZoom,
  runSearch,
  clearSearch,
}) {
  const canvasRef = useRef(null);
  const searchInputRef = useRef(null);
  const thumbnailStripRef = useRef(null);
  const pageRefs = useRef([]);
  const thumbnailRefs = useRef([]);
  const currentIndexRef = useRef(currentReaderIndex);
  const visibilityRatiosRef = useRef(new Map());
  const navigationLockRef = useRef(0);
  const [canvasSize, setCanvasSize] = useState({ height: 700, width: 820 });
  const [visiblePages, setVisiblePages] = useState(new Set([0]));
  const [zoomMode, setZoomMode] = useState("width");
  const [pageEntry, setPageEntry] = useState("1");
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [highlightQuery, setHighlightQuery] = useState("");
  const { document: pdfDocument, error: pdfError, loading: pdfLoading } = usePdfDocument(previewSessionId);

  const flattenedMatches = useMemo(
    () => searchResults.flatMap((match) =>
      Array.from({ length: Math.max(1, match.count || 1) }, (_, occurrence) => ({
        occurrence,
        page: match.page,
        snippet: match.snippet,
      }))
    ),
    [searchResults]
  );

  const activeMatch = activeSearchIndex >= 0 && flattenedMatches[activeSearchIndex]
    ? { ...flattenedMatches[activeSearchIndex], query: highlightQuery }
    : { occurrence: -1, page: -1, query: highlightQuery };

  const scaleForPage = useCallback((page) => {
    if (!page) {
      return readerZoom;
    }
    const widthScale = Math.max(0.35, (canvasSize.width - 52) / Math.max(1, page.width));
    if (zoomMode === "width") {
      return Math.min(4, widthScale);
    }
    if (zoomMode === "page") {
      const heightScale = Math.max(0.35, (canvasSize.height - 44) / Math.max(1, page.height));
      return Math.min(4, widthScale, heightScale);
    }
    return clamp(readerZoom, 0.35, 4);
  }, [canvasSize.height, canvasSize.width, readerZoom, zoomMode]);

  const displayedScale = scaleForPage(currentReaderPage);

  const navigateToPage = useCallback((index, behavior = "smooth") => {
    if (!pagePreview.length) {
      return;
    }
    const nextIndex = clamp(index, 0, pagePreview.length - 1);
    const resolvedBehavior = behavior === "smooth" && Math.abs(nextIndex - currentIndexRef.current) > 3 ? "auto" : behavior;
    navigationLockRef.current = window.performance.now() + (resolvedBehavior === "smooth" ? 520 : 180);
    setReaderPageIndex(nextIndex);
    setPageEntry(String(nextIndex + 1));
    const canvas = canvasRef.current;
    const target = pageRefs.current[nextIndex];
    if (canvas && target) {
      canvas.scrollTo({ behavior: resolvedBehavior, top: Math.max(0, target.offsetTop - 16) });
    }
  }, [pagePreview.length, setReaderPageIndex]);

  useEffect(() => {
    currentIndexRef.current = currentReaderIndex;
    setPageEntry(String(currentReaderIndex + 1));
    const strip = thumbnailStripRef.current;
    const target = thumbnailRefs.current[currentReaderIndex];
    if (strip && target) {
      const stripBounds = strip.getBoundingClientRect();
      const targetBounds = target.getBoundingClientRect();
      strip.scrollTop += targetBounds.top - stripBounds.top - (strip.clientHeight - targetBounds.height) / 2;
    }
  }, [currentReaderIndex]);

  useEffect(() => {
    navigationLockRef.current = Number.POSITIVE_INFINITY;
    setZoomMode("width");
    setActiveSearchIndex(-1);
    setHighlightQuery("");
  }, [previewSessionId]);

  useEffect(() => {
    if (!pdfDocument || !pagePreview.length) {
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      navigateToPage(currentReaderIndex, "auto");
    }, 40);
    return () => window.clearTimeout(timeout);
  }, [pdfDocument, pagePreview.length, previewSessionId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      navigationLockRef.current = Number.POSITIVE_INFINITY;
      setCanvasSize((current) => {
        const next = { height: entry.contentRect.height, width: entry.contentRect.width };
        return Math.abs(current.height - next.height) < 1 && Math.abs(current.width - next.width) < 1 ? current : next;
      });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!pagePreview.length) {
      return undefined;
    }
    navigationLockRef.current = Number.POSITIVE_INFINITY;
    const frame = window.requestAnimationFrame(() => navigateToPage(currentIndexRef.current, "auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [canvasSize.height, canvasSize.width, navigateToPage, pagePreview.length, readerZoom, zoomMode]);

  useEffect(() => {
    const root = canvasRef.current;
    if (!root || !pagePreview.length || typeof IntersectionObserver === "undefined") {
      return undefined;
    }
    visibilityRatiosRef.current.clear();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const index = Number(entry.target.dataset.pageIndex);
        visibilityRatiosRef.current.set(index, entry.isIntersecting ? entry.intersectionRatio : 0);
      }
      const nextVisible = new Set(
        [...visibilityRatiosRef.current.entries()].filter(([, ratio]) => ratio > 0).map(([index]) => index)
      );
      setVisiblePages(nextVisible);
      if (window.performance.now() < navigationLockRef.current) {
        return;
      }
      let nearestIndex = currentReaderIndex;
      let nearestRatio = -1;
      for (const [index, ratio] of visibilityRatiosRef.current.entries()) {
        if (ratio > nearestRatio) {
          nearestRatio = ratio;
          nearestIndex = index;
        }
      }
      if (nearestRatio > 0 && nearestIndex !== currentReaderIndex) {
        setReaderPageIndex(nearestIndex);
      }
    }, { root, rootMargin: "260px 0px", threshold: [0, 0.15, 0.35, 0.6, 0.85] });
    pageRefs.current.slice(0, pagePreview.length).forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, [currentReaderIndex, pagePreview.length, pdfDocument, setReaderPageIndex]);

  useEffect(() => {
    if (!searchResults.length) {
      setActiveSearchIndex(-1);
      setHighlightQuery("");
      return;
    }
    setHighlightQuery(searchQuery.trim());
    setActiveSearchIndex(0);
    window.setTimeout(() => navigateToPage(searchResults[0].page - 1), 0);
  }, [navigateToPage, searchResults, searchSummary]);

  const changeZoom = useCallback((delta) => {
    navigationLockRef.current = Number.POSITIVE_INFINITY;
    setZoomMode("custom");
    setReaderZoom(clamp(displayedScale + delta, 0.35, 4));
  }, [displayedScale, setReaderZoom]);

  function changeFitMode(mode) {
    navigationLockRef.current = Number.POSITIVE_INFINITY;
    setZoomMode(mode);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    function handleWheel(event) {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      changeZoom(event.deltaY < 0 ? 0.1 : -0.1);
    }
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [changeZoom]);

  useEffect(() => {
    function handleKeys(event) {
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (command && ["+", "="].includes(event.key)) {
        event.preventDefault();
        changeZoom(0.1);
        return;
      }
      if (command && event.key === "-") {
        event.preventDefault();
        changeZoom(-0.1);
        return;
      }
      if (isFormTarget(event.target)) {
        return;
      }
      if (["ArrowDown", "ArrowRight", "PageDown"].includes(event.key)) {
        event.preventDefault();
        navigateToPage(currentReaderIndex + 1);
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        navigateToPage(currentReaderIndex - 1);
      }
    }
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [changeZoom, currentReaderIndex, navigateToPage]);

  function navigateSearch(direction) {
    if (!flattenedMatches.length) {
      return;
    }
    const next = (activeSearchIndex + direction + flattenedMatches.length) % flattenedMatches.length;
    setActiveSearchIndex(next);
    navigateToPage(flattenedMatches[next].page - 1);
  }

  function commitPageEntry() {
    const page = clamp(Number.parseInt(pageEntry, 10) || 1, 1, Math.max(1, pagePreview.length));
    navigateToPage(page - 1);
  }

  function submitPageEntry(event) {
    event.preventDefault();
    commitPageEntry();
  }

  return (
    <div className={`reader-panel professional-reader ${editMode ? "is-edit-mode" : ""}`}>
      <div className="reader-toolbar" aria-label="Reader controls">
        <div className="reader-toolbar-group page-navigation-group">
          <button className="icon-button" type="button" onClick={() => navigateToPage(currentReaderIndex - 1)} disabled={isBusy || currentReaderIndex <= 0} title="Previous page"><Icon name="chevronLeft" /></button>
          <form className="page-entry" onSubmit={submitPageEntry}>
            <input
              aria-label="Page number"
              inputMode="numeric"
              value={pageEntry}
              onBlur={commitPageEntry}
              onChange={(event) => setPageEntry(event.target.value.replace(/\D/g, ""))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitPageEntry();
                }
              }}
            />
            <span>{`/ ${pagePreview.length || 0}`}</span>
          </form>
          <button className="icon-button" type="button" onClick={() => navigateToPage(currentReaderIndex + 1)} disabled={isBusy || currentReaderIndex >= pagePreview.length - 1} title="Next page"><Icon name="chevronRight" /></button>
        </div>

        <div className="reader-toolbar-group zoom-group">
          <button className="icon-button" type="button" onClick={() => changeZoom(-0.1)} disabled={isBusy} title="Zoom out"><Icon name="zoomOut" /></button>
          <button type="button" className="zoom-value" onClick={() => changeFitMode("custom")} title="Current zoom">{`${Math.round(displayedScale * 100)}%`}</button>
          <button className="icon-button" type="button" onClick={() => changeZoom(0.1)} disabled={isBusy} title="Zoom in"><Icon name="zoomIn" /></button>
          <button className={`icon-button ${zoomMode === "width" ? "is-active" : ""}`} type="button" onClick={() => changeFitMode("width")} disabled={isBusy} title="Fit width"><Icon name="fitWidth" /></button>
          <button className={`icon-button ${zoomMode === "page" ? "is-active" : ""}`} type="button" onClick={() => changeFitMode("page")} disabled={isBusy} title="Fit page"><Icon name="fitPage" /></button>
        </div>

        <form className="reader-search-box" onSubmit={(event) => { event.preventDefault(); runSearch(); }}>
          <button className="icon-button reader-search-submit" type="submit" disabled={!searchQuery.trim() || searchBusy} title="Search document"><Icon name="search" /></button>
          <input ref={searchInputRef} type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Find in document" aria-label="Find in document" disabled={isBusy || previewBusy} />
          {searchBusy && <span className="reader-search-spinner" />}
          {flattenedMatches.length > 0 && <span className="search-count">{`${activeSearchIndex + 1}/${flattenedMatches.length}`}</span>}
          <button className="icon-button" type="button" onClick={() => navigateSearch(-1)} disabled={!flattenedMatches.length} title="Previous match"><Icon name="chevronLeft" /></button>
          <button className="icon-button" type="button" onClick={() => navigateSearch(1)} disabled={!flattenedMatches.length} title="Next match"><Icon name="chevronRight" /></button>
          {(searchQuery || searchResults.length > 0) && <button className="icon-button" type="button" onClick={clearSearch} title="Clear search"><Icon name="close" /></button>}
        </form>
      </div>

      {searchSummary && <div className="reader-search-summary">{searchSummary}</div>}

      <div className="reader-layout">
        <aside className="reader-strip" ref={thumbnailStripRef} aria-label="Page thumbnails">
          {pagePreview.map((page, index) => {
            const selected = selectedPages.includes(page.page);
            return (
              <button
                key={page.page}
                ref={(element) => { thumbnailRefs.current[index] = element; }}
                type="button"
                className={`reader-strip-item ${index === currentReaderIndex ? "is-active" : ""} ${selected ? "is-selected" : ""}`}
                onClick={(event) => {
                  navigateToPage(index);
                  if (editMode) {
                    onSelectPage?.(page.page, event);
                  }
                }}
                disabled={isBusy}
                title={editMode ? `Page ${page.page}; click to target, Cmd/Ctrl-click to toggle` : `Open page ${page.page}`}
              >
                <PdfThumbnail pageMeta={page} pdfDocument={pdfDocument} rootRef={thumbnailStripRef} />
                <span>{page.page}</span>
                {selected && <i><Icon name="check" /></i>}
              </button>
            );
          })}
        </aside>

        <div className="reader-canvas" ref={canvasRef} tabIndex="0" aria-label="PDF document pages">
          {(previewBusy || pdfLoading) && <div className="reader-state-overlay"><span className="reader-search-spinner" /><p>Opening document</p></div>}
          {pdfError && <div className="reader-state-overlay is-error"><strong>Could not open this PDF</strong><p>{pdfError}</p></div>}
          {!previewBusy && !pdfLoading && !pdfError && pagePreview.map((page, index) => {
            const pageScale = scaleForPage(page);
            const shouldRender = visiblePages.has(index) || Math.abs(index - currentReaderIndex) <= 2;
            return (
              <article
                className={`reader-paper ${index === currentReaderIndex ? "is-current" : ""}`}
                data-page-index={index}
                key={page.page}
                ref={(element) => { pageRefs.current[index] = element; }}
                style={{ height: `${page.height * pageScale}px`, width: `${page.width * pageScale}px` }}
              >
                <span className="reader-paper-number">{page.page}</span>
                <PdfPageSurface activeMatch={activeMatch} interactionMode={editMode ? "edit" : "read"} pageMeta={page} pdfDocument={pdfDocument} scale={pageScale} shouldRender={shouldRender} />
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
