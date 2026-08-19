import { clamp } from "../utils/fileHelpers";

export function useDocumentViewModel({
  pagePreview,
  previewViewport,
  readerPageIndex,
  readerZoom,
  watermarkPosition,
}) {
  const previewPage = pagePreview[0];
  const currentReaderIndex = pagePreview.length ? clamp(readerPageIndex, 0, pagePreview.length - 1) : 0;
  const currentReaderPage = pagePreview[currentReaderIndex] || null;
  const previewPageNumber = previewPage?.page || 1;
  const previewPageLabel = previewPage
    ? `${Math.round(previewPage.width)} x ${Math.round(previewPage.height)} pt`
    : "Page preview";
  const readerPageLabel = currentReaderPage
    ? `${Math.round(currentReaderPage.width)} x ${Math.round(currentReaderPage.height)} pt`
    : "Page preview";
  const previewPaperStyle = previewPage
    ? {
        aspectRatio: `${Math.max(1, previewPage.width)} / ${Math.max(1, previewPage.height)}`,
        maxHeight: "min(34vh, 280px)",
      }
    : undefined;
  const readerPaperStyle = currentReaderPage
    ? {
        aspectRatio: `${Math.max(1, currentReaderPage.width)} / ${Math.max(1, currentReaderPage.height)}`,
        width: `${Math.round(clamp(620 * readerZoom, 320, 1160))}px`,
      }
    : undefined;

  const pageGridItemHeight = 208;
  const pageGridGap = 14;
  const pageGridMinWidth = 132;
  const pageGridColumns = previewViewport.width
    ? Math.max(1, Math.floor((previewViewport.width + pageGridGap) / (pageGridMinWidth + pageGridGap)))
    : 1;
  const pageGridRowCount = Math.ceil(pagePreview.length / pageGridColumns);
  const visibleStartRow = previewViewport.height
    ? Math.max(0, Math.floor(previewViewport.scrollTop / pageGridItemHeight) - 2)
    : 0;
  const visibleEndRow = previewViewport.height
    ? Math.min(pageGridRowCount, Math.ceil((previewViewport.scrollTop + previewViewport.height) / pageGridItemHeight) + 2)
    : pageGridRowCount;
  const visibleStartIndex = visibleStartRow * pageGridColumns;
  const visibleEndIndex = Math.min(pagePreview.length, visibleEndRow * pageGridColumns);

  const watermarkPlacementStyle = watermarkPosition === "top-left"
    ? { left: "24%", top: "22%" }
    : watermarkPosition === "top-right"
      ? { left: "76%", top: "22%" }
      : watermarkPosition === "bottom-left"
        ? { left: "24%", top: "78%" }
        : watermarkPosition === "bottom-right"
          ? { left: "76%", top: "78%" }
          : { left: "50%", top: "50%" };

  return {
    bottomSpacerHeight: Math.max(0, (pageGridRowCount - visibleEndRow) * pageGridItemHeight),
    currentReaderIndex,
    currentReaderPage,
    previewPage,
    previewPageLabel,
    previewPageNumber,
    previewPaperStyle,
    readerPageLabel,
    readerPaperStyle,
    topSpacerHeight: visibleStartRow * pageGridItemHeight,
    visiblePages: pagePreview.slice(visibleStartIndex, visibleEndIndex),
    visibleStartIndex,
    watermarkPlacementStyle,
  };
}
