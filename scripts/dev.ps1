$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
$env:UV_CACHE_DIR = Join-Path $PSScriptRoot "../.cache/uv"

uv run sam @args
