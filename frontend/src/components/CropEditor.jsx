import { clamp } from "../utils/fileHelpers";
import { LazyThumbImage } from "./LazyThumbImage";

function cropPreviewStyle(previewPage, crop) {
  if (!previewPage) return undefined;
  const width = Math.max(1, previewPage.width);
  const height = Math.max(1, previewPage.height);
  const left = clamp(crop.left / width, 0, 0.48);
  const right = clamp(crop.right / width, 0, 0.48);
  const top = clamp(crop.top / height, 0, 0.48);
  const bottom = clamp(crop.bottom / height, 0, 0.48);
  return {
    left: `${left * 100}%`,
    right: `${right * 100}%`,
    top: `${top * 100}%`,
    bottom: `${bottom * 100}%`,
  };
}

export function CropEditor({
  crop,
  isBusy,
  previewPage,
  previewPageLabel,
  previewPageNumber,
  previewPaperStyle,
  previewSessionId,
  selectedPages,
  setCrop,
  setCropScope,
  cropScope,
}) {
  const cropOverlayStyle = cropPreviewStyle(previewPage, crop);
  const cropMaskStyle = cropOverlayStyle
    ? {
        ...cropOverlayStyle,
        "--crop-left": cropOverlayStyle.left,
        "--crop-right": cropOverlayStyle.right,
        "--crop-top": cropOverlayStyle.top,
        "--crop-bottom": cropOverlayStyle.bottom,
      }
    : undefined;

  return (
    <div className="crop-editor">
      <div className="crop-editor-head">
        <div>
          <strong>Crop editor</strong>
          <span>{cropScope === "all" ? "All pages" : `${selectedPages.length} selected`}</span>
        </div>
      </div>

      <div className="crop-editor-body">
        <div className="crop-preview-shell">
          <div className="crop-preview-page" style={previewPaperStyle}>
            <div className="crop-preview-size">{previewPageLabel}</div>
            {previewPage ? (
              <LazyThumbImage
                previewSessionId={previewSessionId}
                pageNumber={previewPageNumber}
                fallbackImage={previewPage.image}
                altText="Selected PDF page preview"
              />
            ) : (
              <div className="crop-preview-empty">Preview</div>
            )}
            {cropMaskStyle && <div className="crop-preview-mask" style={cropMaskStyle} />}
          </div>
          <p className="crop-preview-note">The shaded edges show what will be removed before Apply.</p>
        </div>

        <div className="crop-controls">
          <div className="field">
            <span>Pages</span>
            <div className="segmented-control scope-control">
              {[{ id: "selected", label: "Selected" }, { id: "all", label: "All pages" }].map((scope) => (
                <button
                  key={scope.id}
                  type="button"
                  className={cropScope === scope.id ? "is-active" : ""}
                  onClick={() => setCropScope(scope.id)}
                  disabled={isBusy}
                >
                  <span>{scope.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="crop-grid">
            {[
              ["left", "Left"],
              ["top", "Top"],
              ["right", "Right"],
              ["bottom", "Bottom"],
            ].map(([key, label]) => (
              <label className="field" key={key}>
                <span>{label} margin (pt)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={crop[key]}
                  onChange={(event) => setCrop((current) => ({ ...current, [key]: Number(event.target.value) || 0 }))}
                  disabled={isBusy}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
