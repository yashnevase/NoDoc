import { clamp, normalizeAngle } from "../utils/fileHelpers";
import { quickWatermarkAngles } from "../config/tools";
import { LazyThumbImage } from "./LazyThumbImage";

export function SignatureEditor({
  beginWatermarkDial,
  isBusy,
  previewPage,
  previewPageLabel,
  previewPageNumber,
  previewPaperStyle,
  previewSessionId,
  selectedPages,
  setWatermarkAngle,
  setWatermarkImageFile,
  setWatermarkOpacity,
  setWatermarkPosition,
  setWatermarkScope,
  setWatermarkSize,
  updateWatermarkImage,
  watermarkAngle,
  watermarkImageFile,
  watermarkImageInputRef,
  watermarkImagePreview,
  watermarkOpacity,
  watermarkPlacementStyle,
  watermarkPosition,
  watermarkScope,
  watermarkSize,
}) {
  return (
    <div className="watermark-editor signature-editor">
      <div className="watermark-editor-head">
        <div>
          <strong>Sign editor</strong>
          <span>{watermarkScope === "all" ? "All pages" : `${selectedPages.length} selected`}</span>
        </div>
        <button type="button" onClick={() => setWatermarkImageFile(null)} disabled={isBusy || !watermarkImageFile}>
          Clear image
        </button>
      </div>

      <div className="watermark-editor-body">
        <div className="watermark-preview-shell">
          <div className="watermark-preview-page" style={previewPaperStyle}>
            <div className="watermark-preview-size">{previewPageLabel}</div>
            {previewPage ? (
              <LazyThumbImage
                previewSessionId={previewSessionId}
                pageNumber={previewPageNumber}
                fallbackImage={previewPage.image}
                altText="Selected PDF page preview"
              />
            ) : (
              <div className="watermark-preview-empty">Preview</div>
            )}
            {watermarkImagePreview ? (
              <img
                className="watermark-preview-mark-image signature-mark-image"
                src={watermarkImagePreview}
                alt="Signature image preview"
                draggable="false"
                style={{
                  ...watermarkPlacementStyle,
                  opacity: clamp(watermarkOpacity, 0.05, 1),
                  width: `${clamp(watermarkSize * 3.0, 72, 360)}px`,
                  transform: `translate(-50%, -50%) rotate(${watermarkAngle}deg)`,
                }}
              />
            ) : (
              <button
                type="button"
                className="watermark-image-empty"
                onClick={() => watermarkImageInputRef.current?.click()}
                disabled={isBusy}
              >
                Choose signature image
              </button>
            )}
          </div>
          <p className="watermark-preview-note">
            Place a signature image on the selected page area. The output is flattened into the PDF.
          </p>
        </div>

        <div className="watermark-editor-scroll">
          <div className="watermark-grid">
            <div className="field">
              <span>Signature image</span>
              <div className="watermark-image-picker">
                <button type="button" onClick={() => watermarkImageInputRef.current?.click()} disabled={isBusy}>
                  Choose image
                </button>
                <span title={watermarkImageFile?.name || ""}>{watermarkImageFile?.name || "No image selected"}</span>
                {watermarkImageFile && (
                  <button type="button" onClick={() => setWatermarkImageFile(null)} disabled={isBusy}>
                    Remove
                  </button>
                )}
                <input
                  ref={watermarkImageInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.bmp"
                  onChange={(event) => updateWatermarkImage(event.target.files)}
                />
              </div>
            </div>

            <div className="field">
              <span>Pages</span>
              <div className="segmented-control scope-control">
                {[{ id: "selected", label: "Selected" }, { id: "all", label: "All pages" }].map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    className={watermarkScope === scope.id ? "is-active" : ""}
                    onClick={() => setWatermarkScope(scope.id)}
                    disabled={isBusy}
                  >
                    <span>{scope.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span>Position</span>
              <select value={watermarkPosition} onChange={(event) => setWatermarkPosition(event.target.value)} disabled={isBusy}>
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-left">Bottom left</option>
                <option value="center">Center</option>
                <option value="top-right">Top right</option>
                <option value="top-left">Top left</option>
              </select>
            </label>

            <div className="field">
              <span>Angle</span>
              <div className="watermark-angle">
                <button
                  type="button"
                  className="watermark-dial"
                  onPointerDown={beginWatermarkDial}
                  disabled={isBusy}
                  aria-label="Rotate signature"
                >
                  <span className="watermark-dial-ring" />
                  <span
                    className="watermark-dial-arm"
                    style={{ transform: `rotate(${normalizeAngle(watermarkAngle)}deg)` }}
                  />
                  <span className="watermark-dial-knob" />
                </button>
                <div className="watermark-angle-copy">
                  <strong>{Math.round(normalizeAngle(watermarkAngle))}°</strong>
                  <span>Drag or tap a preset</span>
                </div>
              </div>
              <div className="watermark-quick-angles">
                {quickWatermarkAngles.map((angle) => (
                  <button
                    key={angle}
                    type="button"
                    className={Math.round(normalizeAngle(watermarkAngle)) === angle ? "is-active" : ""}
                    onClick={() => setWatermarkAngle(angle)}
                    disabled={isBusy}
                  >
                    {angle}°
                  </button>
                ))}
                <input
                  className="watermark-angle-input"
                  type="number"
                  value={Math.round(normalizeAngle(watermarkAngle))}
                  min={-180}
                  max={180}
                  step={1}
                  onChange={(event) => setWatermarkAngle(Number(event.target.value || 0))}
                  disabled={isBusy}
                />
              </div>
            </div>

            <label className="field">
              <span>Size</span>
              <div className="field-inline">
                <input
                  type="range"
                  value={watermarkSize}
                  onChange={(event) => setWatermarkSize(Number(event.target.value))}
                  min={12}
                  max={140}
                  step={1}
                  disabled={isBusy}
                />
                <input
                  className="field-inline-input"
                  type="number"
                  value={watermarkSize}
                  onChange={(event) => setWatermarkSize(Number(event.target.value || 0))}
                  min={12}
                  max={140}
                  step={1}
                  disabled={isBusy}
                />
              </div>
            </label>

            <label className="field">
              <span>Opacity</span>
              <div className="field-inline">
                <input
                  type="range"
                  value={watermarkOpacity}
                  onChange={(event) => setWatermarkOpacity(Number(event.target.value))}
                  min={0.05}
                  max={1}
                  step={0.01}
                  disabled={isBusy}
                />
                <input
                  className="field-inline-input"
                  type="number"
                  value={Math.round(watermarkOpacity * 100)}
                  onChange={(event) => setWatermarkOpacity(clamp(Number(event.target.value || 0) / 100, 0.05, 1))}
                  min={5}
                  max={100}
                  step={1}
                  disabled={isBusy}
                />
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
