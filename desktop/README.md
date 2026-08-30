# Desktop Shell (Tauri)

NoDoc's desktop shell wraps the React UI and the locally bundled Python
sidecar for macOS and Windows.

It is responsible for:

1. Launching the platform-specific PyInstaller sidecar from `sidecar/`.
2. Reading the sidecar `PRIVATEPDF_PORT=` startup line and relaying a fresh
   per-session token to the frontend over Tauri IPC.
3. Providing application-relative resource paths so bundled OCR can locate
   Tesseract and `tessdata` without a developer-machine path.
4. Native file, save, folder, and reveal dialogs.
5. Draining sidecar stderr to app-local `logs/sidecar-stderr.log` and killing
   the child when the app exits.

The Tauri CSP permits connections only to the local sidecar. Release builds
must supply `NODOC_OCR_BUNDLE_DIR`; the sidecar build intentionally fails
without portable Tesseract and traineddata resources.

Use the commands in the repository README to develop, package, sign, and test
the desktop application on each target platform.
