export function OcrEditor({
  activeTool,
  isBusy,
  ocrEngineHint,
  ocrLanguage,
  ocrLanguages,
  ocrPageCount,
  ocrTextPreview,
  setOcrLanguage,
}) {
  const isTextMode = activeTool === "image_text";

  return (
    <div className="crop-editor">
      <div className="crop-editor-head">
        <div>
          <strong>{isTextMode ? "OCR text extraction" : "Searchable PDF"}</strong>
          <span>{isTextMode ? "Extract text from a scanned PDF" : "Build a searchable copy with a text layer"}</span>
        </div>
      </div>

      <div className="crop-controls">
        <div className="crop-grid">
          <label className="field">
            <span>OCR language</span>
            {ocrLanguages?.length ? (
              <select value={ocrLanguage} onChange={(event) => setOcrLanguage(event.target.value)} disabled={isBusy}>
                {ocrLanguages.map((language) => <option key={language} value={language}>{language}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={ocrLanguage}
                onChange={(event) => setOcrLanguage(event.target.value)}
                placeholder="eng"
                disabled={isBusy}
              />
            )}
          </label>
          <div className="field">
            <span>Engine</span>
            <div className="ocr-hint">{ocrEngineHint}</div>
          </div>
        </div>

        {isTextMode ? (
          <div className="ocr-preview">
            <div className="preview-toolbar">
              <div>
                <strong>OCR text preview</strong>
                <span>{ocrPageCount ? `${ocrPageCount} page${ocrPageCount === 1 ? "" : "s"} processed` : "Run OCR to preview text here"}</span>
              </div>
            </div>
            <textarea
              className="ocr-textarea"
              value={ocrTextPreview}
              readOnly
              placeholder="Extracted text will appear here after OCR completes."
            />
          </div>
        ) : (
          <div className="ocr-preview">
            <div className="preview-toolbar">
              <div>
                <strong>What this creates</strong>
                <span>A new PDF that keeps the original pages but adds a searchable OCR text layer.</span>
              </div>
            </div>
            <div className="ocr-hint">
              Use this on scanned PDFs where normal Reader search returns no matches because the file only contains page images.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
