import { pageActionClass } from "../utils/fileHelpers";
import { LazyThumbImage } from "./LazyThumbImage";

export function PageGrid({
  activeTool,
  beginPageDragSelection,
  bottomSpacerHeight,
  continuePageDragSelection,
  dragDepthRef,
  endPageDragSelection,
  internalDragRef,
  isBusy,
  movePreviewPage,
  pageToolActive,
  previewScrollRef,
  previewSessionId,
  reorderActive,
  reorderDragPage,
  rotateAppliesToAll,
  rotation,
  selectedPages,
  setDropOverlayActive,
  setReorderDragPage,
  togglePage,
  topSpacerHeight,
  visiblePages,
  visibleStartIndex,
}) {
  return (
    <div className="page-grid-viewport" ref={previewScrollRef}>
      <div className={`page-grid preview-${activeTool}`}>
        <div className="page-grid-spacer" aria-hidden="true" style={{ height: `${topSpacerHeight}px` }} />
        {visiblePages.map((page, index) => {
          const selected = selectedPages.includes(page.page);
          const rotationApplies = rotateAppliesToAll || selected;
          return (
            <button
              className={`page-thumb ${pageActionClass(activeTool, selected, rotationApplies)} ${reorderDragPage === page.page ? "is-dragging-page" : ""}`}
              key={page.page}
              style={
                activeTool === "rotate" && rotationApplies
                  ? {
                      "--preview-rotation": `${rotation}deg`,
                      "--preview-scale": rotation === 0 ? "1" : rotation === 180 ? "0.92" : "0.78",
                    }
                  : undefined
              }
              type="button"
              title={reorderActive ? "Drag to reorder pages" : pageToolActive ? "Drag across pages to multi-select" : `Page ${page.page}`}
              draggable={reorderActive && !isBusy}
              onDragStart={(event) => {
                if (!reorderActive) {
                  return;
                }
                event.stopPropagation();
                internalDragRef.current = true;
                dragDepthRef.current = 0;
                setDropOverlayActive(false);
                setReorderDragPage(page.page);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("application/x-nodoc-page", String(page.page));
                event.dataTransfer.setData("text/plain", String(page.page));
              }}
              onDragOver={(event) => {
                if (!reorderActive || isBusy) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                if (!reorderActive || isBusy) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                const draggedPage = Number(event.dataTransfer.getData("application/x-nodoc-page") || reorderDragPage);
                movePreviewPage(draggedPage, page.page);
                internalDragRef.current = false;
                setReorderDragPage(null);
              }}
              onDragEnd={(event) => {
                event.stopPropagation();
                internalDragRef.current = false;
                dragDepthRef.current = 0;
                setDropOverlayActive(false);
                setReorderDragPage(null);
              }}
              onPointerDown={(event) => beginPageDragSelection(page.page, event)}
              onPointerEnter={(event) => continuePageDragSelection(page.page, event)}
              onPointerUp={endPageDragSelection}
              onPointerCancel={endPageDragSelection}
              onClick={(event) => {
                if (reorderActive) {
                  event.preventDefault();
                  return;
                }
                if (!pageToolActive || rotateAppliesToAll) {
                  event.preventDefault();
                  if (pageToolActive && !rotateAppliesToAll) {
                    togglePage(page.page);
                  }
                }
              }}
              onKeyDown={(event) => {
                if (!pageToolActive || rotateAppliesToAll) {
                  return;
                }
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  togglePage(page.page);
                }
              }}
              disabled={isBusy}
            >
              {reorderActive && <strong className="page-thumb-order" data-page={visibleStartIndex + index + 1}>#{visibleStartIndex + index + 1}</strong>}
              <LazyThumbImage
                previewSessionId={previewSessionId}
                pageNumber={page.page}
                fallbackImage={page.image}
                altText={`Page ${page.page}`}
              />
              {reorderActive && <em className="page-thumb-hint">Drag</em>}
              <span>{page.page}</span>
            </button>
          );
        })}
        <div className="page-grid-spacer" aria-hidden="true" style={{ height: `${bottomSpacerHeight}px` }} />
      </div>
    </div>
  );
}
