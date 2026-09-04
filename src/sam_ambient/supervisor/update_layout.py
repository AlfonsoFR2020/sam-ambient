"""Contained version staging and atomic cross-platform activation pointers."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
from dataclasses import dataclass
from pathlib import Path, PureWindowsPath
from uuid import uuid4

from sam_ambient.supervisor.update_models import UpdatableComponent, UpdateError

_MAX_ARTIFACT_FILES = 2_000
_MAX_ARTIFACT_BYTES = 128 * 1024 * 1024


@dataclass(frozen=True, slots=True)
class StagedArtifact:
    version: str
    path: Path
    artifact_hash: str
    file_count: int
    byte_count: int


class VersionLayout:
    def __init__(self, component: UpdatableComponent) -> None:
        self.component = component
        self.versions = component.component_root / "versions"
        self.active_pointer = component.component_root / "active.json"
        self.versions.mkdir(parents=True, exist_ok=True)

    def source(self, relative: str) -> Path:
        source = _contained(self.component.incoming_root, relative, strict=True)
        if not source.is_dir():
            raise UpdateError("candidate source must be a directory")
        return source

    def verify_source(
        self,
        relative: str,
        *,
        version: str,
        expected_hash: str | None,
    ) -> StagedArtifact:
        source = self.source(relative)
        self._verify_identity(source, version)
        artifact_hash, files, size = _tree_hash(source)
        if expected_hash is not None and artifact_hash != expected_hash:
            raise UpdateError("candidate artifact hash does not match expected hash")
        return StagedArtifact(version, source, artifact_hash, files, size)

    def stage(self, verified: StagedArtifact, update_tx_id: str) -> StagedArtifact:
        target = self.versions / verified.version
        if target.exists():
            raise UpdateError("candidate version is already staged")
        temporary = self.versions / f".{verified.version}.{update_tx_id}.staging"
        if temporary.exists():
            shutil.rmtree(temporary)
        try:
            shutil.copytree(verified.path, temporary, symlinks=False)
            copied_hash, files, size = _tree_hash(temporary)
            if copied_hash != verified.artifact_hash:
                raise UpdateError("candidate changed while it was being staged")
            os.replace(temporary, target)
        except Exception:
            if temporary.exists():
                shutil.rmtree(temporary)
            raise
        return StagedArtifact(verified.version, target, copied_hash, files, size)

    def activate(self, artifact: StagedArtifact) -> None:
        candidate = artifact.path.resolve(strict=True)
        if not candidate.is_relative_to(self.versions.resolve(strict=True)):
            raise UpdateError("activation target escapes the component versions root")
        pointer = {
            "component_id": self.component.component_id,
            "version": artifact.version,
            "path": str(candidate),
            "artifact_hash": artifact.artifact_hash,
        }
        temporary = self.component.component_root / f".active.{uuid4()}.tmp"
        try:
            temporary.write_text(
                json.dumps(pointer, separators=(",", ":"), sort_keys=True),
                encoding="utf-8",
            )
            os.replace(temporary, self.active_pointer)
        finally:
            temporary.unlink(missing_ok=True)

    def artifact(self, version: str) -> StagedArtifact:
        path = _contained(self.versions, version, strict=True)
        self._verify_identity(path, version)
        artifact_hash, files, size = _tree_hash(path)
        return StagedArtifact(version, path, artifact_hash, files, size)

    def active(self) -> dict[str, object]:
        try:
            payload = json.loads(self.active_pointer.read_text(encoding="utf-8"))
            if payload.get("component_id") != self.component.component_id:
                raise UpdateError("active component pointer has the wrong identity")
            version = payload["version"]
            artifact_hash = payload["artifact_hash"]
            if not isinstance(version, str) or not isinstance(artifact_hash, str):
                raise UpdateError("active component pointer metadata is invalid")
            path = Path(str(payload["path"])).resolve(strict=True)
            if not path.is_relative_to(self.versions.resolve(strict=True)):
                raise UpdateError("active component pointer escapes versions root")
            artifact = self.artifact(version)
            if path != artifact.path or artifact_hash != artifact.artifact_hash:
                raise UpdateError("active component pointer does not match its artifact")
            return payload
        except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
            raise UpdateError("active component pointer is invalid") from error

    def cleanup_failed(self, *, keep_versions: set[str], maximum_failed: int = 2) -> None:
        if maximum_failed < 0:
            raise ValueError("maximum_failed must be non-negative")
        candidates = sorted(
            (
                path
                for path in self.versions.iterdir()
                if path.is_dir() and path.name not in keep_versions and not path.is_symlink()
            ),
            key=lambda path: path.stat().st_mtime_ns,
            reverse=True,
        )
        for abandoned in candidates[maximum_failed:]:
            resolved = abandoned.resolve(strict=True)
            if not resolved.is_relative_to(self.versions.resolve(strict=True)):
                raise UpdateError("refusing to clean a path outside versions root")
            shutil.rmtree(resolved)

    def _verify_identity(self, path: Path, version: str) -> None:
        try:
            manifest = json.loads((path / "component.json").read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise UpdateError("candidate has no valid component.json identity") from error
        if manifest != {"component_id": self.component.component_id, "version": version}:
            raise UpdateError("candidate component identity/version does not match request")


def _contained(root: Path, raw: str, *, strict: bool) -> Path:
    if not raw or "\x00" in raw:
        raise UpdateError("candidate path must be non-blank")
    windows = PureWindowsPath(raw)
    candidate = Path(raw)
    if (
        candidate.is_absolute()
        or windows.is_absolute()
        or windows.drive
        or ".." in candidate.parts
        or ".." in windows.parts
    ):
        raise UpdateError("candidate path must be relative and cannot traverse parents")
    try:
        resolved_root = root.resolve(strict=True)
        resolved = (resolved_root / candidate).resolve(strict=strict)
    except OSError as error:
        raise UpdateError("candidate path is unavailable") from error
    if not resolved.is_relative_to(resolved_root):
        raise UpdateError("candidate path escapes its trusted root")
    return resolved


def _tree_hash(root: Path) -> tuple[str, int, int]:
    digest = hashlib.sha256()
    file_count = 0
    byte_count = 0
    resolved_root = root.resolve(strict=True)
    for path in sorted(resolved_root.rglob("*"), key=lambda item: item.as_posix()):
        if path.is_symlink():
            raise UpdateError("candidate artifacts cannot contain symbolic links")
        resolved = path.resolve(strict=True)
        if not resolved.is_relative_to(resolved_root):
            raise UpdateError("candidate artifact escapes through a filesystem link")
        relative = resolved.relative_to(resolved_root).as_posix().encode()
        digest.update(b"D\0" if path.is_dir() else b"F\0")
        digest.update(relative)
        digest.update(b"\0")
        if path.is_dir():
            continue
        if not path.is_file():
            raise UpdateError("candidate contains an unsupported filesystem entry")
        file_count += 1
        if file_count > _MAX_ARTIFACT_FILES:
            raise UpdateError("candidate contains too many files")
        with path.open("rb") as stream:
            while chunk := stream.read(64 * 1024):
                byte_count += len(chunk)
                if byte_count > _MAX_ARTIFACT_BYTES:
                    raise UpdateError("candidate exceeds the artifact byte limit")
                digest.update(chunk)
    return digest.hexdigest(), file_count, byte_count
