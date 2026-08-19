import { Icon } from "./Icon";
import { imageExtensions } from "../config/tools";
import { hasExtension } from "../utils/fileHelpers";

export function FilePanel({
  clearFiles,
  fileInputRef,
  fileItems,
  fileNames,
  handleDrop,
  isBusy,
  isDragging,
  onBrowse,
  onDragState,
  removeFileAt,
  updateFiles,
}) {
  return (
    <aside className="file-panel">
      <div className="panel-heading">
        <h2>Files</h2>
        <div className="panel-heading-actions">
          <span>{fileItems.length}</span>
          {fileItems.length > 0 && (
            <button type="button" className="icon-button" onClick={clearFiles} disabled={isBusy} title="Clear files">
              <Icon name="close" />
            </button>
          )}
        </div>
      </div>

      <section
        className={`dropzone ${isDragging ? "is-dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          onDragState(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          onDragState(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          onDragState(false);
        }}
        onDrop={handleDrop}
      >
        <Icon name="upload" />
        <strong>Drop files</strong>
        <span className="dropzone-hint">PDF, PNG, JPG, WEBP, BMP</span>
        <button type="button" onClick={onBrowse} disabled={isBusy}>
          Browse
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp"
          onChange={(event) => updateFiles(event.target.files ?? [])}
        />
      </section>

      {fileItems.length ? (
        <ul className="file-list">
          {fileNames.map((name, index) => (
            <li key={`${name}-${index}`}>
              <Icon name={hasExtension(name, imageExtensions) ? "image" : "pdf"} />
              <span title={fileItems[index].path || name}>{name}</span>
              <button
                type="button"
                className="icon-button"
                onClick={() => removeFileAt(index)}
                disabled={isBusy}
                title={`Remove ${name}`}
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-note">No files loaded</p>
      )}
    </aside>
  );
}
