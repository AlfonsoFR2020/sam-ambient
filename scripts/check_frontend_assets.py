"""Read-only source/build integrity proof; no app, server, browser or audio launch."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

BUILD_INPUTS = (
    "build-provenance.mjs",
    "build-provenance.d.mts",
    "index.html",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.node.json",
    "vite.config.ts",
)
TEXT_INPUT = re.compile(r"\.(?:[cm]?tsx?|[cm]?js|css|json|html|ya?ml)$")


class Index(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.assets: list[str] = []
        self.source_id: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "script" and values.get("src"):
            self.assets.append(str(values["src"]))
        if tag == "link" and values.get("rel") == "stylesheet":
            self.assets.append(str(values.get("href", "")))
        if tag == "meta" and values.get("name") == "sam-ui-source":
            self.source_id = values.get("content")


def inspect_assets(root: Path) -> dict[str, object]:
    static = root / "src/sam_ambient/static"
    provenance = json.loads((static / "assets/sam-build.json").read_text(encoding="utf-8"))
    if provenance.get("schema") != 1:
        raise ValueError("Unsupported frontend provenance schema")
    files = provenance["sourceFiles"]
    expected = {f"ui/{name}" for name in BUILD_INPUTS}
    expected.update(
        path.relative_to(root).as_posix() for path in (root / "ui/src").rglob("*") if path.is_file()
    )
    if set(files) != expected:
        raise ValueError("Frontend source inventory changed; rebuild assets")
    for name, digest in files.items():
        path = root / name
        if (
            path.is_symlink()
            or path.is_junction()
            or not path.resolve().is_relative_to(root.resolve())
        ):
            raise ValueError("Frontend source must remain inside the checkout")
        content = path.read_bytes()
        if TEXT_INPUT.search(name):
            content = content.replace(b"\r\n", b"\n")
        if hashlib.sha256(content).hexdigest() != digest:
            raise ValueError(f"Frontend source differs from build: {name}")
    source_id = hashlib.sha256(
        json.dumps(files, ensure_ascii=False, separators=(",", ":")).encode()
    ).hexdigest()
    if provenance["sourceDigestSha256Lf"] != source_id:
        raise ValueError("Frontend source digest is inconsistent")
    index = Index()
    html = (static / "index.html").read_bytes()
    without_crlf = html.replace(b"\r\n", b"")
    if b"\r" in without_crlf or (b"\r\n" in html and b"\n" in without_crlf):
        raise ValueError("Generated HTML has mixed line endings; repair the build transform")
    index.feed(html.decode("utf-8"))
    if index.source_id != source_id:
        raise ValueError("HTML source identity differs from build")
    manifest = json.loads((static / ".vite/manifest.json").read_text(encoding="utf-8"))
    entry = manifest["index.html"]
    expected_assets = {"/" + entry["file"], *("/" + path for path in entry.get("css", []))}
    if not entry.get("isEntry") or set(index.assets) != expected_assets:
        raise ValueError("HTML/Vite entry assets differ")
    for asset in expected_assets:
        path = static / asset.removeprefix("/")
        if (
            not asset.startswith("/assets/")
            or not path.resolve().is_relative_to(static.resolve())
            or not path.is_file()
        ):
            raise ValueError("Invalid frontend asset path")
    script = (static / entry["file"]).read_text(encoding="utf-8")
    for marker in (
        source_id,
        provenance["visualIdentity"],
        "livingSkinPoint",
        "playbackGenerationId",
        "Shutdown requested",
    ):
        if marker not in script:
            raise ValueError(f"Expected integrated frontend marker missing: {marker}")
    return {
        "schema": 1,
        "sourceCommit": provenance["sourceCommit"],
        "sourceDirtyAtBuild": provenance["sourceDirty"],
        "sourceDigestSha256Lf": source_id,
        "sourceFileCount": len(files),
        "visualIdentity": provenance["visualIdentity"],
        "entryAssets": sorted(expected_assets),
        "artifactSha256": {
            path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(static.rglob("*"))
            if path.is_file()
        },
        "graphicalExecution": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Optional evidence JSON inside the checkout")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    result = inspect_assets(root)
    content = json.dumps(result, indent=2) + "\n"
    if args.output:
        target = args.output.resolve()
        if not target.is_relative_to(root) or target.is_symlink() or target.is_junction():
            raise ValueError("Evidence output must remain inside the checkout")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    print(content, end="")


if __name__ == "__main__":
    main()
