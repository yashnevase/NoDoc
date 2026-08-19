import { canUseDesktopBridge } from "../api";
import { pathFolder, pathName } from "../utils/fileHelpers";
import { Icon } from "./Icon";

export function StatusBar({
  exportResultsToFolder,
  handleDownloadOne,
  handleDownloadZip,
  handleRevealPath,
  isBusy,
  loadPathItems,
  outputFolder,
  resultPaths,
  status,
}) {
  return (
    <footer className="statusbar">
      <p>{status}</p>
      <div className="result-actions">
        {resultPaths.length > 0 && (
          <>
            <span>{resultPaths.length === 1 ? pathName(resultPaths[0]) : `${resultPaths.length} output files ready`}</span>
            {resultPaths.length === 1 ? (
              <button type="button" onClick={() => handleDownloadOne(resultPaths[0])} disabled={isBusy}>
                <Icon name="download" />
                <span>Download</span>
              </button>
            ) : (
              <button type="button" onClick={handleDownloadZip} disabled={isBusy}>
                <Icon name="download" />
                <span>Download ZIP</span>
              </button>
            )}
            {canUseDesktopBridge() && outputFolder ? (
              <button type="button" onClick={() => void exportResultsToFolder()} disabled={isBusy}>
                <Icon name="folder" />
                <span>Export</span>
              </button>
            ) : null}
            <button type="button" onClick={() => loadPathItems(resultPaths, "Loaded result into workspace")} disabled={isBusy}>
              <Icon name="openExternal" />
              <span>Use</span>
            </button>
            {canUseDesktopBridge() ? (
              <button type="button" onClick={() => void handleRevealPath(resultPaths[0] || outputFolder || pathFolder(resultPaths[0] || ""))} disabled={isBusy}>
                <Icon name="folder" />
                <span>Show folder</span>
              </button>
            ) : null}
          </>
        )}
      </div>
    </footer>
  );
}
