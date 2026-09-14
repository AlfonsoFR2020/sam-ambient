"""Build Sam's directory-based, self-contained native Python companion."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import sys
from pathlib import Path

_RUNTIME_DISTRIBUTIONS = (
    "anyio",
    "certifi",
    "cffi",
    "h11",
    "httpcore",
    "httpx",
    "idna",
    "langdetect",
    "pycparser",
    "sounddevice",
    "webrtcvad-wheels",
    "websockets",
)


def repository_root() -> Path:
    return Path(__file__).resolve().parents[1]


def included_resources(root: Path) -> list[tuple[str, str]]:
    package = root / "src" / "sam_ambient"
    resources = [
        (str(package / "static"), "lib/sam_ambient/static"),
        (
            str(package / "adapters" / "tts" / "windows_system_speech.ps1"),
            "lib/sam_ambient/adapters/tts/windows_system_speech.ps1",
        ),
        (str(root / "config" / "sam.example.toml"), "lib/sam_ambient/sam.example.toml"),
        (str(root / "THIRD_PARTY.md"), "lib/sam_ambient/THIRD_PARTY.md"),
        (str(root / "LICENSE"), "LICENSE-SAM.txt"),
        (str(root / "NOTICE"), "NOTICE-SAM.txt"),
        (str(root / "packaging" / "licenses" / "PORTAUDIO.txt"), "licenses/PortAudio.txt"),
    ]
    python_license = Path(sys.base_prefix) / "LICENSE.txt"
    if not python_license.is_file():
        raise RuntimeError(f"Python runtime license is missing: {python_license}")
    resources.append((str(python_license), "licenses/Python.txt"))
    for name in _RUNTIME_DISTRIBUTIONS:
        distribution = importlib.metadata.distribution(name)
        license_files = [
            item
            for item in distribution.files or ()
            if item.name.lower() in {"license", "license.md", "license.txt", "notice"}
        ]
        if not license_files:
            raise RuntimeError(f"runtime dependency has no distributable license file: {name}")
        for index, item in enumerate(license_files, start=1):
            source = Path(distribution.locate_file(item))
            suffix = source.suffix or ".txt"
            resources.append((str(source), f"licenses/{name}-{index}{suffix}"))
    return resources


def remove_unlicensed_optional_audio_binaries(directory: Path) -> None:
    """Exclude inactive ASIO wheel variants governed by a separate SDK license."""

    for path in directory.rglob("*-asio.dll"):
        path.unlink()


def _digest_tree(directory: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(item for item in directory.rglob("*") if item.is_file()):
        relative = path.relative_to(directory).as_posix().encode()
        digest.update(len(relative).to_bytes(4, "big"))
        digest.update(relative)
        with path.open("rb") as stream:
            while chunk := stream.read(1024 * 1024):
                digest.update(chunk)
    return digest.hexdigest()


def write_manifest(directory: Path, version: str) -> Path:
    files = sorted(
        path.relative_to(directory).as_posix() for path in directory.rglob("*") if path.is_file()
    )
    manifest = {
        "component": "sam-native-companion",
        "format": 1,
        "packager": "cx_Freeze directory build",
        "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "version": version,
        "files": files,
        "content_sha256": _digest_tree(directory),
    }
    target = directory / "companion-manifest.json"
    target.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    output = args.output.resolve(strict=False)
    if output.exists():
        raise SystemExit(f"refusing to replace existing companion output: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    egg_base = output.parent / "egg-info"
    egg_base.mkdir(parents=True, exist_ok=True)

    root = repository_root()
    sys.path.insert(0, str(root / "src"))
    from cx_Freeze import Executable, setup

    from sam_ambient import __version__

    scripts = root / "scripts"
    setup(
        name="sam-native-companion",
        version=__version__,
        description="Self-contained Python supervisor and runtime for Sam",
        options={
            "egg_info": {"egg_base": str(egg_base)},
            "build_exe": {
                "build_exe": str(output),
                "packages": ["sam_ambient"],
                "excludes": ["_pytest", "cx_Freeze", "idlelib", "pytest", "setuptools", "unittest"],
                "include_files": included_resources(root),
                "include_msvcr": True,
                "silent_level": 1,
            },
        },
        executables=[
            Executable(scripts / "native_companion_supervisor.py", target_name="sam-supervisor"),
            Executable(scripts / "native_companion_core.py", target_name="sam-core"),
            Executable(scripts / "native_companion_ui.py", target_name="sam-ui"),
        ],
        script_args=["build_exe"],
    )
    remove_unlicensed_optional_audio_binaries(output)
    write_manifest(output, __version__)
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
