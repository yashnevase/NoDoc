#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$repo_root/scripts/build-sidecar.sh"
(cd "$repo_root/frontend" && npm run build && npm run tauri -- build)
