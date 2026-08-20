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
  readerPaperStyle,
  readerZoom,
  searchBusy,
  searchQuery,
  searchResults,
  searchSummary,
  setSearchQuery,
  setReaderPageIndex,
  openSearchResult,
  runSearch,
  clearSearch,
}) {
  return (
    <div className="reader-panel">
      <div className="reader-summary">
        <div>
          <strong>{currentReaderPage ? `Page ${currentReaderIndex + 1}` : "Reader"}</strong>
          <span>{readerPageLabel}</span>
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
                onClick={() => openSearchResult(match.page)}
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
                onClick={() => setReaderPageIndex(index)}
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

          <div className="reader-canvas">
            {currentReaderPage ? (
              <div className="reader-paper" style={readerPaperStyle}>
                <div className="reader-paper-size">{readerPageLabel}</div>
                <LazyThumbImage
                  previewSessionId={previewSessionId}
                  pageNumber={currentReaderPage.page}
                  fallbackImage={currentReaderPage.image}
                  altText={`Reader page ${currentReaderIndex + 1}`}
                  scale={clamp(readerZoom * 1.2, 0.85, 2)}
                  className="reader-paper-image"
                />
              </div>
            ) : (
              <div className="reader-empty">Choose a page to begin reading.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
