import { lazy, Suspense } from "react";

import { readyToolIds } from "../config/tools";
import { PageGrid } from "./PageGrid";
import { CropEditor } from "./CropEditor";
import { DrawEditor } from "./DrawEditor";
import { HighlightEditor } from "./HighlightEditor";
import { MetadataEditor } from "./MetadataEditor";
import { OcrEditor } from "./OcrEditor";
import { RedactEditor } from "./RedactEditor";
import { SignatureReportView } from "./SignatureReportView";
import { SignatureEditor } from "./SignatureEditor";
import { TextEditor } from "./TextEditor";
import { WatermarkEditor } from "./WatermarkEditor";

const ReaderPanel = lazy(() => import("./ReaderPanel").then((module) => ({ default: module.ReaderPanel })));

export function DocumentPanel({
  activeDocument,
  activeTool,
  activeToolInfo,
  beginPageDragSelection,
  beginWatermarkDial,
  bottomSpacerHeight,
  clearPages,
  continuePageDragSelection,
  currentReaderIndex,
  currentReaderPage,
  dragDepthRef,
  drawColor,
  drawOpacity,
  drawStrokes,
  drawThickness,
  endPageDragSelection,
  exactlyOnePdfSelected,
  fileItems,
  highlightColor,
  highlightOpacity,
  highlightRegions,
  internalDragRef,
  isBusy,
  movePreviewPage,
  pagePreview,
  pageSelectionLocked,
  pageToolActive,
  previewBusy,
  previewPage,
  previewPageLabel,
  previewPageNumber,
  previewPaperStyle,
  previewScrollRef,
  previewSessionId,
  readerActive,
  readerPageLabel,
  readerZoom,
  revisionStateLabel,
  searchBusy,
  searchQuery,
  searchResults,
  searchSummary,
  reorderActive,
  reorderChanged,
  reorderDragPage,
  resetPageOrder,
  rotateAppliesToAll,
  rotation,
  selectAllPages,
  selectReaderPage,
  selectedPages,
  selectionLabel,
  setDropOverlayActive,
  setReaderPageIndex,
  setReaderZoom,
  setSearchQuery,
  setReorderDragPage,
  setWatermarkAngle,
  setWatermarkColor,
  setWatermarkImageFile,
  setWatermarkMode,
  setWatermarkOpacity,
  setWatermarkPosition,
  setWatermarkPreset,
  setWatermarkScope,
  setWatermarkSize,
  setWatermarkText,
  signatureBusy,
  signatureReport,
  togglePage,
  textAllPages,
  signAllPages,
  topSpacerHeight,
  runReaderSearch,
  clearReaderSearch,
  activeDrawPage,
  addDrawStroke,
  activeHighlightPage,
  clearAllDrawStrokes,
  addHighlightRect,
  clearDrawStrokesForPage,
  clearAllHighlights,
  removeLastDrawStroke,
  clearHighlightsForPage,
  removeHighlightRect,
  updateHighlightRect,
  setActiveDrawPage,
  setActiveHighlightPage,
  setDrawColor,
  setDrawOpacity,
  setDrawThickness,
  setHighlightColor,
  setHighlightOpacity,
  updateWatermarkImage,
  visiblePages,
  visibleStartIndex,
  watermarkAllPages,
  watermarkAngle,
  watermarkColor,
  watermarkDialRef,
  watermarkImageFile,
  watermarkImageInputRef,
  watermarkImagePreview,
  watermarkMode,
  watermarkOpacity,
  watermarkPlacementStyle,
  watermarkPosition,
  watermarkPreset,
  watermarkScope,
  watermarkSize,
  watermarkText,
  crop,
  cropScope,
  metadata,
  metadataForm,
  ocrEngineHint,
  ocrLanguage,
  ocrLanguages,
  ocrPageCount,
  ocrTextPreview,
  loadMetadata,
  beginDocumentEdit,
  removeAllMetadata,
  redactColor,
  redactRegions,
  activeRedactionPage,
  addRedactionRect,
  removeRedactionRect,
  updateRedactionRect,
  clearRedactionsForPage,
  clearAllRedactions,
  setActiveRedactionPage,
  setRedactColor,
  setMetadataForm,
  setOcrLanguage,
  setCrop,
  setCropScope,
  onOpenFiles,
}) {
  const stageDocumentEdit = (setter, key = "editor-control") => (value) => {
    beginDocumentEdit(key);
    setter(value);
  };

  return (
    <section className="document-panel">
      <div className="document-header">
        <div>
          <h1>{activeDocument?.name || "No document"}</h1>
          <p>{activeDocument ? `${readerActive ? "Reading" : `${activeToolInfo?.title}: ${activeToolInfo?.detail}`} · ${revisionStateLabel}` : "Local PDF workspace"}</p>
        </div>
        <span className={`state-pill ${readyToolIds.has(activeTool) ? "is-ready" : "is-planned"}`}>
          {readyToolIds.has(activeTool) ? "Ready" : "Planned"}
        </span>
      </div>

      {exactlyOnePdfSelected ? (
        <div className={`preview-panel document-workbench ${readerActive ? "is-reading" : "is-editing"}`}>
          <div className="panel-heading">
            <h2>Pages</h2>
            <div className="preview-meta">
              <span>{previewBusy ? "..." : `${pagePreview.length} total`}</span>
              {pageToolActive && <span>{selectionLabel}</span>}
              {readerActive && currentReaderPage && <span>{`Page ${currentReaderIndex + 1} / ${pagePreview.length}`}</span>}
              {reorderActive && reorderChanged && <span>Order changed</span>}
            </div>
          </div>

          <Suspense fallback={<div className="reader-module-loading"><span /><p>Opening reader</p></div>}>
            <ReaderPanel
              currentReaderIndex={currentReaderIndex}
              currentReaderPage={currentReaderPage}
              editMode={!readerActive}
              isBusy={isBusy}
              onSelectPage={selectReaderPage}
              pagePreview={pagePreview}
              previewBusy={previewBusy}
              previewSessionId={previewSessionId}
              readerZoom={readerZoom}
              searchBusy={searchBusy}
              searchQuery={searchQuery}
              searchResults={searchResults}
              searchSummary={searchSummary}
              setSearchQuery={setSearchQuery}
              setReaderPageIndex={setReaderPageIndex}
              setReaderZoom={setReaderZoom}
              runSearch={runReaderSearch}
              clearSearch={clearReaderSearch}
              selectedPages={selectedPages}
            />
          </Suspense>

          {!readerActive && <aside className="edit-inspector">

          {pageToolActive && (
            <div className="preview-toolbar">
              <div>
                <strong>{pagePreview.length} total</strong>
                <span>
                  {activeTool === "rotate" && rotateAppliesToAll
                    ? "All pages targeted"
                    : activeTool === "watermark" && watermarkAllPages
                      ? "All pages targeted"
                      : activeTool === "sign" && signAllPages
                        ? "All pages targeted"
                      : activeTool === "text" && textAllPages
                        ? "All pages targeted"
                      : `${selectedPages.length} selected`}
                </span>
              </div>

              <div className="preview-toolbar-actions">
                {!pageSelectionLocked && (
                  <>
                    <button type="button" onClick={selectAllPages} disabled={!pagePreview.length || isBusy}>
                      Select all
                    </button>
                    <button type="button" onClick={clearPages} disabled={!selectedPages.length || isBusy}>
                      Unselect all
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {reorderActive && (
            <div className="preview-toolbar">
              <div>
                <strong>{pagePreview.length} total</strong>
                <span>{reorderChanged ? "Reordered preview" : "Original order"}</span>
              </div>

              <div className="preview-toolbar-actions">
                <button type="button" onClick={resetPageOrder} disabled={!reorderChanged || isBusy}>
                  Reset order
                </button>
              </div>
            </div>
          )}

          {activeTool === "digital_sign" && (
            <SignatureReportView signatureBusy={signatureBusy} signatureReport={signatureReport} />
          )}

          {activeTool === "watermark" && (
            <WatermarkEditor
              beginWatermarkDial={beginWatermarkDial}
              isBusy={isBusy}
              previewPage={previewPage}
              previewPageLabel={previewPageLabel}
              previewPageNumber={previewPageNumber}
              previewPaperStyle={previewPaperStyle}
              previewSessionId={previewSessionId}
              selectedPages={selectedPages}
              setWatermarkAngle={stageDocumentEdit(setWatermarkAngle)}
              setWatermarkColor={stageDocumentEdit(setWatermarkColor)}
              setWatermarkImageFile={stageDocumentEdit(setWatermarkImageFile)}
              setWatermarkMode={stageDocumentEdit(setWatermarkMode)}
              setWatermarkOpacity={stageDocumentEdit(setWatermarkOpacity)}
              setWatermarkPosition={stageDocumentEdit(setWatermarkPosition)}
              setWatermarkPreset={stageDocumentEdit(setWatermarkPreset)}
              setWatermarkScope={stageDocumentEdit(setWatermarkScope)}
              setWatermarkSize={stageDocumentEdit(setWatermarkSize)}
              setWatermarkText={stageDocumentEdit(setWatermarkText)}
              updateWatermarkImage={updateWatermarkImage}
              watermarkAllPages={watermarkAllPages}
              watermarkAngle={watermarkAngle}
              watermarkColor={watermarkColor}
              watermarkDialRef={watermarkDialRef}
              watermarkImageFile={watermarkImageFile}
              watermarkImageInputRef={watermarkImageInputRef}
              watermarkImagePreview={watermarkImagePreview}
              watermarkMode={watermarkMode}
              watermarkOpacity={watermarkOpacity}
              watermarkPlacementStyle={watermarkPlacementStyle}
              watermarkPosition={watermarkPosition}
              watermarkPreset={watermarkPreset}
              watermarkScope={watermarkScope}
              watermarkSize={watermarkSize}
              watermarkText={watermarkText}
            />
          )}

          {activeTool === "sign" && (
            <SignatureEditor
              beginWatermarkDial={beginWatermarkDial}
              isBusy={isBusy}
              previewPage={previewPage}
              previewPageLabel={previewPageLabel}
              previewPageNumber={previewPageNumber}
              previewPaperStyle={previewPaperStyle}
              previewSessionId={previewSessionId}
              selectedPages={selectedPages}
              setWatermarkAngle={stageDocumentEdit(setWatermarkAngle)}
              setWatermarkImageFile={stageDocumentEdit(setWatermarkImageFile)}
              setWatermarkOpacity={stageDocumentEdit(setWatermarkOpacity)}
              setWatermarkPosition={stageDocumentEdit(setWatermarkPosition)}
              setWatermarkScope={stageDocumentEdit(setWatermarkScope)}
              setWatermarkSize={stageDocumentEdit(setWatermarkSize)}
              updateWatermarkImage={updateWatermarkImage}
              watermarkAngle={watermarkAngle}
              watermarkImageFile={watermarkImageFile}
              watermarkImageInputRef={watermarkImageInputRef}
              watermarkImagePreview={watermarkImagePreview}
              watermarkOpacity={watermarkOpacity}
              watermarkPlacementStyle={watermarkPlacementStyle}
              watermarkPosition={watermarkPosition}
              watermarkScope={watermarkScope}
              watermarkSize={watermarkSize}
            />
          )}

          {activeTool === "text" && (
            <TextEditor
              beginWatermarkDial={beginWatermarkDial}
              isBusy={isBusy}
              previewPage={previewPage}
              previewPageLabel={previewPageLabel}
              previewPageNumber={previewPageNumber}
              previewPaperStyle={previewPaperStyle}
              previewSessionId={previewSessionId}
              selectedPages={selectedPages}
              setWatermarkAngle={stageDocumentEdit(setWatermarkAngle)}
              setWatermarkColor={stageDocumentEdit(setWatermarkColor)}
              setWatermarkOpacity={stageDocumentEdit(setWatermarkOpacity)}
              setWatermarkPosition={stageDocumentEdit(setWatermarkPosition)}
              setWatermarkScope={stageDocumentEdit(setWatermarkScope)}
              setWatermarkSize={stageDocumentEdit(setWatermarkSize)}
              setWatermarkText={stageDocumentEdit(setWatermarkText)}
              textAllPages={textAllPages}
              watermarkAngle={watermarkAngle}
              watermarkColor={watermarkColor}
              watermarkDialRef={watermarkDialRef}
              watermarkOpacity={watermarkOpacity}
              watermarkPlacementStyle={watermarkPlacementStyle}
              watermarkPosition={watermarkPosition}
              watermarkScope={watermarkScope}
              watermarkSize={watermarkSize}
              watermarkText={watermarkText}
            />
          )}

          {activeTool === "crop" && (
            <CropEditor
              crop={crop}
              cropScope={cropScope}
              isBusy={isBusy}
              previewPage={previewPage}
              previewPageLabel={previewPageLabel}
              previewPageNumber={previewPageNumber}
              previewPaperStyle={previewPaperStyle}
              previewSessionId={previewSessionId}
              selectedPages={selectedPages}
              setCrop={stageDocumentEdit(setCrop)}
              setCropScope={stageDocumentEdit(setCropScope)}
            />
          )}

          {activeTool === "metadata" && (
            <MetadataEditor
              isBusy={isBusy}
              loadMetadata={loadMetadata}
              metadata={metadata}
              metadataForm={metadataForm}
              removeAllMetadata={removeAllMetadata}
              selectedPages={selectedPages}
              setMetadataForm={stageDocumentEdit(setMetadataForm)}
            />
          )}

          {["image_text", "searchable"].includes(activeTool) && (
            <OcrEditor
              activeTool={activeTool}
              isBusy={isBusy}
              ocrEngineHint={ocrEngineHint}
              ocrLanguage={ocrLanguage}
              ocrLanguages={ocrLanguages}
              ocrPageCount={ocrPageCount}
              ocrTextPreview={ocrTextPreview}
              setOcrLanguage={setOcrLanguage}
            />
          )}

          {activeTool === "redact" && (
            <RedactEditor
              activeRedactionPage={activeRedactionPage}
              addRedactionRect={addRedactionRect}
              clearAllRedactions={clearAllRedactions}
              clearRedactionsForPage={clearRedactionsForPage}
              isBusy={isBusy}
              pagePreview={pagePreview}
              previewSessionId={previewSessionId}
              redactColor={redactColor}
              redactRegions={redactRegions}
              removeRedactionRect={removeRedactionRect}
              updateRedactionRect={updateRedactionRect}
              selectedPages={selectedPages}
              setActiveRedactionPage={setActiveRedactionPage}
              setRedactColor={stageDocumentEdit(setRedactColor, "redaction-style")}
            />
          )}

          {activeTool === "highlight" && (
            <HighlightEditor
              activeHighlightPage={activeHighlightPage}
              addHighlightRect={addHighlightRect}
              clearAllHighlights={clearAllHighlights}
              clearHighlightsForPage={clearHighlightsForPage}
              highlightColor={highlightColor}
              highlightOpacity={highlightOpacity}
              highlightRegions={highlightRegions}
              isBusy={isBusy}
              pagePreview={pagePreview}
              previewSessionId={previewSessionId}
              removeHighlightRect={removeHighlightRect}
              updateHighlightRect={updateHighlightRect}
              selectedPages={selectedPages}
              setActiveHighlightPage={setActiveHighlightPage}
              setHighlightColor={stageDocumentEdit(setHighlightColor, "highlight-style")}
              setHighlightOpacity={stageDocumentEdit(setHighlightOpacity, "highlight-style")}
            />
          )}

          {activeTool === "draw" && (
            <DrawEditor
              activeDrawPage={activeDrawPage}
              addDrawStroke={addDrawStroke}
              clearAllDrawStrokes={clearAllDrawStrokes}
              clearDrawStrokesForPage={clearDrawStrokesForPage}
              drawColor={drawColor}
              drawOpacity={drawOpacity}
              drawStrokes={drawStrokes}
              drawThickness={drawThickness}
              isBusy={isBusy}
              pagePreview={pagePreview}
              previewSessionId={previewSessionId}
              removeLastDrawStroke={removeLastDrawStroke}
              selectedPages={selectedPages}
              setActiveDrawPage={setActiveDrawPage}
              setDrawColor={stageDocumentEdit(setDrawColor, "drawing-style")}
              setDrawOpacity={stageDocumentEdit(setDrawOpacity, "drawing-style")}
              setDrawThickness={stageDocumentEdit(setDrawThickness, "drawing-style")}
            />
          )}

          {!readerActive && previewBusy ? (
            <div className="preview-loading">
              <span />
              <p>Rendering preview</p>
            </div>
          ) : !readerActive ? (
            <PageGrid
              activeTool={activeTool}
              beginPageDragSelection={beginPageDragSelection}
              bottomSpacerHeight={bottomSpacerHeight}
              continuePageDragSelection={continuePageDragSelection}
              dragDepthRef={dragDepthRef}
              endPageDragSelection={endPageDragSelection}
              internalDragRef={internalDragRef}
              isBusy={isBusy}
              movePreviewPage={movePreviewPage}
              pageToolActive={pageToolActive}
              previewScrollRef={previewScrollRef}
              previewSessionId={previewSessionId}
              reorderActive={reorderActive}
              reorderDragPage={reorderDragPage}
              rotateAppliesToAll={rotateAppliesToAll}
              rotation={rotation}
              selectedPages={selectedPages}
              setDropOverlayActive={setDropOverlayActive}
              setReorderDragPage={setReorderDragPage}
              togglePage={togglePage}
              topSpacerHeight={topSpacerHeight}
              visiblePages={visiblePages}
              visibleStartIndex={visibleStartIndex}
            />
          ) : null}
          </aside>}
        </div>
      ) : (
        <div className="blank-canvas">
          <img src="/nodoc-logo.png" alt="NoDoc" />
          <h2>{fileItems.length ? "Choose a PDF to start reading" : "Open a PDF and start reading"}</h2>
          <p>{fileItems.length ? "Select a PDF from the document strip above." : "Files stay on this device."}</p>
          <button type="button" className="primary-action" onClick={onOpenFiles}>Open PDF</button>
        </div>
      )}
    </section>
  );
}
