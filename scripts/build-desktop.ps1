$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$cargoExe = Join-Path $env:USERPROFILE ".cargo\bin\cargo.exe"

if (-not (Test-Path $cargoExe)) {
    throw "Cargo was not found at $cargoExe. Install Rust with rustup first."
}

Push-Location (Join-Path $repoRoot "desktop")
try {
    & $cargoExe build
}
finally {
    Pop-Location
}
