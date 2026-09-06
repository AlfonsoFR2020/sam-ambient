$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$uiRoot = Join-Path $projectRoot "ui"
$localTsc = Join-Path $uiRoot "node_modules/.bin/tsc.cmd"
$localVite = Join-Path $uiRoot "node_modules/.bin/vite.cmd"

if (-not (Test-Path -LiteralPath $localTsc) -or -not (Test-Path -LiteralPath $localVite)) {
    throw "Frontend dependencies are missing. Run pnpm install --frozen-lockfile in ui/ first."
}

Push-Location $uiRoot
try {
    & $localTsc -b --pretty false
    & $localVite build
} finally {
    Pop-Location
}

Push-Location $projectRoot
try {
    uv --native-tls build
} finally {
    Pop-Location
}
