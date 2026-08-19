import { Icon } from "./Icon";
import { formatTime } from "../utils/fileHelpers";

export function SettingsDrawer({
  canUseDesktop,
  exactlyOnePdfSelected,
  exportResultsToFolder,
  handleDownloadOne,
  handleDownloadZip,
  handleRevealPath,
  isBusy,
  jobHistory,
  loadPathItems,
  onCancelCurrentWork,
  onChooseOutputFolder,
  onClearOutputFolder,
  onClose,
  onOpenFiles,
  onReloadPreview,
  onSetJobHistory,
  onSetRecentFiles,
  outputFolder,
  recentFiles,
  showCancelAction,
}) {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <aside className="settings-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <div>
            <h2>Settings</h2>
            <p>Only working local options, recent jobs, and quick cleanup.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Close settings">
            <Icon name="close" />
          </button>
        </div>

        <section className="settings-section">
          <h3>Workspace</h3>
          <div className="settings-actions">
            <button type="button" onClick={onOpenFiles}>Open files</button>
            <button type="button" onClick={onReloadPreview} disabled={!exactlyOnePdfSelected}>Reload preview</button>
            <button type="button" onClick={onCancelCurrentWork} disabled={!showCancelAction}>Cancel task</button>
          </div>
          <div className="settings-actions">
            <button type="button" onClick={onChooseOutputFolder} disabled={isBusy}>Choose output folder</button>
            <button type="button" onClick={onClearOutputFolder} disabled={!outputFolder || isBusy}>Clear output folder</button>
          </div>
          <p className="settings-note">
            {outputFolder ? `Output folder: ${outputFolder}` : "Downloads go to your current browser or desktop app download location."}
          </p>
        </section>

        <section className="settings-section">
          <div className="settings-section-title">
            <h3>Recent jobs</h3>
            <button type="button" onClick={() => onSetJobHistory([])} disabled={!jobHistory.length}>Clear history</button>
          </div>
          {jobHistory.length ? (
            <ul className="settings-list">
              {jobHistory.map((entry) => (
                <li key={entry.id}>
                  <div className="settings-list-main">
                    <strong>{entry.tool}</strong>
                    <span>{entry.count === 1 ? entry.outputs[0] : `${entry.count} outputs`}</span>
                    <span>{entry.outputs.join(", ")}</span>
                    <em>{formatTime(entry.createdAt)}</em>
                  </div>
                  <div className="settings-list-actions">
                    <button type="button" onClick={() => loadPathItems(entry.paths || [], "Loaded result into workspace")} disabled={isBusy || !entry.paths?.length}>
                      <Icon name="openExternal" />
                      <span>Use</span>
                    </button>
                    {entry.paths?.length === 1 ? (
                      <button type="button" onClick={() => handleDownloadOne(entry.paths[0])} disabled={isBusy}>
                        <Icon name="download" />
                        <span>Download</span>
                      </button>
                    ) : (
                      <button type="button" onClick={() => handleDownloadZip(entry.paths || [])} disabled={isBusy || !entry.paths?.length}>
                        <Icon name="download" />
                        <span>ZIP</span>
                      </button>
                    )}
                    {canUseDesktop && outputFolder && entry.paths?.length ? (
                      <button type="button" onClick={() => void exportResultsToFolder(entry.paths)} disabled={isBusy}>
                        <Icon name="folder" />
                        <span>Export</span>
                      </button>
                    ) : null}
                    {canUseDesktop && entry.paths?.length ? (
                      <button type="button" onClick={() => void handleRevealPath(entry.paths[0])} disabled={isBusy}>
                        <Icon name="openExternal" />
                        <span>Show</span>
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="settings-note">No finished jobs yet.</p>
          )}
        </section>

        <section className="settings-section">
          <div className="settings-section-title">
            <h3>Recent files</h3>
            <button type="button" onClick={() => onSetRecentFiles([])} disabled={!recentFiles.length}>Clear list</button>
          </div>
          {recentFiles.length ? (
            <ul className="settings-list compact">
              {recentFiles.map((name) => (
                <li key={name}>
                  <strong>{name}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="settings-note">No recent file names stored yet.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
