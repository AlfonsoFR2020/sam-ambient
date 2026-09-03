"""Authorized-root, bounded filesystem capabilities."""

from __future__ import annotations

import asyncio
import fnmatch
import os
import re
import tempfile
from collections import deque
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path, PurePath
from typing import Any

from sam_ambient.core.tools.models import (
    RiskClass,
    SideEffect,
    ToolDescriptor,
    ToolError,
    ToolResult,
)
from sam_ambient.core.turns import CancellationToken

_PLATFORMS = ("linux", "windows", "darwin")
_OBJECT_RESULT = {"type": "object"}
_WINDOWS_DEVICE_NAMES = frozenset(
    {"CON", "PRN", "AUX", "NUL"}
    | {f"COM{index}" for index in range(1, 10)}
    | {f"LPT{index}" for index in range(1, 10)}
)


class PathAuthorizationError(ToolError):
    pass


@dataclass(frozen=True, slots=True)
class AuthorizedRoot:
    id: str
    path: Path
    readable: bool = True
    writable: bool = False


class AuthorizedPaths:
    def __init__(self, roots: tuple[AuthorizedRoot, ...]) -> None:
        if not roots:
            raise ValueError("at least one filesystem root must be configured")
        self._roots: dict[str, AuthorizedRoot] = {}
        for root in roots:
            if not root.id.strip() or root.id in self._roots:
                raise ValueError("filesystem root ids must be unique and non-blank")
            canonical = root.path.resolve(strict=True)
            if not canonical.is_dir():
                raise ValueError(f"filesystem root is not a directory: {canonical}")
            self._roots[root.id] = AuthorizedRoot(
                root.id,
                canonical,
                readable=root.readable,
                writable=root.writable,
            )

    def root(self, root_id: str, *, write: bool = False) -> AuthorizedRoot:
        try:
            root = self._roots[root_id]
        except KeyError as error:
            raise PathAuthorizationError(f"unauthorized filesystem root: {root_id}") from error
        if write and not root.writable:
            raise PathAuthorizationError(f"filesystem root is not writable: {root_id}")
        if not write and not root.readable:
            raise PathAuthorizationError(f"filesystem root is not readable: {root_id}")
        return root

    def resolve(
        self,
        root_id: str,
        relative_path: str,
        *,
        write: bool = False,
        must_exist: bool = True,
    ) -> Path:
        root = self.root(root_id, write=write)
        raw = relative_path or "."
        if "\x00" in raw:
            raise PathAuthorizationError("NUL bytes are not accepted in filesystem paths")
        candidate_path = Path(raw)
        if candidate_path.is_absolute() or candidate_path.drive:
            raise PathAuthorizationError("absolute filesystem paths are not accepted")
        if os.name == "nt":
            _validate_windows_relative_path(raw)
        if ".." in PurePath(raw).parts:
            raise PathAuthorizationError("parent traversal is not accepted")
        try:
            candidate = (root.path / candidate_path).resolve(strict=must_exist)
        except (FileNotFoundError, OSError) as error:
            raise ToolError(f"filesystem path is unavailable: {relative_path}") from error
        if not candidate.is_relative_to(root.path):
            raise PathAuthorizationError("filesystem path escapes its authorized root")
        return candidate

    def relative(self, root_id: str, path: Path) -> str:
        root = self.root(root_id)
        return path.relative_to(root.path).as_posix() or "."


def _base_schema(extra: dict[str, Any], *, required: tuple[str, ...] = ()) -> dict[str, Any]:
    properties = {
        "root": {"type": "string", "minLength": 1, "maxLength": 64},
        "path": {"type": "string", "maxLength": 4096},
        **extra,
    }
    return {
        "type": "object",
        "properties": properties,
        "required": ["root", *required],
        "additionalProperties": False,
    }


