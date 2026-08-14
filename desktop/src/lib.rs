use std::{
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
};

use tauri::{
    menu::{AboutMetadataBuilder, MenuBuilder, PredefinedMenuItem, SubmenuBuilder},
    path::BaseDirectory,
    Manager,
};
use uuid::Uuid;

struct SidecarProcess(Mutex<Option<Child>>);

impl Drop for SidecarProcess {
    fn drop(&mut self) {
        if let Ok(mut child) = self.0.lock() {
            if let Some(mut child) = child.take() {
                let _ = child.kill();
            }
        }
    }
}

fn opened_file_args() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|arg| {
            let lower = arg.to_ascii_lowercase();
            lower.ends_with(".pdf")
                || lower.ends_with(".png")
                || lower.ends_with(".jpg")
                || lower.ends_with(".jpeg")
                || lower.ends_with(".webp")
                || lower.ends_with(".bmp")
        })
        .collect()
}

fn sidecar_candidates(app: &tauri::App) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(path) = app
        .path()
        .resolve("sidecar/nodoc-sidecar.exe", BaseDirectory::Resource)
    {
        candidates.push(path);
    }

    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        candidates.push(PathBuf::from(manifest_dir).join("sidecar/nodoc-sidecar.exe"));
    }

    candidates
}

fn start_sidecar(app: &tauri::App) -> Result<(Child, u16, String), String> {
    let sidecar_path = sidecar_candidates(app)
        .into_iter()
        .find(|path| path.exists())
        .ok_or_else(|| "NoDoc sidecar executable was not found".to_string())?;

    let token = Uuid::new_v4().to_string();
    let data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Could not resolve app data directory: {error}"))?;

    let mut child = Command::new(sidecar_path)
        .env("PRIVATEPDF_AUTH_TOKEN", &token)
        .env("PRIVATEPDF_DATA_DIR", data_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Could not start NoDoc sidecar: {error}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "NoDoc sidecar stdout was not available".to_string())?;
    let mut reader = BufReader::new(stdout);
    let mut first_line = String::new();
    reader
        .read_line(&mut first_line)
        .map_err(|error| format!("Could not read sidecar startup line: {error}"))?;

    let port = first_line
        .trim()
        .strip_prefix("PRIVATEPDF_PORT=")
        .ok_or_else(|| "NoDoc sidecar did not report a port".to_string())?
        .parse::<u16>()
        .map_err(|error| format!("NoDoc sidecar reported an invalid port: {error}"))?;

    Ok((child, port, token))
}

fn dispatch_dom_event(window: &tauri::WebviewWindow, event_name: &str) -> tauri::Result<()> {
    window.eval(format!("window.dispatchEvent(new CustomEvent('{event_name}'));"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let about = PredefinedMenuItem::about(
                app,
                Some("NoDoc"),
                Some(
                    AboutMetadataBuilder::new()
                        .name(Some("NoDoc"))
                        .version(Some("0.1.0"))
                        .short_version(Some("0.1"))
                        .authors(Some(vec!["yashnevase".to_string()]))
                        .comments(Some("Local-first PDF workspace"))
                        .website(Some("https://github.com/yashnevase/NoDoc"))
                        .website_label(Some("Project page"))
                        .build(),
                ),
            )?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .text("file.open", "Open Files")
                .text("file.clear", "Clear Workspace")
                .separator()
                .quit()
                .build()?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .text("view.reload", "Reload")
                .build()?;

            let help_menu = SubmenuBuilder::new(app, "Help")
                .item(&about)
                .text("help.about", "About NoDoc")
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&file_menu, &view_menu, &help_menu])
                .build()?;
            menu.set_as_app_menu()?;

            let opened_files = opened_file_args();
            let (child, port, token) = start_sidecar(app)?;
            app.manage(SidecarProcess(Mutex::new(Some(child))));

            if let Some(window) = app.get_webview_window("main") {
                let token_json = serde_json::to_string(&token)?;
                let files_json = serde_json::to_string(&opened_files)?;
                window.eval(format!(
                    "window.__PRIVATEPDF__={{port:{port},token:{token_json}}};\
                     window.__NODOC_OPEN_FILES__={files_json};\
                     window.dispatchEvent(new CustomEvent('nodoc-ready'));"
                ))?;
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            if let Some(window) = app.get_webview_window("main") {
                if event.id() == "file.open" {
                    let _ = dispatch_dom_event(&window, "nodoc-open-files");
                } else if event.id() == "file.clear" {
                    let _ = dispatch_dom_event(&window, "nodoc-clear-files");
                } else if event.id() == "view.reload" {
                    let _ = window.eval("window.location.reload();");
                } else if event.id() == "help.about" {
                    let _ = dispatch_dom_event(&window, "nodoc-about");
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run NoDoc desktop app");
}
