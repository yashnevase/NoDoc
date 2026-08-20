import { quickWatermarkAngles } from "../config/tools";
import { clamp, normalizeAngle } from "../utils/fileHelpers";
import { LazyThumbImage } from "./LazyThumbImage";

export function TextEditor({
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
  setWatermarkOpacity,
  setWatermarkPosition,
  setWatermarkScope,
  setWatermarkSize,
  setWatermarkText,
  textAllPages,
  watermarkAngle,
  watermarkColor,
  watermarkDialRef,
  watermarkOpacity,
  watermarkPlacementStyle,
  watermarkPosition,
  watermarkScope,
  watermarkSize,
  watermarkText,
}) {
  return (
    <div className="watermark-editor">
      <div className="watermark-editor-head">
        <div>
          <strong>Text editor</strong>
          <span>{textAllPages ? "All pages" : `${selectedPages.length} selected`}</span>
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
            <div
              className="watermark-preview-text"
              style={{
                ...watermarkPlacementStyle,
                opacity: clamp(watermarkOpacity, 0.05, 1),
                color: watermarkColor,
                fontSize: `${clamp(watermarkSize, 14, 120)}px`,
                transform: `translate(-50%, -50%) rotate(${watermarkAngle}deg)`,
              }}
            >
              {watermarkText.trim() || "NoDoc"}
            </div>
          </div>
          <p className="watermark-preview-note">
            Place readable text on the page with live preview before Apply.
          </p>
        </div>

        <div className="watermark-editor-scroll">
          <div className="watermark-grid">
            <label className="field">
              <span>Text</span>
              <input
                type="text"
                value={watermarkText}
                onChange={(event) => setWatermarkText(event.target.value)}
                placeholder="Enter text to place"
                maxLength={120}
              />
            </label>

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
                  aria-label="Rotate text"
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
                  max={120}
                  step={1}
                  disabled={isBusy}
                />
                <input
                  className="field-inline-input"
                  type="number"
                  value={watermarkSize}
                  onChange={(event) => setWatermarkSize(Number(event.target.value || 0))}
                  min={12}
                  max={120}
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
              <span>Color</span>
              <input type="color" value={watermarkColor} onChange={(event) => setWatermarkColor(event.target.value)} disabled={isBusy} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
