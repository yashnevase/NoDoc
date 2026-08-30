import { Icon } from "./Icon";
import { imageExtensions } from "../config/tools";
import { hasExtension } from "../utils/fileHelpers";

export function DocumentTabs({
  activeDocumentId,
  documents,
  fileInputRef,
  isBusy,
  onActivate,
  onAdd,
  onClose,
  sessions,
  updateFiles,
}) {
  return (
    <section className="document-tabs-bar" aria-label="Open documents">
      <div className="document-tabs" role="tablist" aria-label="Open documents">
        {documents.map((document) => {
          const active = document.id === activeDocumentId;
          const session = sessions[document.id];
          return (
            <div className={`document-tab ${active ? "is-active" : ""}`} key={document.id}>
              <button
                type="button"
                className="document-tab-main"
                role="tab"
                aria-selected={active}
                onClick={() => onActivate(document.id)}
                disabled={isBusy}
                title={`Open ${document.name}`}
              >
                <Icon name={hasExtension(document.name, imageExtensions) ? "image" : "pdf"} />
                <span>{document.name}</span>
                {session?.dirty && <i className="document-dirty-dot" title="Unapplied changes" />}
                {session?.processing
                  ? <em>Processing</em>
                  : session?.revisionIndex >= 0
                    ? <em>{session.exportedRevisionId === session.revisions?.[session.revisionIndex]?.id ? "Exported" : `Revision ${session.revisionIndex + 1}`}</em>
                    : null}
              </button>
              <button
                type="button"
                className="document-tab-close"
                onClick={() => onClose(document.id)}
                disabled={isBusy}
                aria-label={`Close ${document.name}`}
                title={`Close ${document.name}`}
              >
                <Icon name="close" />
              </button>
            </div>
          );
        })}
      </div>

      <button type="button" className="document-add-button" onClick={onAdd} disabled={isBusy} title="Add documents">
        <Icon name="upload" />
        <span>Add</span>
      </button>
      <input
        ref={fileInputRef}
        className="document-file-input"
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp"
        onChange={(event) => {
          updateFiles(event.target.files ?? []);
          event.target.value = "";
        }}
      />
    </section>
  );
}
