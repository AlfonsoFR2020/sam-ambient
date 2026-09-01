$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
$env:UV_CACHE_DIR = Join-Path $PSScriptRoot "../.cache/uv"

uv run ruff check .
uv run ruff format --check .
uv run pytest
