"""Small file-only production-asset contract; no browser, app or build invocation."""

import hashlib
import json

import pytest

from scripts.check_frontend_assets import BUILD_INPUTS, inspect_assets


@pytest.fixture
def frontend(tmp_path):
    source = tmp_path / "ui/src"
    source.mkdir(parents=True)
    (source / "App.tsx").write_text("synthetic source\n", encoding="utf-8")
    for name in BUILD_INPUTS:
        (tmp_path / "ui" / name).write_text("synthetic config\n", encoding="utf-8")
    paths = [f"ui/{name}" for name in BUILD_INPUTS] + ["ui/src/App.tsx"]
    files = {
        name: hashlib.sha256((tmp_path / name).read_bytes().replace(b"\r\n", b"\n")).hexdigest()
        for name in sorted(paths)
    }
    digest = hashlib.sha256(json.dumps(files, separators=(",", ":")).encode()).hexdigest()
    static = tmp_path / "src/sam_ambient/static"
    (static / "assets").mkdir(parents=True)
    (static / ".vite").mkdir()
    provenance = {
        "schema": 1,
        "sourceFiles": files,
        "sourceDigestSha256Lf": digest,
        "sourceCommit": "a" * 40,
        "sourceDirty": False,
        "visualIdentity": "connected-skin-ivd-experimental",
    }
    (static / "assets/sam-build.json").write_text(json.dumps(provenance), encoding="utf-8")
    (static / ".vite/manifest.json").write_text(
        json.dumps(
            {
                "index.html": {"file": "assets/app.js", "css": ["assets/app.css"], "isEntry": True},
            }
        ),
        encoding="utf-8",
    )
    (static / "index.html").write_text(
        f'<meta name="sam-ui-source" content="{digest}">'
        '<script src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css">',
        encoding="utf-8",
    )
    (static / "assets/app.js").write_text(
        f"{digest} connected-skin-ivd-experimental livingSkinPoint "
        "playbackGenerationId Shutdown requested",
        encoding="utf-8",
    )
    (static / "assets/app.css").write_text("/* synthetic stylesheet */", encoding="utf-8")
    return tmp_path, static


def test_asset_integrity_matches_source_html_manifest_and_content(frontend):
    root, _static = frontend
    proof = inspect_assets(root)
    assert proof["sourceDirtyAtBuild"] is False
    assert proof["entryAssets"] == ["/assets/app.css", "/assets/app.js"]
    assert len(proof["artifactSha256"]) == 5
    assert proof["graphicalExecution"] is False
    (root / "ui/src/App.tsx").write_bytes(b"synthetic source\r\n")
    assert inspect_assets(root)["sourceDigestSha256Lf"] == proof["sourceDigestSha256Lf"]


@pytest.mark.parametrize("fault", ["changed-source", "new-source", "html-entry", "missing-feature"])
def test_asset_integrity_rejects_stale_or_mixed_artifacts(frontend, fault):
    root, static = frontend
    if fault == "changed-source":
        (root / "ui/src/App.tsx").write_text("changed source", encoding="utf-8")
    elif fault == "new-source":
        (root / "ui/src/new.ts").write_text("new source", encoding="utf-8")
    elif fault == "html-entry":
        index = static / "index.html"
        index.write_text(index.read_text().replace("assets/app.js", "assets/old.js"))
    else:
        script = static / "assets/app.js"
        script.write_text(script.read_text().replace("livingSkinPoint", "old independent sheets"))
    with pytest.raises(ValueError):
        inspect_assets(root)
