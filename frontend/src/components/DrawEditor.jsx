import { useEffect, useRef, useState } from "react";

import { clamp } from "../utils/fileHelpers";
import { LazyThumbImage } from "./LazyThumbImage";

function pointWithinPreview(event, rect) {
  const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  return { x, y };
}

function pathData(points, width, height) {
  if (!points.length) {
    return "";
  }
  return points
    .map((point, index) => {
      const x = clamp(point.x, 0, 1) * width;
      const y = clamp(point.y, 0, 1) * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export function DrawEditor({
  activeDrawPage,
  addDrawStroke,
  clearAllDrawStrokes,
  clearDrawStrokesForPage,
  drawColor,
  drawOpacity,
  drawStrokes,
  drawThickness,
  isBusy,
  pagePreview,
  previewSessionId,
  removeLastDrawStroke,
  selectedPages,
  setActiveDrawPage,
  setDrawColor,
  setDrawOpacity,
  setDrawThickness,
}) {
  const previewHostRef = useRef(null);
  const [draftStroke, setDraftStroke] = useState(null);

  const selectedPage = selectedPages[selectedPages.length - 1];
  const activePageNumber = activeDrawPage || selectedPage || pagePreview[0]?.page || 1;
  const previewPage = pagePreview.find((page) => page.page === activePageNumber) || pagePreview[0] || null;
  const pageStrokes = drawStrokes[activePageNumber] || [];
  const totalStrokes = Object.values(drawStrokes).reduce((sum, strokes) => sum + strokes.length, 0);
  const previewWidth = 320;
  const previewHeight = previewPage ? Math.max(160, Math.round((previewWidth * previewPage.height) / Math.max(1, previewPage.width))) : 240;

  useEffect(() => {
    if (selectedPage && selectedPage !== activeDrawPage) {
      setActiveDrawPage(selectedPage);
    }
  }, [activeDrawPage, selectedPage, setActiveDrawPage]);

  useEffect(() => {
    if (!activeDrawPage && previewPage?.page) {
      setActiveDrawPage(previewPage.page);
    }
  }, [activeDrawPage, previewPage, setActiveDrawPage]);

  function finishStroke() {
    if (!draftStroke || draftStroke.points.length < 2 || !previewPage) {
      setDraftStroke(null);
      return;
    }
    addDrawStroke(previewPage.page, draftStroke.points);
    setDraftStroke(null);
  }

  return (
    <div className="redact-editor draw-editor">
      <div className="redact-editor-head">
        <div>
          <strong>Draw editor</strong>
          <span>{totalStrokes ? `${totalStrokes} stroke${totalStrokes === 1 ? "" : "s"} saved` : "Press and drag to draw on the page"}</span>
        </div>
        <div className="preview-toolbar-actions">
          <button type="button" onClick={() => removeLastDrawStroke(activePageNumber)} disabled={isBusy || !pageStrokes.length}>
            Undo last
          </button>
          <button type="button" onClick={() => clearDrawStrokesForPage(activePageNumber)} disabled={isBusy || !pageStrokes.length}>
            Clear page
          </button>
          <button type="button" onClick={clearAllDrawStrokes} disabled={isBusy || !totalStrokes}>
            Clear all
          </button>
        </div>
      </div>

      <div className="redact-editor-body">
        <div className="redact-preview-shell">
          <div
            className="redact-preview-page draw-preview-page"
            ref={previewHostRef}
            style={previewPage ? { aspectRatio: `${Math.max(1, previewPage.width)} / ${Math.max(1, previewPage.height)}` } : undefined}
            onPointerDown={(event) => {
              if (isBusy || !previewPage || !previewHostRef.current || event.button !== 0) {
                return;
              }
              event.preventDefault();
              const bounds = previewHostRef.current.getBoundingClientRect();
              const start = pointWithinPreview(event, bounds);
              setActiveDrawPage(previewPage.page);
              setDraftStroke({ points: [start] });
              previewHostRef.current.setPointerCapture?.(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!draftStroke || !previewHostRef.current) {
                return;
              }
              const bounds = previewHostRef.current.getBoundingClientRect();
              const point = pointWithinPreview(event, bounds);
              setDraftStroke((current) => (current ? { points: [...current.points, point] } : current));
            }}
            onPointerUp={finishStroke}
            onPointerCancel={() => setDraftStroke(null)}
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
              <svg className="draw-overlay" viewBox={`0 0 ${previewWidth} ${previewHeight}`} preserveAspectRatio="none">
                {pageStrokes.map((stroke, index) => (
                  <path
                    key={`${activePageNumber}-${index}`}
                    d={pathData(stroke.points, previewWidth, previewHeight)}
                    fill="none"
                    stroke={drawColor}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity={drawOpacity}
                    strokeWidth={drawThickness}
                  />
                ))}
                {draftStroke?.points?.length ? (
                  <path
                    d={pathData(draftStroke.points, previewWidth, previewHeight)}
                    fill="none"
                    stroke={drawColor}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity={Math.min(1, drawOpacity + 0.08)}
                    strokeWidth={drawThickness}
                  />
                ) : null}
              </svg>
            </div>
          </div>
          <p className="crop-preview-note">
            Freehand strokes are flattened into the exported PDF so they stay visible anywhere the file is opened.
          </p>
        </div>

        <div className="redact-controls">
          <label className="field">
            <span>Pen color</span>
            <input type="color" value={drawColor} onChange={(event) => setDrawColor(event.target.value)} disabled={isBusy} />
          </label>

          <label className="field">
            <span>Thickness</span>
            <div className="field-inline">
              <input
                type="range"
                min={1}
                max={24}
                step={1}
                value={drawThickness}
                onChange={(event) => setDrawThickness(Number(event.target.value))}
                disabled={isBusy}
              />
              <input
                className="field-inline-input"
                type="number"
                min={1}
                max={24}
                step={1}
                value={drawThickness}
                onChange={(event) => setDrawThickness(clamp(Number(event.target.value || 1), 1, 24))}
                disabled={isBusy}
              />
            </div>
          </label>

          <label className="field">
            <span>Opacity</span>
            <div className="field-inline">
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.01}
                value={drawOpacity}
                onChange={(event) => setDrawOpacity(Number(event.target.value))}
                disabled={isBusy}
              />
              <input
                className="field-inline-input"
                type="number"
                min={10}
                max={100}
                step={1}
                value={Math.round(drawOpacity * 100)}
                onChange={(event) => setDrawOpacity(clamp(Number(event.target.value || 0) / 100, 0.1, 1))}
                disabled={isBusy}
              />
            </div>
          </label>

          <div className="redact-page-summary">
            <strong>Pages with drawing</strong>
            <div className="redact-page-list">
              {Object.keys(drawStrokes).length ? Object.keys(drawStrokes).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={Number(pageNumber) === activePageNumber ? "is-active" : ""}
                  onClick={() => setActiveDrawPage(Number(pageNumber))}
                >
                  Page {pageNumber}
                  <span>{drawStrokes[pageNumber].length}</span>
                </button>
              )) : <span className="empty-note">No drawing strokes yet</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
