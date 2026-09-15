"""Fail fast when source, frontend, or built distribution versions diverge."""

from __future__ import annotations

import argparse
import json
import tarfile
import tomllib
import zipfile
from pathlib import Path

from sam_ambient import __version__


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dist", action="store_true", help="Also inspect built distributions")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    with (root / "pyproject.toml").open("rb") as stream:
        project_version = tomllib.load(stream)["project"]["version"]
    ui_version = json.loads((root / "ui/package.json").read_text(encoding="utf-8"))["version"]
    tauri_version = json.loads((root / "ui/src-tauri/tauri.conf.json").read_text(encoding="utf-8"))[
        "version"
    ]
    with (root / "ui/src-tauri/Cargo.toml").open("rb") as stream:
        cargo_version = tomllib.load(stream)["package"]["version"]
    with (root / "ui/src-tauri/Cargo.lock").open("rb") as stream:
        cargo_lock = tomllib.load(stream)
    cargo_lock_version = next(
        package["version"]
        for package in cargo_lock["package"]
        if package["name"] == "sam-native-shell"
    )
    with (root / "uv.lock").open("rb") as stream:
        uv_lock = tomllib.load(stream)
    uv_lock_version = next(
        package["version"] for package in uv_lock["package"] if package["name"] == "sam-ambient"
    )
    versions = {
        "package": __version__,
        "pyproject": project_version,
        "uv-lock": uv_lock_version,
        "frontend": ui_version,
        "tauri": tauri_version,
        "cargo": cargo_version,
        "cargo-lock": cargo_lock_version,
    }
    if len(set(versions.values())) != 1:
        raise SystemExit(f"version mismatch: {versions}")
    if args.dist:
        wheel = root / "dist" / f"sam_ambient-{project_version}-py3-none-any.whl"
        source = root / "dist" / f"sam_ambient-{project_version}.tar.gz"
        if not wheel.is_file() or not source.is_file():
            raise SystemExit(f"missing distributions for {project_version}")
        with zipfile.ZipFile(wheel) as archive:
            metadata = next(
                name for name in archive.namelist() if name.endswith(".dist-info/METADATA")
            )
            if f"Version: {project_version}" not in archive.read(metadata).decode():
                raise SystemExit("wheel metadata version mismatch")
        with tarfile.open(source, "r:gz") as archive:
            if not any(
                name.endswith(f"sam_ambient-{project_version}/PKG-INFO")
                for name in archive.getnames()
            ):
                raise SystemExit("source distribution metadata missing")
    print(f"Sam release metadata: {project_version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