class FilesListTool:
    descriptor = ToolDescriptor(
        id="files.list",
        description="List bounded metadata below an explicitly authorized local root.",
        input_schema=_base_schema(
            {
                "depth": {"type": "integer", "minimum": 0, "maximum": 3},
                "max_entries": {"type": "integer", "minimum": 1, "maximum": 200},
                "include_hidden": {"type": "boolean"},
            }
        ),
        result_schema=_OBJECT_RESULT,
        risk=RiskClass.READ_ONLY,
        platforms=_PLATFORMS,
        requires_confirmation=False,
        supports_cancellation=True,
        timeout_s=3.0,
        side_effect=SideEffect.NONE,
    )

    def __init__(self, paths: AuthorizedPaths, *, per_directory_scan_limit: int = 1_000) -> None:
        if per_directory_scan_limit < 1:
            raise ValueError("directory scan limit must be positive")
        self.paths = paths
        self.per_directory_scan_limit = per_directory_scan_limit

    async def execute(
        self,
        arguments: Mapping[str, Any],
        cancellation: CancellationToken,
    ) -> ToolResult:
        root_id = str(arguments["root"])
        target = self.paths.resolve(root_id, str(arguments.get("path", ".")))
        if not target.is_dir():
            raise ToolError("files.list path must be a directory")
        depth = int(arguments.get("depth", 0))
        maximum = int(arguments.get("max_entries", 100))
        include_hidden = bool(arguments.get("include_hidden", False))
        entries: list[dict[str, Any]] = []
        queue: deque[tuple[Path, int]] = deque(((target, 0),))
        truncated = False
        while queue and len(entries) < maximum:
            cancellation.raise_if_cancelled()
            directory, level = queue.popleft()
            scanned, scan_truncated = await asyncio.to_thread(
                _bounded_scandir,
                directory,
                self.per_directory_scan_limit,
                include_hidden,
            )
            truncated = truncated or scan_truncated
            for entry in scanned:
                cancellation.raise_if_cancelled()
                path = Path(entry.path)
                is_link = entry.is_symlink()
                is_directory = entry.is_dir(follow_symlinks=False)
                try:
                    stat = entry.stat(follow_symlinks=False)
                except OSError:
                    continue
                entries.append(
                    {
                        "name": entry.name,
                        "path": self.paths.relative(root_id, path),
                        "kind": "symlink" if is_link else "directory" if is_directory else "file",
                        "size": stat.st_size if not is_directory else None,
                        "modified_ms": int(stat.st_mtime * 1_000),
                    }
                )
                if len(entries) >= maximum:
                    truncated = True
                    break
                if is_directory and not is_link and level < depth:
                    resolved = await asyncio.to_thread(path.resolve, strict=True)
                    root = self.paths.root(root_id)
                    if resolved.is_relative_to(root.path):
                        queue.append((resolved, level + 1))
        if queue:
            truncated = True
        return ToolResult(
            {
                "root": root_id,
                "path": self.paths.relative(root_id, target),
                "entries": entries,
                "hidden_policy": "dot-prefixed names excluded unless include_hidden=true",
            },
            truncated=truncated,
        )


