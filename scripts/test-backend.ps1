$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    throw "Virtual environment not found at $venvPython. Run 'python -m venv .venv' first."
}

$env:PRIVATEPDF_DATA_DIR = Join-Path $repoRoot ".privatepdf-data"

& $venvPython -m pytest -q
