use std::{
    fs,
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
};

use tauri::{
    AppHandle,
    menu::{AboutMetadataBuilder, MenuBuilder, PredefinedMenuItem, SubmenuBuilder},
    path::BaseDirectory,
    Manager,
};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_dialog::{DialogExt, FilePath};
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
    let name = if cfg!(target_os = "windows") {
        "nodoc-sidecar.exe"
    } else {
        "nodoc-sidecar"
    };

    if let Ok(path) = app
        .path()
        .resolve(format!("sidecar/{name}"), BaseDirectory::Resource)
    {
        candidates.push(path);
    }

    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        candidates.push(PathBuf::from(manifest_dir).join("sidecar").join(name));
    }

    candidates
}

fn capture_sidecar_stderr(stderr: std::process::ChildStderr, log_path: PathBuf) {
    thread::spawn(move || {
        let parent = match log_path.parent() {
            Some(parent) => parent,
            None => return,
        };
        if fs::create_dir_all(parent).is_err() {
            return;
        }
        let mut output = match fs::OpenOptions::new().create(true).append(true).open(&log_path) {
            Ok(output) => output,
            Err(_) => return,
        };
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            use std::io::Write;
            let _ = writeln!(output, "{line}");
        }
    });
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
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Could not resolve application resources: {error}"))?;
    let log_path = data_dir.join("logs").join("sidecar-stderr.log");

    let mut child = Command::new(sidecar_path)
        .env("PRIVATEPDF_AUTH_TOKEN", &token)
        .env("PRIVATEPDF_DATA_DIR", &data_dir)
        .env("PRIVATEPDF_RESOURCE_DIR", resource_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not start NoDoc sidecar: {error}"))?;

    if let Some(stderr) = child.stderr.take() {
        capture_sidecar_stderr(stderr, log_path);
    }

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

fn file_path_to_string(path: FilePath) -> Option<String> {
    match path {
        FilePath::Path(value) => value.into_os_string().into_string().ok(),
        #[cfg(target_os = "macos")]
        FilePath::Url(value) => value.to_file_path().ok().and_then(|path| path.into_os_string().into_string().ok()),
        #[cfg(not(target_os = "macos"))]
        FilePath::Url(value) => value.to_file_path().ok().and_then(|path| path.into_os_string().into_string().ok()),
    }
}

#[tauri::command]
async fn pick_files(app: AppHandle) -> Result<Vec<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .add_filter("NoDoc files", &["pdf", "png", "jpg", "jpeg", "webp", "bmp"])
        .pick_files(move |paths| {
            let _ = tx.send(paths);
        });

    let selected = rx
        .recv()
        .map_err(|error| format!("Could not receive selected files: {error}"))?;

    Ok(selected
        .unwrap_or_default()
        .into_iter()
        .filter_map(file_path_to_string)
        .collect())
}

#[tauri::command]
async fn pick_save_path(app: AppHandle, default_name: Option<String>) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    let mut builder = app
        .dialog()
        .file()
        .add_filter("PDF Document", &["pdf"]);

    if let Some(name) = default_name.as_deref() {
        builder = builder.set_file_name(name);
    }

    builder.save_file(move |path| {
        let _ = tx.send(path);
    });

    let selected = rx
        .recv()
        .map_err(|error| format!("Could not receive save path: {error}"))?;

    Ok(selected.and_then(file_path_to_string))
}

#[tauri::command]
async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().pick_folder(move |path| {
        let _ = tx.send(path);
    });

    let selected = rx
        .recv()
        .map_err(|error| format!("Could not receive selected folder: {error}"))?;

    Ok(selected.and_then(file_path_to_string))
}

#[tauri::command]
async fn copy_file_to_path(source_path: String, target_path: String) -> Result<(), String> {
    let source = PathBuf::from(source_path);
    let target = PathBuf::from(target_path);

    if !source.exists() {
        return Err("Source file was not found".to_string());
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("Could not create target folder: {error}"))?;
    }

    fs::copy(&source, &target).map_err(|error| format!("Could not save file: {error}"))?;
    Ok(())
}

#[tauri::command]
async fn reveal_path(app: AppHandle, path: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    let reveal_target = if target.is_dir() {
        target
    } else {
        target
            .parent()
            .map(PathBuf::from)
            .ok_or_else(|| "Could not resolve parent folder".to_string())?
    };

    if !reveal_target.exists() {
        return Err("Target folder was not found".to_string());
    }

    let as_text = reveal_target
        .into_os_string()
        .into_string()
        .map_err(|_| "Target folder path is not valid UTF-8".to_string())?;

    app.opener()
        .open_path(as_text, None::<&str>)
        .map_err(|error| format!("Could not open folder: {error}"))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![pick_files, pick_save_path, pick_folder, copy_file_to_path, reveal_path])
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
                .text("file.output", "Choose Output Folder")
                .text("file.clear", "Clear Workspace")
                .separator()
                .quit()
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .text("edit.cancel", "Cancel Current Task")
                .build()?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .text("view.reload", "Reload")
                .text("view.settings", "Show Settings")
                .build()?;

            let help_menu = SubmenuBuilder::new(app, "Help")
                .item(&about)
                .text("help.about", "About NoDoc")
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&file_menu, &edit_menu, &view_menu, &help_menu])
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
                } else if event.id() == "file.output" {
                    let _ = dispatch_dom_event(&window, "nodoc-choose-output-folder");
                } else if event.id() == "file.clear" {
                    let _ = dispatch_dom_event(&window, "nodoc-clear-files");
                } else if event.id() == "edit.cancel" {
                    let _ = dispatch_dom_event(&window, "nodoc-cancel-task");
                } else if event.id() == "view.reload" {
                    let _ = window.eval("window.location.reload();");
                } else if event.id() == "view.settings" {
                    let _ = dispatch_dom_event(&window, "nodoc-open-settings");
                } else if event.id() == "help.about" {
                    let _ = dispatch_dom_event(&window, "nodoc-about");
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run NoDoc desktop app");
}