class FilesReadTool:
    descriptor = ToolDescriptor(
        id="files.read",
        description="Read bounded text from a file inside an explicitly authorized local root.",
        input_schema=_base_schema(
            {
                "max_bytes": {"type": "integer", "minimum": 1, "maximum": 262_144},
                "max_lines": {"type": "integer", "minimum": 1, "maximum": 2_000},
            }
        ),
        result_schema=_OBJECT_RESULT,
        risk=RiskClass.READ_ONLY,
        platforms=_PLATFORMS,
        requires_confirmation=False,
        supports_cancellation=True,
        timeout_s=3.0,
        side_effect=SideEffect.NONE,
    )

    def __init__(self, paths: AuthorizedPaths) -> None:
        self.paths = paths

    async def execute(
        self,
        arguments: Mapping[str, Any],
        cancellation: CancellationToken,
    ) -> ToolResult:
        root_id = str(arguments["root"])
        target = self.paths.resolve(root_id, str(arguments.get("path", ".")))
        if not target.is_file():
            raise ToolError("files.read path must be a file")
        maximum_bytes = int(arguments.get("max_bytes", 64 * 1024))
        maximum_lines = int(arguments.get("max_lines", 500))
        cancellation.raise_if_cancelled()
        size, raw = await asyncio.to_thread(_read_bounded_file, target, maximum_bytes)
        cancellation.raise_if_cancelled()
        byte_truncated = len(raw) > maximum_bytes
        raw = raw[:maximum_bytes]
        decoded = _decode_text(raw)
        if decoded is None:
            return ToolResult(
                {
                    "root": root_id,
                    "path": self.paths.relative(root_id, target),
                    "binary": True,
                    "content": None,
                    "file_size": size,
                    "bytes_sampled": len(raw),
                },
                truncated=byte_truncated,
            )
        content, encoding = decoded
        lines = content.splitlines(keepends=True)
        line_truncated = len(lines) > maximum_lines
        if line_truncated:
            content = "".join(lines[:maximum_lines])
        return ToolResult(
            {
                "root": root_id,
                "path": self.paths.relative(root_id, target),
                "binary": False,
                "encoding": encoding,
                "content": content,
                "file_size": size,
                "bytes_sampled": len(raw),
                "lines_returned": min(len(lines), maximum_lines),
            },
            truncated=byte_truncated or line_truncated,
        )


class FilesWriteTool:
    """Create or atomically replace bounded UTF-8 text inside a writable root."""

    descriptor = ToolDescriptor(
        id="files.write",
        description=(
            "Create or atomically replace one bounded UTF-8 text file inside an explicitly "
            "writable root after owner approval."
        ),
        input_schema=_base_schema(
            {
                "content": {"type": "string", "maxLength": 60_000},
                "overwrite": {"type": "boolean"},
            },
            required=("path", "content"),
        ),
        result_schema=_OBJECT_RESULT,
        risk=RiskClass.REVERSIBLE_WRITE,
        platforms=_PLATFORMS,
        requires_confirmation=True,
        supports_cancellation=False,
        timeout_s=5.0,
        side_effect=SideEffect.LOCAL_STATE,
    )

    def __init__(self, paths: AuthorizedPaths) -> None:
        self.paths = paths

    async def execute(
        self,
        arguments: Mapping[str, Any],
        cancellation: CancellationToken,
    ) -> ToolResult:
        root_id = str(arguments["root"])
        target = self.paths.resolve(
            root_id,
            str(arguments["path"]),
            write=True,
            must_exist=False,
        )
        if not target.parent.is_dir():
            raise ToolError("files.write parent directory does not exist")
        if target.exists() and not target.is_file():
            raise ToolError("files.write target must be a regular file")
        content = str(arguments["content"])
        encoded = content.encode("utf-8")
        if len(encoded) > 64 * 1024:
            raise ToolError("files.write UTF-8 content exceeds 64 KiB")
        cancellation.raise_if_cancelled()
        try:
            created = await asyncio.to_thread(
                _atomic_write_utf8,
                target,
                encoded,
                bool(arguments.get("overwrite", False)),
            )
        except FileExistsError as error:
            raise ToolError("files.write target already exists; set overwrite=true") from error
        except OSError as error:
            raise ToolError("files.write atomic replacement failed") from error
        cancellation.raise_if_cancelled()
        return ToolResult(
            {
                "root": root_id,
                "path": self.paths.relative(root_id, target),
                "bytes_written": len(encoded),
                "created": created,
                "overwritten": not created,
                "encoding": "utf-8",
                "atomic_replace": True,
            }
        )


