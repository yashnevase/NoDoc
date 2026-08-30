import { useEffect, useRef, useState } from "react";

import { clamp } from "../utils/fileHelpers";
import { LazyThumbImage } from "./LazyThumbImage";
import { EditableRegion } from "./EditableRegion";

function rectStyle(rect) {
  return {
    left: `${clamp(rect.x, 0, 1) * 100}%`,
    top: `${clamp(rect.y, 0, 1) * 100}%`,
    width: `${clamp(rect.width, 0, 1) * 100}%`,
    height: `${clamp(rect.height, 0, 1) * 100}%`,
  };
}

function pointWithinPreview(event, rect) {
  const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  return { x, y };
}

export function RedactEditor({
  activeRedactionPage,
  addRedactionRect,
  clearAllRedactions,
  clearRedactionsForPage,
  isBusy,
  pagePreview,
  previewSessionId,
  redactColor,
  redactRegions,
  removeRedactionRect,
  updateRedactionRect,
  selectedPages,
  setActiveRedactionPage,
  setRedactColor,
}) {
  const previewHostRef = useRef(null);
  const [draftRect, setDraftRect] = useState(null);

  const selectedPage = selectedPages[selectedPages.length - 1];
  const activePageNumber = activeRedactionPage || selectedPage || pagePreview[0]?.page || 1;
  const previewPage = pagePreview.find((page) => page.page === activePageNumber) || pagePreview[0] || null;
  const pageRegions = redactRegions[activePageNumber] || [];
  const totalRegions = Object.values(redactRegions).reduce((sum, regions) => sum + regions.length, 0);

  useEffect(() => {
    if (selectedPage && selectedPage !== activeRedactionPage) {
      setActiveRedactionPage(selectedPage);
    }
  }, [activeRedactionPage, selectedPage, setActiveRedactionPage]);

  useEffect(() => {
    if (!activeRedactionPage && previewPage?.page) {
      setActiveRedactionPage(previewPage.page);
    }
  }, [activeRedactionPage, previewPage, setActiveRedactionPage]);

  function finishDraft() {
    if (!draftRect) {
      return;
    }
    if (draftRect.width >= 0.01 && draftRect.height >= 0.01 && previewPage) {
      addRedactionRect(previewPage.page, draftRect);
    }
    setDraftRect(null);
  }

  return (
    <div className="redact-editor">
      <div className="redact-editor-head">
        <div>
          <strong>Redaction editor</strong>
          <span>{totalRegions ? `${totalRegions} box${totalRegions === 1 ? "" : "es"} saved` : "Draw boxes to remove content"}</span>
        </div>
        <div className="preview-toolbar-actions">
          <button type="button" onClick={() => clearRedactionsForPage(activePageNumber)} disabled={isBusy || !pageRegions.length}>
            Clear page
          </button>
          <button type="button" onClick={clearAllRedactions} disabled={isBusy || !totalRegions}>
            Clear all
          </button>
        </div>
      </div>

      <div className="redact-editor-body">
        <div className="redact-preview-shell">
          <div
            className="redact-preview-page"
            ref={previewHostRef}
            style={previewPage ? { aspectRatio: `${Math.max(1, previewPage.width)} / ${Math.max(1, previewPage.height)}` } : undefined}
            onPointerDown={(event) => {
              if (isBusy || !previewPage || !previewHostRef.current || event.button !== 0) {
                return;
              }
              event.preventDefault();
              const bounds = previewHostRef.current.getBoundingClientRect();
              const start = pointWithinPreview(event, bounds);
              setActiveRedactionPage(previewPage.page);
              setDraftRect({ x: start.x, y: start.y, width: 0, height: 0, startX: start.x, startY: start.y });
              previewHostRef.current.setPointerCapture?.(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!draftRect || !previewHostRef.current) {
                return;
              }
              const bounds = previewHostRef.current.getBoundingClientRect();
              const point = pointWithinPreview(event, bounds);
              const left = Math.min(draftRect.startX, point.x);
              const top = Math.min(draftRect.startY, point.y);
              const width = Math.abs(point.x - draftRect.startX);
              const height = Math.abs(point.y - draftRect.startY);
              setDraftRect({ ...draftRect, x: left, y: top, width, height });
            }}
            onPointerUp={finishDraft}
            onPointerCancel={() => setDraftRect(null)}
          >
            <div className="crop-preview-size">
              {previewPage ? `Page ${previewPage.page} · ${Math.round(previewPage.width)} x ${Math.round(previewPage.height)} pt` : "Page preview"}
            </div>
            {previewPage ? (
              <LazyThumbImage
                previewSessionId={previewSessionId}
                pageNumber={previewPage.page}
                fallbackImage={previewPage.image}
                altText={`Preview page ${previewPage.page}`}
              />
            ) : (
              <div className="crop-preview-empty">Preview</div>
            )}
            <div className="redact-preview-overlay">
              {pageRegions.map((rect, index) => (
                <EditableRegion
                  key={`${activePageNumber}-${index}`}
                  className="redact-region"
                  region={rect}
                  title={`Redaction box ${index + 1}`}
                  onChange={(next) => updateRedactionRect(activePageNumber, index, next)}
                  onDelete={() => removeRedactionRect(activePageNumber, index)}
                />
              ))}
              {draftRect && <div className="redact-region is-draft" style={rectStyle(draftRect)} />}
            </div>
          </div>
          <p className="crop-preview-note">
            Drag on the page preview to place a box. Each box is burned into the final page as a flattened redaction.
          </p>
        </div>

        <div className="redact-controls">
          <label className="field">
            <span>Redaction fill</span>
            <input type="color" value={redactColor} onChange={(event) => setRedactColor(event.target.value)} disabled={isBusy} />
          </label>

          <div className="redact-page-summary">
            <strong>Pages with boxes</strong>
            <div className="redact-page-list">
              {Object.keys(redactRegions).length ? Object.keys(redactRegions).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={Number(pageNumber) === activePageNumber ? "is-active" : ""}
                  onClick={() => setActiveRedactionPage(Number(pageNumber))}
                >
                  Page {pageNumber}
                  <span>{redactRegions[pageNumber].length}</span>
                </button>
              )) : <span className="empty-note">No redaction boxes yet</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
