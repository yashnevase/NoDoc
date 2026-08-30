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

export function HighlightEditor({
  activeHighlightPage,
  addHighlightRect,
  clearAllHighlights,
  clearHighlightsForPage,
  highlightColor,
  highlightOpacity,
  highlightRegions,
  isBusy,
  pagePreview,
  previewSessionId,
  removeHighlightRect,
  updateHighlightRect,
  selectedPages,
  setActiveHighlightPage,
  setHighlightColor,
  setHighlightOpacity,
}) {
  const previewHostRef = useRef(null);
  const [draftRect, setDraftRect] = useState(null);

  const selectedPage = selectedPages[selectedPages.length - 1];
  const activePageNumber = activeHighlightPage || selectedPage || pagePreview[0]?.page || 1;
  const previewPage = pagePreview.find((page) => page.page === activePageNumber) || pagePreview[0] || null;
  const pageRegions = highlightRegions[activePageNumber] || [];
  const totalRegions = Object.values(highlightRegions).reduce((sum, regions) => sum + regions.length, 0);

  useEffect(() => {
    if (selectedPage && selectedPage !== activeHighlightPage) {
      setActiveHighlightPage(selectedPage);
    }
  }, [activeHighlightPage, selectedPage, setActiveHighlightPage]);

  useEffect(() => {
    if (!activeHighlightPage && previewPage?.page) {
      setActiveHighlightPage(previewPage.page);
    }
  }, [activeHighlightPage, previewPage, setActiveHighlightPage]);

  function finishDraft() {
    if (!draftRect) {
      return;
    }
    if (draftRect.width >= 0.01 && draftRect.height >= 0.01 && previewPage) {
      addHighlightRect(previewPage.page, draftRect);
    }
    setDraftRect(null);
  }

  return (
    <div className="redact-editor highlight-editor">
      <div className="redact-editor-head">
        <div>
          <strong>Highlight editor</strong>
          <span>{totalRegions ? `${totalRegions} box${totalRegions === 1 ? "" : "es"} saved` : "Draw highlight boxes on the page"}</span>
        </div>
        <div className="preview-toolbar-actions">
          <button type="button" onClick={() => clearHighlightsForPage(activePageNumber)} disabled={isBusy || !pageRegions.length}>
            Clear page
          </button>
          <button type="button" onClick={clearAllHighlights} disabled={isBusy || !totalRegions}>
            Clear all
          </button>
        </div>
      </div>

      <div className="redact-editor-body">
        <div className="redact-preview-shell">
          <div
            className="redact-preview-page highlight-preview-page"
            ref={previewHostRef}
            style={previewPage ? { aspectRatio: `${Math.max(1, previewPage.width)} / ${Math.max(1, previewPage.height)}` } : undefined}
            onPointerDown={(event) => {
              if (isBusy || !previewPage || !previewHostRef.current || event.button !== 0) {
                return;
              }
              event.preventDefault();
              const bounds = previewHostRef.current.getBoundingClientRect();
              const start = pointWithinPreview(event, bounds);
              setActiveHighlightPage(previewPage.page);
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
                  className="highlight-region"
                  region={rect}
                  style={{ "--highlight-fill": highlightColor, "--highlight-opacity": highlightOpacity }}
                  title={`Highlight box ${index + 1}`}
                  onChange={(next) => updateHighlightRect(activePageNumber, index, next)}
                  onDelete={() => removeHighlightRect(activePageNumber, index)}
                />
              ))}
              {draftRect && (
                <div
                  className="highlight-region is-draft"
                  style={{ ...rectStyle(draftRect), "--highlight-fill": highlightColor, "--highlight-opacity": highlightOpacity }}
                />
              )}
            </div>
          </div>
          <p className="crop-preview-note">
            Drag on the page preview to place a highlight area. The highlight is burned into the exported PDF.
          </p>
        </div>

        <div className="redact-controls">
          <label className="field">
            <span>Highlight color</span>
            <input type="color" value={highlightColor} onChange={(event) => setHighlightColor(event.target.value)} disabled={isBusy} />
          </label>

          <label className="field">
            <span>Opacity</span>
            <div className="field-inline">
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.01}
                value={highlightOpacity}
                onChange={(event) => setHighlightOpacity(Number(event.target.value))}
                disabled={isBusy}
              />
              <input
                className="field-inline-input"
                type="number"
                min={10}
                max={90}
                step={1}
                value={Math.round(highlightOpacity * 100)}
                onChange={(event) => setHighlightOpacity(clamp(Number(event.target.value || 0) / 100, 0.1, 0.9))}
                disabled={isBusy}
              />
            </div>
          </label>

          <div className="redact-page-summary">
            <strong>Pages with highlights</strong>
            <div className="redact-page-list">
              {Object.keys(highlightRegions).length ? Object.keys(highlightRegions).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={Number(pageNumber) === activePageNumber ? "is-active" : ""}
                  onClick={() => setActiveHighlightPage(Number(pageNumber))}
                >
                  Page {pageNumber}
                  <span>{highlightRegions[pageNumber].length}</span>
                </button>
              )) : <span className="empty-note">No highlight boxes yet</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
