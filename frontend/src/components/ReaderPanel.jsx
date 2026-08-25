import { useRef } from "react";

import { clamp } from "../utils/fileHelpers";
import { LazyThumbImage } from "./LazyThumbImage";

export function ReaderPanel({
  currentReaderIndex,
  currentReaderPage,
  isBusy,
  pagePreview,
  previewBusy,
  previewSessionId,
  readerPageLabel,
  readerZoom,
  searchBusy,
  searchQuery,
  searchResults,
  searchSummary,
  setSearchQuery,
  setReaderPageIndex,
  setReaderZoom,
  runSearch,
  clearSearch,
}) {
  const pageRefs = useRef([]);

  function goToPage(index, behavior = "smooth") {
    const nextIndex = clamp(index, 0, Math.max(0, pagePreview.length - 1));
    setReaderPageIndex(nextIndex);
    pageRefs.current[nextIndex]?.scrollIntoView({ behavior, block: "start" });
  }

  function syncReaderPage(event) {
    const scrollTop = event.currentTarget.scrollTop;
    let nearestIndex = 0;
    for (let index = 0; index < pageRefs.current.length; index += 1) {
      const page = pageRefs.current[index];
      if (page && page.offsetTop <= scrollTop + 56) {
        nearestIndex = index;
      }
    }
    if (nearestIndex !== currentReaderIndex) {
      setReaderPageIndex(nearestIndex);
    }
  }

  return (
    <div className="reader-panel">
      <div className="reader-summary">
        <div>
          <strong>{currentReaderPage ? `Page ${currentReaderIndex + 1}` : "Reader"}</strong>
          <span>{readerPageLabel}</span>
        </div>
        <div className="reader-controls" aria-label="Reader controls">
          <button type="button" onClick={() => goToPage(currentReaderIndex - 1)} disabled={isBusy || currentReaderIndex <= 0} title="Previous page">Prev</button>
          <span className="reader-page-count">{`${currentReaderIndex + 1} / ${pagePreview.length || 0}`}</span>
          <button type="button" onClick={() => goToPage(currentReaderIndex + 1)} disabled={isBusy || currentReaderIndex >= pagePreview.length - 1} title="Next page">Next</button>
          <button type="button" onClick={() => setReaderZoom((zoom) => clamp(zoom - 0.1, 0.7, 2))} disabled={isBusy} title="Zoom out">-</button>
          <button type="button" onClick={() => setReaderZoom(0.9)} disabled={isBusy} title="Fit page">Fit</button>
          <button type="button" onClick={() => setReaderZoom((zoom) => clamp(zoom + 0.1, 0.7, 2))} disabled={isBusy} title="Zoom in">+</button>
        </div>
        <div className="reader-summary-pills">
          <span>{`${Math.round(readerZoom * 100)}% zoom`}</span>
          <span>{pagePreview.length ? `${pagePreview.length} pages` : "No pages"}</span>
          {searchSummary ? <span>{searchSummary}</span> : null}
        </div>
      </div>

      <form
        className="reader-search"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
      >
        <label className="field compact-field">
          <span>Search this PDF</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Find words or phrases"
            disabled={isBusy || previewBusy}
          />
        </label>
        <div className="reader-search-actions">
          <button type="submit" disabled={isBusy || previewBusy || !searchQuery.trim()}>
            Search
          </button>
          <button type="button" onClick={clearSearch} disabled={isBusy || previewBusy || (!searchQuery && !searchResults.length)}>
            Clear
          </button>
        </div>
      </form>

      {(searchBusy || searchResults.length > 0) && (
        <div className="reader-search-results">
          {searchBusy ? (
            <div className="preview-loading">
              <span />
              <p>Searching text</p>
            </div>
          ) : (
            searchResults.map((match) => (
              <button
                key={`${match.page}-${match.snippet}`}
                type="button"
                className={`reader-search-result ${currentReaderPage?.page === match.page ? "is-active" : ""}`}
                onClick={() => goToPage(match.page - 1)}
              >
                <strong>{`Page ${match.page}`}</strong>
                <span>{`${match.count} match${match.count === 1 ? "" : "es"}`}</span>
                <p>{match.snippet}</p>
              </button>
            ))
          )}
        </div>
      )}

      {previewBusy ? (
        <div className="preview-loading">
          <span />
          <p>Rendering preview</p>
        </div>
      ) : (
        <div className="reader-layout">
          <aside className="reader-strip">
            {pagePreview.map((page, index) => (
              <button
                key={page.page}
                type="button"
                className={`reader-strip-item ${index === currentReaderIndex ? "is-active" : ""}`}
                onClick={() => goToPage(index)}
                disabled={isBusy}
                title={`Open page ${index + 1}`}
              >
                <LazyThumbImage
                  previewSessionId={previewSessionId}
                  pageNumber={page.page}
                  fallbackImage={page.image}
                  altText={`Page ${index + 1}`}
                  scale={0.4}
                />
                <span>{index + 1}</span>
              </button>
            ))}
          </aside>

          <div className="reader-canvas" onScroll={syncReaderPage}>
            {pagePreview.length ? (
              pagePreview.map((page, index) => (
                <article
                  className={`reader-paper ${index === currentReaderIndex ? "is-current" : ""}`}
                  key={page.page}
                  ref={(element) => { pageRefs.current[index] = element; }}
                  style={{
                    aspectRatio: `${Math.max(1, page.width)} / ${Math.max(1, page.height)}`,
                    width: `${Math.round(clamp(620 * readerZoom, 320, 1160))}px`,
                  }}
                >
                  <div className="reader-paper-size">{`${Math.round(page.width)} x ${Math.round(page.height)} pt`}</div>
                  <LazyThumbImage
                    previewSessionId={previewSessionId}
                    pageNumber={page.page}
                    fallbackImage={page.image}
                    altText={`Reader page ${index + 1}`}
                    scale={clamp(readerZoom * 1.2, 0.85, 2)}
                    className="reader-paper-image"
                  />
                </article>
              ))
            ) : (
              <div className="reader-empty">Choose a page to begin reading.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
