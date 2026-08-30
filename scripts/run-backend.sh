#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -x "$repo_root/.venv/bin/python" ]]; then
  echo "Create .venv with Python 3.10-3.12 and install backend/requirements.txt first." >&2
  exit 1
fi

export PRIVATEPDF_DATA_DIR="${PRIVATEPDF_DATA_DIR:-$repo_root/.privatepdf-data}"
export PRIVATEPDF_PORT="${PRIVATEPDF_PORT:-8000}"
export PRIVATEPDF_AUTH_TOKEN="${PRIVATEPDF_AUTH_TOKEN:-dev-local-token}"
export PYTHONPATH="$repo_root/backend:$repo_root${PYTHONPATH:+:$PYTHONPATH}"

cd "$repo_root"
exec "$repo_root/.venv/bin/python" -m app.main
