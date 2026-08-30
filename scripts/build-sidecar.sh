#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sidecar_name="nodoc-sidecar"
cd "$repo_root"

if [[ ! -x "$repo_root/.venv/bin/python" ]]; then
  echo "Create the project virtual environment first: python3.12 -m venv .venv" >&2
  exit 1
fi

if [[ ! -x "$repo_root/.venv/bin/pyinstaller" ]]; then
  echo "Install PyInstaller in .venv before building the desktop sidecar." >&2
  exit 1
fi

if [[ -z "${NODOC_OCR_BUNDLE_DIR:-}" || ! -d "$NODOC_OCR_BUNDLE_DIR" ]]; then
  echo "Set NODOC_OCR_BUNDLE_DIR to a portable OCR bundle containing bin/tesseract and tessdata/eng.traineddata." >&2
  exit 1
fi

"$repo_root/.venv/bin/pyinstaller" --clean --noconfirm "$repo_root/build/pyinstaller/nodoc-sidecar.spec"
mkdir -p "$repo_root/desktop/sidecar"
cp "$repo_root/dist/$sidecar_name" "$repo_root/desktop/sidecar/$sidecar_name"
chmod +x "$repo_root/desktop/sidecar/$sidecar_name"

echo "Built desktop/sidecar/$sidecar_name"
