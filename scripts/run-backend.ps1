$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    throw "Virtual environment not found at $venvPython. Run 'python -m venv .venv' first."
}

$env:PRIVATEPDF_DATA_DIR = Join-Path $repoRoot ".privatepdf-data"
$env:PRIVATEPDF_PORT = "8000"
$env:PRIVATEPDF_AUTH_TOKEN = "dev-local-token"
$env:PYTHONPATH = "$repoRoot\backend;$repoRoot"

Push-Location (Join-Path $repoRoot "backend")
try {
    & $venvPython -m app.main
}
finally {
    Pop-Location
}
