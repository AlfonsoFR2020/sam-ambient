$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$uvCommand = (Get-Command uv -ErrorAction Stop).Source
$env:UV_CACHE_DIR = Join-Path $projectRoot ".cache/uv"
$env:VITE_SAM_TRANSPORT = "core"

$bridge = Start-Process -FilePath $uvCommand `
    -ArgumentList @("run", "sam", "bridge", "--demo") `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -PassThru

try {
    $uiRoot = Join-Path $projectRoot "ui"
    Push-Location $uiRoot
    $localVite = Join-Path $uiRoot "node_modules/.bin/vite.cmd"
    if (Test-Path -LiteralPath $localVite) {
        & $localVite
    } else {
        $pnpmCommand = if ($env:SAM_PNPM) {
            $env:SAM_PNPM
        } else {
            (Get-Command pnpm -ErrorAction Stop).Source
        }
        & $pnpmCommand dev
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Vite exited with code $LASTEXITCODE"
    }
} finally {
    Pop-Location
    if (-not $bridge.HasExited) {
        $bridge.Kill($true)
        $bridge.WaitForExit()
    }
}
