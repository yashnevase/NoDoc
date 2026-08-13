$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
$specPath = Join-Path $repoRoot "build\pyinstaller\nodoc-sidecar.spec"
$pyInstallerConfig = Join-Path $repoRoot "build\output\pyinstaller-config"
$pyInstallerAppData = Join-Path $repoRoot "build\output\appdata"

if (-not (Test-Path $venvPython)) {
    throw "Virtual environment not found at $venvPython. Run 'python -m venv .venv' first."
}

$env:PYTHONNOUSERSITE = "1"
$env:PYINSTALLER_CONFIG_DIR = $pyInstallerConfig
$env:APPDATA = $pyInstallerAppData

New-Item -ItemType Directory -Force -Path $pyInstallerConfig | Out-Null
New-Item -ItemType Directory -Force -Path $pyInstallerAppData | Out-Null

& $venvPython -m pip install -r (Join-Path $repoRoot "build\requirements.txt")
& $venvPython -m PyInstaller --clean --noconfirm --distpath (Join-Path $repoRoot "desktop\sidecar") --workpath (Join-Path $repoRoot "build\output\pyinstaller-work") $specPath
