#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export VITE_PRIVATEPDF_PORT="${VITE_PRIVATEPDF_PORT:-8000}"
export VITE_PRIVATEPDF_TOKEN="${VITE_PRIVATEPDF_TOKEN:-dev-local-token}"

cd "$repo_root/frontend"
exec npm run dev -- --host 127.0.0.1
