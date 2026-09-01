"""Ollama service adapter."""

from sam_ambient.adapters.ollama.provider import (
    DEFAULT_OLLAMA_BASE_URL,
    OllamaProvider,
    find_ollama_executable,
    normalize_ollama_base_url,
)

__all__ = [
    "DEFAULT_OLLAMA_BASE_URL",
    "OllamaProvider",
    "find_ollama_executable",
    "normalize_ollama_base_url",
]
