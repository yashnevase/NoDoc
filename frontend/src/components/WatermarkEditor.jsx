import { quickWatermarkAngles } from "../config/tools";
import { clamp, normalizeAngle } from "../utils/fileHelpers";
import { LazyThumbImage } from "./LazyThumbImage";

export function WatermarkEditor({
  beginWatermarkDial,
  isBusy,
  previewPage,
  previewPageLabel,
  previewPageNumber,
  previewPaperStyle,
  previewSessionId,
  selectedPages,
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
  updateWatermarkImage,
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
}) {
  return (
    <div className="watermark-editor">
      <div className="watermark-editor-head">
        <div>
          <strong>Watermark editor</strong>
          <span>{watermarkAllPages ? "All pages" : `${selectedPages.length} selected`}</span>
        </div>
        <button type="button" onClick={() => setWatermarkText("NoDoc")} disabled={isBusy}>
          Reset text
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
            {watermarkMode === "badge" ? (
              <div
                className={`watermark-preview-badge is-${watermarkPreset}`}
                style={{
                  ...watermarkPlacementStyle,
                  opacity: clamp(watermarkOpacity, 0.05, 1),
                  transform: `translate(-50%, -50%) rotate(${watermarkAngle}deg)`,
                  background: watermarkPreset === "question" ? "#f2cd53" : watermarkColor,
                  color: watermarkPreset === "question" ? "#1f1f1f" : "#ffffff",
                  width: `${clamp(watermarkSize * 2.4, 84, 220)}px`,
                  height: `${clamp(watermarkSize * 2.4, 84, 220)}px`,
                }}
              >
                <strong>{watermarkPreset === "question" ? "?" : "V"}</strong>
                <span>{watermarkText.trim() || "NoDoc"}</span>
              </div>
            ) : watermarkMode === "image" ? (
              watermarkImagePreview ? (
                <img
                  className="watermark-preview-mark-image"
                  src={watermarkImagePreview}
                  alt="Watermark image preview"
                  draggable="false"
                  style={{
                    ...watermarkPlacementStyle,
                    opacity: clamp(watermarkOpacity, 0.05, 1),
                    width: `${clamp(watermarkSize * 3.2, 48, 360)}px`,
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
                  Choose image mark
                </button>
              )
            ) : (
              <div
                className="watermark-preview-text"
                style={{
                  ...watermarkPlacementStyle,
                  opacity: clamp(watermarkOpacity, 0.05, 1),
                  color: watermarkColor,
                  fontSize: `${clamp(watermarkSize, 18, 140)}px`,
                  transform: `translate(-50%, -50%) rotate(${watermarkAngle}deg)`,
                }}
              >
                {watermarkText.trim() || "NoDoc"}
              </div>
            )}
          </div>
          <p className="watermark-preview-note">
            Live preview uses the selected PDF page so placement, angle, size, and opacity are visible before Apply.
          </p>
        </div>

        <div className="watermark-editor-scroll">
          <div className="watermark-grid">
            <div className="field">
              <span>Mode</span>
              <div className="segmented-control scope-control watermark-mode-control">
                {[
                  { id: "text", label: "Text watermark" },
                  { id: "badge", label: "Badge / mark" },
                  { id: "image", label: "Image / signature" },
                ].map((mode) => (
                  <button
                    className={watermarkMode === mode.id ? "is-active" : ""}
                    key={mode.id}
                    type="button"
                    onClick={() => setWatermarkMode(mode.id)}
                    disabled={isBusy}
                  >
                    <span>{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {watermarkMode !== "image" ? (
              <label className="field">
                <span>{watermarkMode === "badge" ? "Label" : "Text"}</span>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(event) => setWatermarkText(event.target.value)}
                  placeholder={watermarkMode === "badge" ? "Stamp label" : "Watermark text"}
                  maxLength={120}
                />
              </label>
            ) : (
              <div className="field">
                <span>Image</span>
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
            )}

            {watermarkMode === "badge" && (
              <div className="field">
                <span>Badge</span>
                <div className="badge-presets">
                  {[
                    { id: "verified", label: "Verified", icon: "V" },
                    { id: "question", label: "Question", icon: "?" },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={watermarkPreset === preset.id ? "is-active" : ""}
                      onClick={() => setWatermarkPreset(preset.id)}
                      disabled={isBusy}
                    >
                      <strong>{preset.icon}</strong>
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="field">
              <span>Pages</span>
              <div className="segmented-control scope-control">
                {[
                  { id: "selected", label: "Selected" },
                  { id: "all", label: "All pages" },
                ].map((scope) => (
                  <button
                    className={watermarkScope === scope.id ? "is-active" : ""}
                    key={scope.id}
                    type="button"
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
                <option value="center">Center</option>
                <option value="top-left">Top left</option>
                <option value="top-right">Top right</option>
                <option value="bottom-left">Bottom left</option>
                <option value="bottom-right">Bottom right</option>
              </select>
            </label>

            <div className="field">
              <span>Angle</span>
              <div className="watermark-angle">
                <button
                  type="button"
                  className="watermark-dial"
                  ref={watermarkDialRef}
                  onPointerDown={beginWatermarkDial}
                  disabled={isBusy}
                  aria-label="Rotate watermark"
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

            <label className="field">
              <span>{watermarkMode === "image" ? "Tint color (text/badge only)" : "Color"}</span>
              <input
                type="color"
                value={watermarkColor}
                onChange={(event) => setWatermarkColor(event.target.value)}
                disabled={isBusy || watermarkMode === "image"}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
