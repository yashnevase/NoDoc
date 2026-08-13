# NoDoc

A free, offline, privacy-first PDF/document toolbox for Windows (macOS/Linux planned).
Files never leave your device. No account, no API keys, no cloud processing.

## Status: Milestone 0 (architecture) — see docs/

- `docs/ARCHITECTURE.md` — how the pieces fit together
- `docs/FEATURE_MATRIX.md` — full feature list, tech choices, license notes
- `docs/DEPENDENCY_INVENTORY.md` — every third-party dependency and its license
- `docs/PRIVACY.md` — the privacy claims and how they're enforced

## Repository layout

```
frontend/   React UI (Tauri webview)
backend/    Python FastAPI sidecar (local loopback API only)
engines/    Pure processing logic — pdf, images, ocr, office, compression, encryption, metadata
desktop/    Tauri (Rust) shell — spawns/manages the sidecar
tests/      pytest suite for engines + backend
docs/       architecture, feature matrix, dependency inventory, privacy docs
build/      packaging scripts (PyInstaller specs, installer config)
```

## Running the backend tests

```
pip install -r backend/requirements.txt
pytest
```

## Local dev setup

Create and use a project-local virtual environment so backend logs, temp files,
and test artifacts stay inside the repo during development:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements.txt
```

For local runs in this repo, set `PRIVATEPDF_DATA_DIR` to a writable folder in
the workspace:

```powershell
$env:PRIVATEPDF_DATA_DIR = "$PWD/.privatepdf-data"
.\.venv\Scripts\python -m pytest -q
```

Convenience scripts are available at `scripts/test-backend.ps1` and
`scripts/run-backend.ps1`.

## Run locally

Backend only:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-backend.ps1
```

That starts the sidecar on `http://127.0.0.1:8000` with a fixed local-dev token.
You can verify it with:

```powershell
.\.venv\Scripts\python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').read().decode())"
```

Frontend dev screen:

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Then open the Vite URL shown in the terminal. The current UI is intentionally
minimal but usable: drag/drop or browse files, choose a tool, then download the
result file or ZIP.

Current local tools:

- Merge many PDFs into one PDF
- Convert many images into one PDF
- Split one PDF into one PDF per page
- Convert one PDF into PNG page images
- Extract selected pages into a new PDF
- Delete selected pages from a PDF
- Rotate all pages, or selected pages, in a PDF
- Password-protect a PDF
- Remove PDF metadata

## Desktop packaging path

Windows sidecar build:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-sidecar.ps1
```

Desktop shell build, after Rust is installed:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-desktop.ps1
```

Windows installer packaging will use Tauri's `msi`/`nsis` targets. macOS `.dmg`
should be built on macOS, and Linux packages should be built on Linux.

## Development principles

Free. Private. Offline. Local. Simple. Reliable. Transparent. Maintainable.
No forced accounts, no telemetry by default, no silent network calls, no fake/placeholder features.
