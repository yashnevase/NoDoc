$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$nodeExe = if (Test-Path $bundledNode) { $bundledNode } else { "node" }
$viteCli = Join-Path $repoRoot "frontend\node_modules\vite\bin\vite.js"
$viteConfig = Join-Path $repoRoot "frontend\vite.config.js"
$frontendRoot = Join-Path $repoRoot "frontend"

if (-not (Test-Path $viteCli)) {
    throw "Vite dependency not found. Run 'npm install' inside frontend first."
}

Push-Location $repoRoot
try {
    & $nodeExe $viteCli build --config $viteConfig $frontendRoot
}
finally {
    Pop-Location
}
