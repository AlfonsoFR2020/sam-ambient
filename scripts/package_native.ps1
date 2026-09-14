param(
    [Parameter(Mandatory = $true)]
    [string]$BuildRoot,
    [string]$CompanionDirectory,
    [switch]$AllowUnsignedDevelopmentBuild,
    [switch]$SkipDistCopy
)

$ErrorActionPreference = "Stop"
if (-not $AllowUnsignedDevelopmentBuild) {
    throw "Native output is unsigned development material. Pass -AllowUnsignedDevelopmentBuild only for controlled validation; do not publish it."
}
$repository = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$root = [System.IO.Path]::GetFullPath($BuildRoot)
$repositoryPrefix = $repository.TrimEnd('\') + '\'
if ([string]::Equals($root, $repository, [System.StringComparison]::OrdinalIgnoreCase) -or
    $root.StartsWith($repositoryPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "BuildRoot must be outside the source repository: $root"
}
if (-not (Test-Path -LiteralPath $root -PathType Container)) {
    throw "BuildRoot must be a unique directory created by the caller: $root"
}

$work = Join-Path $root "native-package"
if (Test-Path -LiteralPath $work) {
    throw "Refusing to replace existing native package work directory: $work"
}
New-Item -ItemType Directory -Path $work | Out-Null

if ($CompanionDirectory) {
    $companion = (Resolve-Path -LiteralPath $CompanionDirectory).Path
} else {
    $companion = Join-Path $work "companion"
    $cxAppData = Join-Path $work "appdata"
    New-Item -ItemType Directory -Path $cxAppData | Out-Null
    $previousAppData = $env:APPDATA
    try {
        $env:APPDATA = $cxAppData
        Push-Location $repository
        try {
            uv run --group package python scripts/build_native_companion.py --output $companion
            if ($LASTEXITCODE -ne 0) { throw "native companion build failed" }
        } finally {
            Pop-Location
        }
    } finally {
        $env:APPDATA = $previousAppData
    }
}

foreach ($required in @("sam-supervisor.exe", "sam-core.exe", "sam-ui.exe", "companion-manifest.json")) {
    if (-not (Test-Path -LiteralPath (Join-Path $companion $required) -PathType Leaf)) {
        throw "Companion is missing required file: $required"
    }
}
$manifest = Get-Content -Raw -LiteralPath (Join-Path $companion "companion-manifest.json") | ConvertFrom-Json
if (-not $manifest.version) { throw "Companion manifest has no version" }

$configPath = Join-Path $work "tauri.package.json"
$resourceSource = ($companion -replace '\\', '/') + "/"
$config = @{
    bundle = @{
        active = $true
        targets = @("nsis")
        resources = @{ $resourceSource = "companion/" }
        useLocalToolsDir = $true
        windows = @{
            webviewInstallMode = @{ type = "downloadBootstrapper" }
            nsis = @{ installMode = "currentUser" }
        }
    }
}
$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $configPath -Encoding utf8

$cargoTarget = Join-Path $work "cargo-target"
$previousCargoTarget = $env:CARGO_TARGET_DIR
try {
    $env:CARGO_TARGET_DIR = $cargoTarget
    Push-Location (Join-Path $repository "ui")
    try {
        pnpm tauri build --config $configPath
        if ($LASTEXITCODE -ne 0) { throw "Tauri NSIS build failed" }
    } finally {
        Pop-Location
    }
} finally {
    $env:CARGO_TARGET_DIR = $previousCargoTarget
}

$installers = @(Get-ChildItem -LiteralPath (Join-Path $cargoTarget "release\bundle\nsis") -Filter "*-setup.exe")
if ($installers.Count -ne 1) {
    throw "Expected exactly one NSIS installer, found $($installers.Count)"
}

if (-not $SkipDistCopy) {
    $dist = Join-Path $repository "dist"
    New-Item -ItemType Directory -Path $dist -Force | Out-Null
    $artifact = Join-Path $dist "Sam_$($manifest.version)_windows_x86_64-unsigned-dev-setup.exe"
    if (Test-Path -LiteralPath $artifact) {
        throw "Refusing to replace existing native artifact: $artifact"
    }
    Copy-Item -LiteralPath $installers[0].FullName -Destination $artifact
    Write-Output $artifact
} else {
    Write-Output $installers[0].FullName
}
