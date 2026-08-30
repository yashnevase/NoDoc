# NoDoc

NoDoc is a local-first PDF workspace. It keeps PDF reading, page operations,
editing, OCR, preview, and export on the user's computer. The React workspace
talks only to a loopback Python sidecar protected by a per-session token; the
Tauri shell supplies the token to the webview in desktop builds.

## What Works Today

- Open multiple PDFs, switch documents, read with PDF.js, search, select text,
  navigate pages, zoom, fit, and use lazy thumbnails.
- Edit a working revision with page targeting, page operations, text stamps,
  watermarks, page numbers, drawing, highlights, secure redaction, and image
  signature placement.
- Commit a revision, preview the actual generated PDF, undo/redo per document,
  continue editing, and export the exact displayed revision without replacing
  the source PDF.
- OCR text extraction and searchable-PDF output using local Tesseract.
- Recover desktop path-based workspace metadata and committed working revision
  references after a restart. Browser-uploaded `File` objects are intentionally
  not persisted because browsers cannot safely restore their original paths.

`Signature Detection` is structural only. It finds PDF signature fields and
basic `ByteRange`/`Contents` markers. It does **not** perform certificate trust,
revocation, or cryptographic signature validation, so NoDoc never calls a
signature trusted or valid.

## Supported Development Versions

- Node.js 22 LTS (`.nvmrc` and `frontend/package.json` enforce the target).
- npm 10 or newer.
- Python 3.10 through 3.12. This repository is tested here with Python 3.12;
  Python 3.9 is unsupported.
- Stable Rust, Cargo, and the Tauri system prerequisites for desktop builds.
- Tesseract 5 with at least `eng` traineddata for OCR.

The checked-in Python requirements are pinned in `backend/requirements.txt`.
PyInstaller is pinned separately in `build/requirements.txt`. The frontend
uses the checked-in `frontend/package-lock.json`.

## Local macOS Startup

These commands run the web workspace from a fresh clone. They deliberately use
one terminal for the sidecar and another for Vite so both processes stay easy
to inspect.

### Install prerequisites

```bash
brew install node@22 python@3.12 tesseract poppler
export PATH="$(brew --prefix node@22)/bin:$PATH"
node --version
python3.12 --version
tesseract --list-langs
```

### Install project dependencies

```bash
cd /path/to/NoDoc
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt -r build/requirements.txt
(cd frontend && npm ci)
```

### Terminal 1 - backend

```bash
cd /path/to/NoDoc
source .venv/bin/activate
./scripts/run-backend.sh
```

The backend listens at `http://127.0.0.1:8000` and prints its dynamic port when
`PRIVATEPDF_PORT=0` is used. The development script uses port `8000` and token
`dev-local-token` to match the frontend development environment.

### Terminal 2 - frontend

```bash
cd /path/to/NoDoc
export PATH="$(brew --prefix node@22)/bin:$PATH"
./scripts/run-frontend.sh
```

Open the Vite URL, normally `http://127.0.0.1:5173`.

### Desktop/Tauri development

Install Rust once, then open a new terminal so Cargo is on `PATH`:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable
source "$HOME/.cargo/env"
rustc --version
cargo --version
```

Create a portable, redistribution-ready OCR directory with this layout before
building a desktop app. Do not point this at an arbitrary Homebrew install:

```text
/path/to/nodoc-ocr-macos/
  bin/tesseract
  tessdata/eng.traineddata
  ...all runtime libraries required by that tesseract binary
```

Then build and run through Tauri. The Tauri build starts the bundled sidecar;
do not also run `run-backend.sh` on the same port.

```bash
cd /path/to/NoDoc
source .venv/bin/activate
export PATH="$(brew --prefix node@22)/bin:$HOME/.cargo/bin:$PATH"
export NODOC_OCR_BUNDLE_DIR=/path/to/nodoc-ocr-macos
./scripts/build-desktop.sh
(cd frontend && npm run tauri -- dev)
```

## Clean Machine Setup

1. Install the prerequisites shown above.
2. Clone the repository and run the dependency-install commands exactly once.
3. Confirm `tesseract --list-langs` includes `eng` for web development.
4. Use the two terminal commands for web development.
5. For a distributable desktop build, use a portable OCR bundle rather than a
   global Tesseract installation, then run `./scripts/build-desktop.sh`.

## Tests and Checks

Run from the repository root:

```bash
PRIVATEPDF_DATA_DIR=/tmp/nodoc-tests .venv/bin/python -m pytest -q
.venv/bin/python -m compileall -q backend/app engines
(cd frontend && npm run build && npm test)
(cd desktop && cargo check)
```

`cargo check` and desktop packaging require Rust. A macOS package is built on
macOS and a Windows package is built on Windows. Tauri creates platform-native
artifacts under `desktop/target/release/bundle/` when its build succeeds.

## Desktop Packaging

`scripts/build-sidecar.sh` produces the macOS/Linux sidecar and requires
`NODOC_OCR_BUNDLE_DIR`. `scripts/build-sidecar.ps1` does the same for Windows
and requires a directory containing `bin\\tesseract.exe` and
`tessdata\\eng.traineddata`. The PyInstaller spec embeds this directory as
application-relative `ocr/` resources. At runtime NoDoc resolves bundled OCR
before `PRIVATEPDF_TESSERACT_PATH`, `TESSERACT_PATH`, or `PATH`.

Build on the target platform:

```bash
# macOS
export NODOC_OCR_BUNDLE_DIR=/path/to/nodoc-ocr-macos
./scripts/build-desktop.sh
```

```powershell
# Windows PowerShell
$env:NODOC_OCR_BUNDLE_DIR = "C:\path\to\nodoc-ocr-windows"
powershell -ExecutionPolicy Bypass -File .\scripts\build-windows-installer.ps1
```

The repository prepares `app`/`dmg` macOS and `msi`/`nsis` Windows targets.
Code signing, macOS notarization, and Windows clean-machine verification still
require the corresponding signing credentials and target hardware.

## Security and Data Lifecycle

- The sidecar binds to `127.0.0.1`, not a network interface.
- Every document, result, library, and job endpoint except `/health` requires
  the session token.
- CORS accepts only the local Vite and Tauri origins by default. Override it
  for deliberate development-only use with `PRIVATEPDF_CORS_ORIGINS`.
- Upload names are sanitized, confined to a per-job directory, and streamed
  with an enforced `PRIVATEPDF_MAX_UPLOAD_MB` limit (default 2048 MB).
- Temporary job directories and downloads older than seven days are removed on
  sidecar startup. Desktop active working revisions are registered with the
  sidecar and protected from that cleanup until a user closes or clears their
  document; normal export never overwrites the original.
- A queued job cancels immediately. A running job becomes `cancelling` and is
  cancelled at the next engine progress checkpoint; any returned output is
  discarded instead of being presented as successful.

## OCR Languages

NoDoc asks Tesseract for installed languages and displays them in the OCR
editor. The development Mac currently exposes `eng`, `osd`, and `snum`. A
requested missing language fails clearly and lists the available choices.
Bundle only product-supported traineddata files. Tesseract and `tessdata`
licensing must be reviewed before redistribution; English is the release
baseline.