class FilesSearchTool:
    descriptor = ToolDescriptor(
        id="files.search",
        description="Search bounded text excerpts below an explicitly authorized local root.",
        input_schema=_base_schema(
            {
                "query": {"type": "string", "minLength": 1, "maxLength": 256},
                "glob": {"type": "string", "minLength": 1, "maxLength": 256},
                "case_sensitive": {"type": "boolean"},
                "max_matches": {"type": "integer", "minimum": 1, "maximum": 100},
                "excerpt_chars": {"type": "integer", "minimum": 20, "maximum": 300},
            },
            required=("query",),
        ),
        result_schema=_OBJECT_RESULT,
        risk=RiskClass.READ_ONLY,
        platforms=_PLATFORMS,
        requires_confirmation=False,
        supports_cancellation=True,
        timeout_s=5.0,
        side_effect=SideEffect.NONE,
    )

    def __init__(
        self,
        paths: AuthorizedPaths,
        *,
        max_files: int = 2_000,
        max_file_bytes: int = 1_048_576,
        max_directories: int = 1_000,
        per_directory_scan_limit: int = 1_000,
    ) -> None:
        if min(max_files, max_file_bytes, max_directories, per_directory_scan_limit) < 1:
            raise ValueError("filesystem search bounds must be positive")
        self.paths = paths
        self.max_files = max_files
        self.max_file_bytes = max_file_bytes
        self.max_directories = max_directories
        self.per_directory_scan_limit = per_directory_scan_limit

    async def execute(
        self,
        arguments: Mapping[str, Any],
        cancellation: CancellationToken,
    ) -> ToolResult:
        root_id = str(arguments["root"])
        target = self.paths.resolve(root_id, str(arguments.get("path", ".")))
        if not target.is_dir():
            raise ToolError("files.search path must be a directory")
        query = str(arguments["query"])
        pattern = str(arguments.get("glob", "*"))
        case_sensitive = bool(arguments.get("case_sensitive", False))
        maximum = int(arguments.get("max_matches", 50))
        excerpt_chars = int(arguments.get("excerpt_chars", 160))
        needle = query if case_sensitive else query.casefold()
        matches: list[dict[str, Any]] = []
        files_scanned = 0
        skipped_binary = 0
        skipped_large = 0
        truncated = False
        root = self.paths.root(root_id)
        queue: deque[Path] = deque((target,))
        directories_scanned = 0
        while queue:
            cancellation.raise_if_cancelled()
            directory = queue.popleft()
            directories_scanned += 1
            entries, scan_truncated = await asyncio.to_thread(
                _bounded_scandir,
                directory,
                self.per_directory_scan_limit,
                False,
            )
            truncated = truncated or scan_truncated
            for entry in entries:
                cancellation.raise_if_cancelled()
                path = Path(entry.path)
                if entry.is_symlink():
                    continue
                if entry.is_dir(follow_symlinks=False):
                    if directories_scanned + len(queue) >= self.max_directories:
                        truncated = True
                        continue
                    try:
                        resolved = await asyncio.to_thread(path.resolve, strict=True)
                    except OSError:
                        continue
                    if resolved.is_relative_to(root.path):
                        queue.append(resolved)
                    continue
                if not entry.is_file(follow_symlinks=False) or not fnmatch.fnmatch(
                    entry.name, pattern
                ):
                    continue
                files_scanned += 1
                if files_scanned > self.max_files:
                    truncated = True
                    break
                try:
                    resolved = await asyncio.to_thread(path.resolve, strict=True)
                    if not resolved.is_relative_to(root.path):
                        continue
                    raw = await asyncio.to_thread(
                        _read_file_with_limit, resolved, self.max_file_bytes
                    )
                    if raw is None:
                        skipped_large += 1
                        continue
                except OSError:
                    continue
                decoded = _decode_text(raw)
                if decoded is None:
                    skipped_binary += 1
                    continue
                text, _encoding = decoded
                for line_number, line in enumerate(text.splitlines(), start=1):
                    haystack = line if case_sensitive else line.casefold()
                    column = haystack.find(needle)
                    if column < 0:
                        continue
                    matches.append(
                        {
                            "path": self.paths.relative(root_id, resolved),
                            "line": line_number,
                            "column": column + 1,
                            "excerpt": _excerpt(line, column, len(query), excerpt_chars),
                        }
                    )
                    if len(matches) >= maximum:
                        truncated = True
                        break
                if len(matches) >= maximum:
                    break
            if files_scanned > self.max_files or len(matches) >= maximum:
                break
        return ToolResult(
            {
                "root": root_id,
                "path": self.paths.relative(root_id, target),
                "query": query,
                "matches": matches,
                "files_scanned": min(files_scanned, self.max_files),
                "directories_scanned": directories_scanned,
                "skipped_binary": skipped_binary,
                "skipped_large": skipped_large,
            },
            truncated=truncated,
        )


