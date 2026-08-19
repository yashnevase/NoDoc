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
  setReaderPageIndex,
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
        </div>
      </div>

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
