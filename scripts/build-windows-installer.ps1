$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$nodeExeCandidates = @(
    (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"),
    "node"
)
$bundledNodeDir = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
$tauriCli = Join-Path $repoRoot "frontend\node_modules\@tauri-apps\cli\tauri.js"

$nodeExe = $nodeExeCandidates | Where-Object { $_ -eq "node" -or (Test-Path $_) } | Select-Object -First 1
if (-not $nodeExe) {
    throw "Node.js was not found. Install Node.js or run this from a shell where node is on PATH."
}

if (-not (Test-Path $tauriCli)) {
    throw "Tauri CLI dependency not found. Run 'npm install' inside frontend first."
}

powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\build-sidecar.ps1")
powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\build-frontend.ps1")

if (Test-Path $bundledNodeDir) {
    $env:PATH = "$bundledNodeDir;$env:PATH"
}

Push-Location (Join-Path $repoRoot "desktop")
try {
    & $nodeExe $tauriCli build --config (Join-Path $repoRoot "desktop\tauri.conf.json")
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Installer outputs:"
Get-ChildItem (Join-Path $repoRoot "desktop\target\release\bundle") -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -in ".exe", ".msi" } |
    Select-Object FullName, Length, LastWriteTime
