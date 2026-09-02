import asyncio
import os
import subprocess
from pathlib import Path

import pytest

from sam_ambient.core.tools.filesystem import (
    AuthorizedPaths,
    AuthorizedRoot,
    FilesListTool,
    FilesReadTool,
    FilesSearchTool,
    PathAuthorizationError,
)
from sam_ambient.core.turns import CancellationToken


def authorized_paths(root: Path) -> AuthorizedPaths:
    return AuthorizedPaths((AuthorizedRoot("workspace", root),))


def run_tool(tool, arguments: dict[str, object]):
    return asyncio.run(tool.execute(arguments, CancellationToken("file-tool-test")))


def test_authorized_listing_is_bounded_and_excludes_hidden_entries(tmp_path: Path) -> None:
    (tmp_path / "alpha.txt").write_text("alpha", encoding="utf-8")
    (tmp_path / "beta.txt").write_text("beta", encoding="utf-8")
    (tmp_path / ".private").write_text("secret", encoding="utf-8")
    nested = tmp_path / "nested"
    nested.mkdir()
    (nested / "child.txt").write_text("child", encoding="utf-8")

    result = run_tool(
        FilesListTool(authorized_paths(tmp_path)),
        {"root": "workspace", "depth": 1, "max_entries": 2},
    )

    assert result.truncated is True
    entries = result.data["entries"]
    assert len(entries) == 2
    assert all(not entry["name"].startswith(".") for entry in entries)
    assert all(set(entry) == {"name", "path", "kind", "size", "modified_ms"} for entry in entries)


def test_unknown_root_and_parent_traversal_are_rejected(tmp_path: Path) -> None:
    paths = authorized_paths(tmp_path)

    with pytest.raises(PathAuthorizationError, match="unauthorized"):
        paths.resolve("owner-home", ".")
    with pytest.raises(PathAuthorizationError, match="parent traversal"):
        paths.resolve("workspace", "nested/../../outside.txt", must_exist=False)


def test_absolute_path_is_rejected_before_filesystem_access(tmp_path: Path) -> None:
    paths = authorized_paths(tmp_path)
    outside = (tmp_path.parent / "outside.txt").resolve()

    with pytest.raises(PathAuthorizationError, match="absolute"):
        paths.resolve("workspace", str(outside), must_exist=False)


@pytest.mark.skipif(os.name != "nt", reason="Windows path namespaces are platform-specific")
@pytest.mark.parametrize(
    "unsafe_path",
    (
        r"C:\Windows\System32",
        r"C:Windows\System32",
        r"\Windows\System32",
        r"\\server\share\secret.txt",
        r"//server/share/secret.txt",
        r"\\?\C:\Windows\System32",
        r"\\?\UNC\server\share\secret.txt",
        r"\\.\pipe\sam",
        r"\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\secret.txt",
    ),
)
def test_windows_absolute_unc_and_device_namespace_paths_are_rejected(
    tmp_path: Path,
    unsafe_path: str,
) -> None:
    paths = authorized_paths(tmp_path)

    with pytest.raises(PathAuthorizationError, match=r"absolute|escapes"):
        paths.resolve("workspace", unsafe_path, must_exist=False)


@pytest.mark.skipif(os.name != "nt", reason="Windows filename rules are platform-specific")
@pytest.mark.parametrize(
    "unsafe_path",
    (
        "document.txt:private-stream",
        "NUL",
        "nul.txt",
        "CON",
        "PRN.log",
        "AUX",
        "COM1.txt",
        "LPT9",
        "file.txt.",
        "file.txt ",
        "folder.\\file.txt",
        "folder \\file.txt",
        "bad<name.txt",
        "bad|name.txt",
        "bad?name.txt",
        "bad*name.txt",
        "bad\nname.txt",
    ),
)
def test_windows_malformed_reserved_and_alternate_stream_paths_are_rejected(
    tmp_path: Path,
    unsafe_path: str,
) -> None:
    paths = authorized_paths(tmp_path)

    with pytest.raises(PathAuthorizationError):
        paths.resolve("workspace", unsafe_path, must_exist=False)


