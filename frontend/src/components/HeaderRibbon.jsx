import { groups, readyToolIds } from "../config/tools";
import { Icon } from "./Icon";

export function HeaderRibbon({
  actionLabel,
  activeDocumentName,
  activeGroup,
  activeTool,
  activeTools,
  cancelCurrentWork,
  canRedoDocument,
  canUndoDocument,
  chooseGroup,
  chooseTool,
  compressPreset,
  fileItems,
  handleDownloadOne,
  handleDownloadZip,
  handleHealthCheck,
  isBusy,
  openFiles,
  redoDocumentChange,
  password,
  resultPaths,
  rotateScope,
  rotation,
  runActiveTool,
  selectionLabel,
  setCompressPreset,
  setPassword,
  setRotateScope,
  setRotation,
  setShowSettings,
  showCancelAction,
  sourceMode,
  status,
  themeMode,
  undoDocumentChange,
  setThemeMode,
}) {
  return (
    <header className="app-header">
      <section className="titlebar">
        <div className="brand-lockup">
          <img src="/nodoc-logo.png" alt="NoDoc logo" />
          <div>
            <strong>NoDoc</strong>
            <span>{activeDocumentName || (sourceMode === "open-with" ? "Opened document" : "Local workspace")}</span>
          </div>
        </div>
        <div className="quick-actions">
          <button type="button" onClick={openFiles} disabled={isBusy} title="Browse files" aria-label="Open documents">
            <Icon name="upload" />
            <span>Open</span>
          </button>
          <button type="button" onClick={undoDocumentChange} disabled={isBusy || !canUndoDocument} title="Undo (Cmd/Ctrl+Z)" aria-label="Undo document change">
            <Icon name="undo" />
          </button>
          <button type="button" onClick={redoDocumentChange} disabled={isBusy || !canRedoDocument} title="Redo (Cmd/Ctrl+Shift+Z)" aria-label="Redo document change">
            <Icon name="redo" />
          </button>
          {activeTool === "reader" && resultPaths.length === 1 && (
            <button type="button" onClick={() => handleDownloadOne(resultPaths[0])} disabled={isBusy} title="Export the displayed revision" aria-label="Export current revision">
              <Icon name="download" />
              <span>Export</span>
            </button>
          )}
          <button className="engine-action" type="button" onClick={handleHealthCheck} disabled={isBusy} title="Check local engine" aria-label="Check local engine">
            <Icon name="reload" />
            <span>Engine</span>
          </button>
          <button className={activeTool === "reader" ? "is-active" : ""} type="button" onClick={() => chooseGroup("tools")} disabled={isBusy || !fileItems.length} title="Read active document" aria-label="Read active document">
            <Icon name="reader" />
            <span>Read</span>
          </button>
          <button type="button" onClick={() => chooseGroup("edit")} disabled={isBusy || !fileItems.length} title="Edit active document" aria-label="Edit active document">
            <Icon name="edit" />
            <span>Edit</span>
          </button>
          <button type="button" onClick={() => chooseGroup("organize")} disabled={isBusy || !fileItems.length} title="Document tools" aria-label="Document tools">
            <Icon name="menu" />
            <span>Tools</span>
          </button>
          <div className="theme-switcher" aria-label="Appearance">
            {[
              { id: "light", label: "Light" },
              { id: "system", label: "System" },
              { id: "dark", label: "Dark" },
            ].map((theme) => (
              <button
                className={themeMode === theme.id ? "is-active" : ""}
                key={theme.id}
                type="button"
                onClick={() => setThemeMode(theme.id)}
                title={`${theme.label} appearance`}
              >
                {theme.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowSettings(true)} disabled={isBusy} title="Open settings" aria-label="Open settings">
            <Icon name="settings" />
            <span>Settings</span>
          </button>
        </div>
      </section>

      {fileItems.length > 0 && activeTool !== "reader" && <>
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
            </button>
          ))}
        </div>

        <div className="ribbon-settings">
          <div className="workflow-status compact-workflow" title={status}>
            <span className={`state-pill ${isBusy ? "is-planned" : "is-ready"}`}>{actionLabel}</span>
            <strong>{selectionLabel || (fileItems.length ? `${fileItems.length} file${fileItems.length === 1 ? "" : "s"}` : "No file")}</strong>
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

            {activeTool !== "reader" && (
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

            {resultPaths.length > 0 && (
              resultPaths.length === 1 ? (
                <button type="button" onClick={() => handleDownloadOne(resultPaths[0])} disabled={isBusy} title="Download completed file">
                  <Icon name="download" />
                  <span>Download</span>
                </button>
              ) : (
                <button type="button" onClick={handleDownloadZip} disabled={isBusy} title="Download completed files as ZIP">
                  <Icon name="download" />
                  <span>ZIP</span>
                </button>
              )
            )}
          </div>
        </div>
      </section>
      </>}
    </header>
  );
}
