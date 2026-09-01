$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
$env:UV_CACHE_DIR = Join-Path $PSScriptRoot "../.cache/uv"

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw "uv is required. Install it from https://docs.astral.sh/uv/."
}

uv --native-tls sync --python 3.12 --all-groups
