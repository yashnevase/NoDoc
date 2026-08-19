import { Icon } from "./Icon";

export function DropOverlay({ dragDepthRef, handleDrop, isBusy, onBrowse, onClose }) {
  return (
    <div
      className="drop-overlay"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
          onClose();
        }
      }}
    >
      <div className="drop-overlay-card">
        <Icon name="upload" />
        <strong>Drop files into NoDoc</strong>
        <span>PDF, PNG, JPG, WEBP, BMP</span>
        <button type="button" onClick={onBrowse} disabled={isBusy}>
          Browse files
        </button>
      </div>
    </div>
  );
}
