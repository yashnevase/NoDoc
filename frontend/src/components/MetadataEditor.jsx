export function MetadataEditor({
  isBusy,
  metadata,
  loadMetadata,
  metadataForm,
  setMetadataForm,
  removeAllMetadata,
  selectedPages,
}) {
  return (
    <div className="crop-editor">
      <div className="crop-editor-head">
        <div>
          <strong>Metadata</strong>
          <span>{selectedPages.length ? `${selectedPages.length} selected` : "Single PDF"}</span>
        </div>
      </div>

      <div className="crop-controls">
        <div className="preview-toolbar">
          <div>
            <strong>Current values</strong>
            <span>{metadata ? "Loaded from file" : "No metadata loaded"}</span>
          </div>
          <div className="preview-toolbar-actions">
            <button type="button" onClick={loadMetadata} disabled={isBusy}>Load</button>
            <button type="button" onClick={removeAllMetadata} disabled={isBusy}>Remove all</button>
          </div>
        </div>
        <div className="crop-grid">
          {["title", "author", "subject", "keywords", "creator", "producer"].map((key) => (
            <label className="field" key={key}>
              <span>{key[0].toUpperCase() + key.slice(1)}</span>
              <input
                value={metadataForm[key]}
                onChange={(event) => setMetadataForm((current) => ({ ...current, [key]: event.target.value }))}
                disabled={isBusy}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