def _bounded_scandir(
    directory: Path,
    limit: int,
    include_hidden: bool,
) -> tuple[list[os.DirEntry[str]], bool]:
    entries: list[os.DirEntry[str]] = []
    truncated = False
    with os.scandir(directory) as iterator:
        for entry in iterator:
            if not include_hidden and entry.name.startswith("."):
                continue
            if len(entries) >= limit:
                truncated = True
                break
            entries.append(entry)
    entries.sort(key=lambda item: (item.name.casefold(), item.name))
    return entries, truncated


def _read_bounded_file(path: Path, maximum_bytes: int) -> tuple[int, bytes]:
    size = path.stat().st_size
    with path.open("rb") as handle:
        return size, handle.read(maximum_bytes + 1)


def _read_file_with_limit(path: Path, maximum_bytes: int) -> bytes | None:
    if path.stat().st_size > maximum_bytes:
        return None
    with path.open("rb") as handle:
        raw = handle.read(maximum_bytes + 1)
    return None if len(raw) > maximum_bytes else raw


def _atomic_write_utf8(target: Path, content: bytes, overwrite: bool) -> bool:
    existed = target.exists()
    if existed and not overwrite:
        raise FileExistsError(target)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=".sam-write-",
        suffix=".tmp",
        dir=target.parent,
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        if overwrite:
            os.replace(temporary, target)
        else:
            os.link(temporary, target)
            temporary.unlink()
        return not existed
    finally:
        temporary.unlink(missing_ok=True)


def _validate_windows_relative_path(raw: str) -> None:
    if any(ord(character) < 32 for character in raw):
        raise PathAuthorizationError("control characters are not accepted in Windows paths")
    if any(character in '<>:"|?*' for character in raw):
        raise PathAuthorizationError("reserved characters are not accepted in Windows paths")
    for component in re.split(r"[\\/]", raw):
        if component in {"", ".", ".."}:
            continue
        if component.endswith((".", " ")):
            raise PathAuthorizationError("Windows path components cannot end in dot or space")
        device_name = component.split(".", 1)[0].upper()
        if device_name in _WINDOWS_DEVICE_NAMES:
            raise PathAuthorizationError("reserved Windows device paths are not accepted")


def _decode_text(raw: bytes) -> tuple[str, str] | None:
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        try:
            return raw.decode("utf-16"), "utf-16"
        except UnicodeDecodeError:
            return None
    if b"\x00" in raw:
        return None
    try:
        if raw.startswith(b"\xef\xbb\xbf"):
            return raw.decode("utf-8-sig"), "utf-8-sig"
        return raw.decode("utf-8"), "utf-8"
    except UnicodeDecodeError:
        return None


def _excerpt(line: str, column: int, query_length: int, maximum: int) -> str:
    if len(line) <= maximum:
        return line
    context = max(0, (maximum - query_length) // 2)
    start = max(0, column - context)
    end = min(len(line), start + maximum)
    start = max(0, end - maximum)
    return f"{'…' if start else ''}{line[start:end]}{'…' if end < len(line) else ''}"
