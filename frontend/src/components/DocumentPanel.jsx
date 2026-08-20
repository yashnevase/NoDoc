import { readyToolIds } from "../config/tools";
import { PageGrid } from "./PageGrid";
import { ReaderPanel } from "./ReaderPanel";
import { CropEditor } from "./CropEditor";
import { MetadataEditor } from "./MetadataEditor";
import { RedactEditor } from "./RedactEditor";
import { SignatureReportView } from "./SignatureReportView";
import { WatermarkEditor } from "./WatermarkEditor";

export function DocumentPanel({
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
  endPageDragSelection,
  exactlyOnePdfSelected,
  fileItems,
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
  readerPaperStyle,
  readerZoom,
  reorderActive,
  reorderChanged,
  reorderDragPage,
  resetPageOrder,
  rotateAppliesToAll,
  rotation,
  selectAllPages,
  selectedPages,
  selectionLabel,
  setDropOverlayActive,
  setReaderPageIndex,
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
  topSpacerHeight,
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
  loadMetadata,
  removeAllMetadata,
  redactColor,
  redactRegions,
  activeRedactionPage,
  addRedactionRect,
  removeRedactionRect,
  clearRedactionsForPage,
  clearAllRedactions,
  setActiveRedactionPage,
  setRedactColor,
  setMetadataForm,
  setCrop,
  setCropScope,
}) {
  return (
    <section className="document-panel">
      <div className="document-header">
        <div>
          <h1>{activeToolInfo?.title}</h1>
          <p>{activeToolInfo?.detail}</p>
        </div>
        <span className={`state-pill ${readyToolIds.has(activeTool) ? "is-ready" : "is-planned"}`}>
          {readyToolIds.has(activeTool) ? "Ready" : "Planned"}
        </span>
      </div>

      {exactlyOnePdfSelected ? (
        <div className="preview-panel">
          <div className="panel-heading">
            <h2>Pages</h2>
            <div className="preview-meta">
              <span>{previewBusy ? "..." : `${pagePreview.length} total`}</span>
              {pageToolActive && <span>{selectionLabel}</span>}
              {readerActive && currentReaderPage && <span>{`Page ${currentReaderIndex + 1} / ${pagePreview.length}`}</span>}
              {reorderActive && reorderChanged && <span>Order changed</span>}
            </div>
          </div>

          {readerActive && (
            <ReaderPanel
              currentReaderIndex={currentReaderIndex}
              currentReaderPage={currentReaderPage}
              isBusy={isBusy}
              pagePreview={pagePreview}
              previewBusy={previewBusy}
              previewSessionId={previewSessionId}
              readerPageLabel={readerPageLabel}
              readerPaperStyle={readerPaperStyle}
              readerZoom={readerZoom}
              setReaderPageIndex={setReaderPageIndex}
            />
          )}

          {pageToolActive && (
            <div className="preview-toolbar">
              <div>
                <strong>{pagePreview.length} total</strong>
                <span>
                  {activeTool === "rotate" && rotateAppliesToAll
                    ? "All pages targeted"
                    : activeTool === "watermark" && watermarkAllPages
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
              setWatermarkAngle={setWatermarkAngle}
              setWatermarkColor={setWatermarkColor}
              setWatermarkImageFile={setWatermarkImageFile}
              setWatermarkMode={setWatermarkMode}
              setWatermarkOpacity={setWatermarkOpacity}
              setWatermarkPosition={setWatermarkPosition}
              setWatermarkPreset={setWatermarkPreset}
              setWatermarkScope={setWatermarkScope}
              setWatermarkSize={setWatermarkSize}
              setWatermarkText={setWatermarkText}
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
              setCrop={setCrop}
              setCropScope={setCropScope}
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
              setMetadataForm={setMetadataForm}
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
              selectedPages={selectedPages}
              setActiveRedactionPage={setActiveRedactionPage}
              setRedactColor={setRedactColor}
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
        </div>
      ) : (
        <div className="blank-canvas">
          <img src="/nodoc-logo.png" alt="NoDoc" />
          <h2>{fileItems.length ? "Preview is ready when one PDF is selected" : "Drop files to begin"}</h2>
          <p>Start in Convert for quick exports, then move to Organize for page work.</p>
        </div>
      )}
    </section>
  );
}
