import { canUseDesktopBridge } from "../api";
import { groups, readyToolIds } from "../config/tools";
import { clamp, pathFolder, pathName } from "../utils/fileHelpers";
import { Icon } from "./Icon";

export function HeaderRibbon({
  actionLabel,
  activeGroup,
  activeTool,
  activeTools,
  cancelCurrentWork,
  chooseGroup,
  chooseTool,
  compressPreset,
  currentReaderIndex,
  exportResultsToFolder,
  fileItems,
  handleDownloadOne,
  handleDownloadZip,
  handleHealthCheck,
  handleRevealPath,
  isBusy,
  loadPathItems,
  openFiles,
  outputFolder,
  pagePreview,
  password,
  readerActive,
  readerZoom,
  resultPaths,
  rotateScope,
  rotation,
  runActiveTool,
  selectionLabel,
  setCompressPreset,
  setPassword,
  setReaderPageIndex,
  setReaderZoom,
  setRotateScope,
  setRotation,
  setShowSettings,
  showCancelAction,
  sourceMode,
  status,
}) {
  return (
    <>
      <section className="titlebar">
        <div className="brand-lockup">
          <img src="/nodoc-logo.png" alt="NoDoc logo" />
          <div>
            <strong>NoDoc</strong>
            <span>{sourceMode === "open-with" ? "Opened from Windows" : "Local workspace"}</span>
          </div>
        </div>
        <div className="quick-actions">
          <button type="button" onClick={openFiles} disabled={isBusy} title="Browse files">
            <Icon name="upload" />
            <span>Open</span>
          </button>
          <button type="button" onClick={handleHealthCheck} disabled={isBusy} title="Check local engine">
            <Icon name="reload" />
            <span>Engine</span>
          </button>
          <button type="button" onClick={() => setShowSettings(true)} disabled={isBusy} title="Open settings">
            <Icon name="settings" />
            <span>Settings</span>
          </button>
        </div>
      </section>

      <nav className="category-tabs" aria-label="Tool categories">
        {groups.map((group) => (
          <button
            className={activeGroup === group.id ? "is-active" : ""}
            key={group.id}
            type="button"
            onClick={() => chooseGroup(group.id)}
          >
            {group.label}
          </button>
        ))}
      </nav>

      <section className="ribbon">
        <div className="ribbon-tools">
          {activeTools.map((tool) => (
            <button
              className={`tool-button ${activeTool === tool.id ? "is-active" : ""} ${tool.status === "planned" ? "is-planned" : ""}`}
              key={tool.id}
              type="button"
              title={`${tool.title}: ${tool.detail}`}
              onClick={() => chooseTool(tool)}
              disabled={isBusy}
            >
              <Icon name={tool.icon} />
              <span>{tool.title}</span>
              <em>{tool.status === "ready" ? tool.needs : "Later"}</em>
            </button>
          ))}
        </div>

        <div className="ribbon-settings">
          <div className="workflow-card">
            <div className="workflow-status">
              <span className={`state-pill ${isBusy ? "is-planned" : "is-ready"}`}>{actionLabel}</span>
              <strong>{selectionLabel || (fileItems.length ? `${fileItems.length} file${fileItems.length === 1 ? "" : "s"} loaded` : "Drop or open files")}</strong>
            </div>
            <p>{status}</p>
            {resultPaths.length > 0 && (
              <div className="workflow-downloads">
                {resultPaths.length === 1 ? (
                  <button type="button" onClick={() => handleDownloadOne(resultPaths[0])} disabled={isBusy}>
                    <Icon name="download" />
                    <span>Download file</span>
                  </button>
                ) : (
                  <button type="button" onClick={handleDownloadZip} disabled={isBusy}>
                    <Icon name="download" />
                    <span>Download ZIP</span>
                  </button>
                )}
                <span>{resultPaths.length ? `${resultPaths.length} file${resultPaths.length === 1 ? "" : "s"} ready` : "No result yet"}</span>
                {canUseDesktopBridge() && outputFolder ? (
                  <button type="button" onClick={() => void exportResultsToFolder()} disabled={isBusy}>
                    <Icon name="folder" />
                    <span>Export</span>
                  </button>
                ) : null}
                <button type="button" onClick={() => loadPathItems(resultPaths, "Loaded result into workspace")} disabled={isBusy}>
                  <Icon name="openExternal" />
                  <span>Use result</span>
                </button>
                {canUseDesktopBridge() ? (
                  <button type="button" onClick={() => void handleRevealPath(resultPaths[0] || outputFolder || pathFolder(resultPaths[0] || ""))} disabled={isBusy}>
                    <Icon name="folder" />
                    <span>Show folder</span>
                  </button>
                ) : null}
                <span>{resultPaths.slice(0, 3).map((path) => pathName(path)).join(", ")}</span>
              </div>
            )}
          </div>

          <div className="ribbon-action-row">
            {activeTool === "rotate" && (
              <>
                <div className="segmented-control rotate-control" aria-label="Rotation">
                  {[0, 90, 180, 270].map((degrees) => (
                    <button
                      className={rotation === degrees ? "is-active" : ""}
                      key={degrees}
                      type="button"
                      title={`Rotate ${degrees} degrees`}
                      aria-label={`Rotate ${degrees} degrees`}
                      onClick={() => setRotation(degrees)}
                      disabled={isBusy}
                    >
                      <Icon name="rotate" />
                      <span>{degrees}</span>
                    </button>
                  ))}
                </div>

                <div className="segmented-control scope-control" aria-label="Rotate scope">
                  {[
                    { id: "selected", label: "Selected" },
                    { id: "all", label: "All pages" },
                  ].map((scope) => (
                    <button
                      className={rotateScope === scope.id ? "is-active" : ""}
                      key={scope.id}
                      type="button"
                      onClick={() => setRotateScope(scope.id)}
                      disabled={isBusy}
                    >
                      <span>{scope.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {activeTool === "password" && (
              <label className="field compact-field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="PDF password"
                />
              </label>
            )}

            {activeTool === "compress" && (
              <div className="segmented-control compress-control" aria-label="Compression preset">
                {[
                  { id: "balanced", label: "Balanced" },
                  { id: "small", label: "Small" },
                  { id: "max", label: "Max" },
                ].map((preset) => (
                  <button
                    className={compressPreset === preset.id ? "is-active" : ""}
                    key={preset.id}
                    type="button"
                    onClick={() => setCompressPreset(preset.id)}
                    disabled={isBusy}
                    title={preset.label}
                  >
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            )}

            {readerActive && (
              <>
                <div className="segmented-control reader-nav-control" aria-label="Reader navigation">
                  <button
                    type="button"
                    onClick={() => setReaderPageIndex((current) => clamp(current - 1, 0, Math.max(0, pagePreview.length - 1)))}
                    disabled={isBusy || currentReaderIndex <= 0}
                  >
                    <span>Prev</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReaderPageIndex((current) => clamp(current + 1, 0, Math.max(0, pagePreview.length - 1)))}
                    disabled={isBusy || currentReaderIndex >= pagePreview.length - 1}
                  >
                    <span>Next</span>
                  </button>
                </div>

                <div className="segmented-control reader-zoom-control" aria-label="Reader zoom">
                  {[
                    { value: 0.9, label: "Fit" },
                    { value: 1, label: "100%" },
                    { value: 1.25, label: "125%" },
                    { value: 1.5, label: "150%" },
                  ].map((zoom) => (
                    <button
                      className={Math.abs(readerZoom - zoom.value) < 0.01 ? "is-active" : ""}
                      key={zoom.label}
                      type="button"
                      onClick={() => setReaderZoom(zoom.value)}
                      disabled={isBusy}
                    >
                      <span>{zoom.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {!readerActive && (
              <button className="primary-action" type="button" onClick={runActiveTool} disabled={isBusy}>
                <Icon name="check" />
                <span>{activeTool === "digital_sign" ? "Check" : readyToolIds.has(activeTool) ? "Apply" : "Planned"}</span>
              </button>
            )}

            {showCancelAction && (
              <button type="button" className="secondary-action" onClick={cancelCurrentWork}>
                <Icon name="close" />
                <span>{isBusy ? "Cancel" : "Reset"}</span>
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