def test_symlink_sibling_prefix_escape_is_rejected_when_supported(tmp_path: Path) -> None:
    root = tmp_path / "root"
    outside = tmp_path / "root-secrets"
    root.mkdir()
    outside.mkdir()
    (outside / "secret.txt").write_text("outside", encoding="utf-8")
    link = root / "escape"
    try:
        link.symlink_to(outside, target_is_directory=True)
    except OSError as error:
        pytest.skip(f"symlink creation is unavailable on this platform: {error}")

    paths = authorized_paths(root)
    with pytest.raises(PathAuthorizationError, match="escapes"):
        paths.resolve("workspace", "escape/secret.txt")


@pytest.mark.skipif(os.name != "nt", reason="directory junctions are Windows-specific")
def test_windows_junction_escape_is_rejected_without_following_reparse_target(
    tmp_path: Path,
) -> None:
    root = tmp_path / "allowed"
    outside = tmp_path / "allowed-secrets"
    junction = root / "escape"
    root.mkdir()
    outside.mkdir()
    (outside / "secret.txt").write_text("outside", encoding="utf-8")

    completed = subprocess.run(
        ["cmd.exe", "/d", "/c", "mklink", "/J", str(junction), str(outside)],
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        pytest.skip(f"junction creation is unavailable: {completed.stderr.strip()}")

    try:
        paths = authorized_paths(root)
        with pytest.raises(PathAuthorizationError, match="escapes"):
            paths.resolve("workspace", "escape/secret.txt")
    finally:
        os.rmdir(junction)


def test_file_read_honors_line_and_byte_bounds(tmp_path: Path) -> None:
    target = tmp_path / "notes.txt"
    target.write_text("first line\nsecond line\nthird line\n", encoding="utf-8")
    tool = FilesReadTool(authorized_paths(tmp_path))

    line_bounded = run_tool(
        tool,
        {"root": "workspace", "path": "notes.txt", "max_bytes": 1_000, "max_lines": 2},
    )
    byte_bounded = run_tool(
        tool,
        {"root": "workspace", "path": "notes.txt", "max_bytes": 5, "max_lines": 20},
    )

    assert line_bounded.truncated is True
    assert line_bounded.data["content"].replace("\r\n", "\n") == "first line\nsecond line\n"
    assert line_bounded.data["lines_returned"] == 2
    assert byte_bounded.truncated is True
    assert byte_bounded.data["content"] == "first"
    assert byte_bounded.data["bytes_sampled"] == 5


def test_binary_file_is_identified_without_exposing_content(tmp_path: Path) -> None:
    (tmp_path / "image.bin").write_bytes(b"GIF89a\x00not-text\xff")

    result = run_tool(
        FilesReadTool(authorized_paths(tmp_path)),
        {"root": "workspace", "path": "image.bin"},
    )

    assert result.data["binary"] is True
    assert result.data["content"] is None
    assert result.data["bytes_sampled"] == len(b"GIF89a\x00not-text\xff")


def test_large_file_read_reports_explicit_truncation(tmp_path: Path) -> None:
    (tmp_path / "large.txt").write_text("x" * 10_000, encoding="utf-8")

    result = run_tool(
        FilesReadTool(authorized_paths(tmp_path)),
        {"root": "workspace", "path": "large.txt", "max_bytes": 128},
    )

    assert result.truncated is True
    assert len(result.data["content"]) == 128
    assert result.data["file_size"] == 10_000


def test_recursive_search_bounds_matches_excerpts_and_files(tmp_path: Path) -> None:
    for directory_name in ("a", "b"):
        directory = tmp_path / directory_name
        directory.mkdir()
        for index in range(3):
            (directory / f"{index}.txt").write_text(
                f"prefix {'z' * 100} needle suffix\nneedle again\n",
                encoding="utf-8",
            )

    result = run_tool(
        FilesSearchTool(authorized_paths(tmp_path), max_files=4),
        {
            "root": "workspace",
            "query": "needle",
            "max_matches": 3,
            "excerpt_chars": 30,
        },
    )

    assert result.truncated is True
    assert len(result.data["matches"]) == 3
    assert result.data["files_scanned"] <= 4
    assert all(len(match["excerpt"]) <= 32 for match in result.data["matches"])
    assert all(match["path"].endswith(".txt") for match in result.data["matches"])
