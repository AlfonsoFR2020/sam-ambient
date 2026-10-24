"""Bounded, file-only public-doc/link/vector audit; never render or access the network.

Run from a checkout: python -m scripts.check_public_docs --profile development
For the isolated release-docs branch also pass --release-base RELEASE_COMMIT.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import subprocess
import xml.etree.ElementTree as ET
from itertools import combinations, pairwise
from pathlib import Path
from urllib.parse import unquote, urlsplit

from scripts.generate_architecture_diagrams import PALETTE, generated_diagrams

PUBLIC_DOC_PATHS = {
    "README.md",
    "CONTRIBUTING.md",
    "SAM_AMBIENT_CODEX_SPEC.md",
    "docs/GETTING_STARTED.md",
    "docs/USER_GUIDE.md",
    "docs/TROUBLESHOOTING.md",
    "docs/ARCHITECTURE.md",
    "docs/DEVELOPMENT_STATUS.md",
    "docs/PUBLIC_DOCUMENTATION_VC.md",
    "docs/diagrams/README.md",
    "docs/diagrams/sam-system-architecture.svg",
    "docs/diagrams/sam-conversation-lifecycle.svg",
    "scripts/generate_architecture_diagrams.py",
    "scripts/check_public_docs.py",
    "tests/unit/test_public_docs_checker.py",
}
COMMON_PAGES = (
    "README.md",
    "CONTRIBUTING.md",
    "SAM_AMBIENT_CODEX_SPEC.md",
    "ui/README.md",
    "docs/GETTING_STARTED.md",
    "docs/USER_GUIDE.md",
    "docs/TROUBLESHOOTING.md",
    "docs/ARCHITECTURE.md",
    "docs/diagrams/README.md",
    "docs/OWNER_AUTHORITY.md",
    "docs/AGENCY_CAPABILITIES.md",
    "docs/MEMORY_FOUNDATION_I.md",
    "docs/RELEASE_NOTES_0.2.5.md",
    "docs/RELEASE_READINESS_0.2.5.md",
    "SECURITY.md",
    "docs/DIAGNOSTIC_LAUNCH.md",
)
SVG = "{http://www.w3.org/2000/svg}"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def git(root, *args):
    return subprocess.check_output(
        ["git", "-C", str(root), *args], text=True, encoding="utf-8", timeout=5
    ).strip()


def without_fences(text):
    text = re.sub(r"(?ms)^\s*```[^\n]*\n.*?^\s*```[^\n]*$", "", text)
    return re.sub(r"(?ms)^\s*~~~[^\n]*\n.*?^\s*~~~[^\n]*$", "", text)


def prose(text):
    return re.sub(r"`[^`\n]+`", "", without_fences(text))


def anchors(text):
    result = set(re.findall(r'\bid=["\']([^"\']+)["\']', text))
    used = {}
    for line in without_fences(text).splitlines():
        match = re.match(r"^#{1,6}\s+(.+?)\s*#*\s*$", line)
        if not match:
            continue
        heading = re.sub(r"<[^>]*>", "", match[1])
        slug = re.sub(r"[^\w -]", "", heading.casefold()).replace(" ", "-")
        count = used.get(slug, 0)
        result.add(f"{slug}-{count}" if count else slug)
        used[slug] = count + 1
    return result


def links(text):
    text = prose(text)
    definitions = {
        label.casefold(): target.strip("<>")
        for label, target in re.findall(r"^\s*\[([^\]]+)\]:\s*(\S+)", text, re.MULTILINE)
    }
    result = list(definitions.values())
    result += re.findall(r"!?\[[^\]\n]*\]\(\s*(<?[^)\s]+>?)", text)
    result += re.findall(r'<(?:img|a)\b[^>]*(?:src|href)=["\']([^"\']+)', text)
    for label, reference in re.findall(r"\[([^\]\n]+)\]\[([^\]\n]*)\]", text):
        key = (reference or label).casefold()
        require(key in definitions, f"Undefined Markdown reference: {key}")
        result.append(definitions[key])
    for label in re.findall(r"\[([^\]\n]+)\](?![(:\[])", text):
        if label.casefold() in definitions:
            result.append(definitions[label.casefold()])
    return set(result)


def check_links(root, paths, tracked=None):
    count = 0
    canonical = {p.casefold(): p for p in tracked} if tracked is not None else None
    for relative in paths:
        page = root / relative
        require(page.is_file(), f"Required documentation missing: {relative}")
        require(page.stat().st_size < 2 * 1024 * 1024, f"Oversized document: {relative}")
        for link in links(page.read_text(encoding="utf-8")):
            url = urlsplit(link.strip("<>"))
            require(url.scheme not in {"javascript", "data", "file"}, f"Unsafe link: {relative}")
            if url.scheme or url.netloc:
                continue  # No external URL availability is inferred.
            target = (page.parent / unquote(url.path)).resolve() if url.path else page.resolve()
            require(target.is_relative_to(root), f"Link leaves checkout: {relative}: {link}")
            require(target.exists(), f"Missing link: {relative}: {link}")
            if canonical is not None and target.is_file():
                name = target.relative_to(root).as_posix()
                require(
                    canonical.get(name.casefold()) == name, f"Untracked/wrong-case link: {link}"
                )
            if url.fragment and target.suffix.casefold() == ".md":
                require(
                    unquote(url.fragment) in anchors(target.read_text(encoding="utf-8")),
                    f"Missing anchor: {relative}: {link}",
                )
            count += 1
    return count


def check_svg(text, expected=None):
    require("<!DOCTYPE" not in text and "@import" not in text, "Unsafe SVG declarations")
    root = ET.fromstring(text)
    require(root.tag == SVG + "svg" and root.attrib.get("role") == "img", "SVG root/role")
    require(root.attrib.get("aria-labelledby") == "title desc", "SVG accessible name")
    for key in ("title", "desc"):
        require(root.find(SVG + key) is not None and root.find(SVG + key).text, f"SVG {key}")
    identities = [node.attrib["id"] for node in root.iter() if "id" in node.attrib]
    require(len(identities) == len(set(identities)), "Duplicate SVG IDs")
    for node in root.iter():
        require(
            node.tag not in {SVG + "script", SVG + "foreignObject", SVG + "image"},
            "Unsafe SVG element",
        )
        for key, value in node.attrib.items():
            require(
                not key.lower().startswith("on") and not key.endswith("href"),
                "Unsafe SVG attribute",
            )
            for identity in re.findall(r"url\(#([^)]+)\)", value):
                require(identity in identities, "Unresolved SVG marker")
    require("http" not in text.replace("http://www.w3.org/2000/svg", ""), "External SVG resource")
    _, _, width, height = map(float, root.attrib["viewBox"].split())
    boxes = [
        tuple(map(float, node.attrib["data-bounds"].split()))
        for node in root.iter()
        if node.attrib.get("data-kind") == "node"
    ]
    for x, y, w, h in boxes:
        require(0 <= x < x + w <= width and 0 <= y < y + h <= height, "SVG node bounds")
    for (x, y, w, h), (a, b, c, d) in combinations(boxes, 2):
        require(x + w <= a or a + c <= x or y + h <= b or b + d <= y, "SVG node overlap")
    for node in root.iter(SVG + "text"):
        x, y = float(node.attrib["x"]), float(node.attrib["y"])
        require(
            0 <= x + float(node.attrib["data-estimated-width"]) <= width - 10, "SVG text estimate"
        )
        require(18 <= y <= height - 10, "SVG text height")
    nodes = {
        node.attrib["id"]: tuple(map(float, node.attrib["data-bounds"].split()))
        for node in root.iter()
        if node.attrib.get("data-kind") == "node"
    }
    for edge in root.iter(SVG + "path"):
        if "data-source" not in edge.attrib:
            continue
        points = [
            tuple(map(float, pair.split(",")))
            for pair in edge.attrib["d"].removeprefix("M").split(" L")
        ]
        require(all(math.isfinite(v) for point in points for v in point), "SVG finite edge")
        for identity, (px, py) in (
            (edge.attrib["data-source"], points[0]),
            (edge.attrib["data-target"], points[-1]),
        ):
            require(identity in nodes, "Unknown SVG endpoint")
            x, y, w, h = nodes[identity]
            require(
                (px in (x, x + w) and y <= py <= y + h) or (py in (y, y + h) and x <= px <= x + w),
                "Floating SVG endpoint",
            )
        require("marker-end" in edge.attrib, "Undirected SVG transition")
        for (ax, ay), (bx, by) in pairwise(points):
            require(ax == bx or ay == by, "Non-orthogonal SVG route")
            for identity, (x, y, w, h) in nodes.items():
                if identity in (edge.attrib["data-source"], edge.attrib["data-target"]):
                    continue
                crosses = (
                    ax == bx and x < ax < x + w and max(min(ay, by), y) < min(max(ay, by), y + h)
                ) or (ay == by and y < ay < y + h and max(min(ax, bx), x) < min(max(ax, bx), x + w))
                require(not crosses, f"SVG route crosses unrelated node: {identity}")
    if expected is not None:
        require(text == expected, "SVG differs from editable generator")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def check_release_diff(root, base):
    require(
        git(root, "merge-base", base, "HEAD") == base, "Release base is not the branch ancestor"
    )
    history = git(root, "rev-list", "--reverse", "--parents", f"{base}..HEAD").splitlines()
    # V-G1 adds a fourth authorized docs-only fast-forward. Check EVERY commit
    # below, including intermediate changes that were subsequently reverted.
    require(len(history) <= 4, "Public docs branch has unexpected implementation history")
    parent = base
    for row in history:
        fields = row.split()
        require(
            len(fields) == 2 and fields[1] == parent,
            "Public docs ancestry is not linear from release",
        )
        parent = fields[0]
        commit_paths = set(
            git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", fields[0]).splitlines()
        )
        require(
            not commit_paths - PUBLIC_DOC_PATHS,
            f"Non-documentation commit: {fields[0]}",
        )
    changed = set(filter(None, git(root, "diff", "--name-only", base).splitlines()))
    changed.update(
        filter(None, git(root, "ls-files", "--others", "--exclude-standard").splitlines())
    )
    require(
        not changed - PUBLIC_DOC_PATHS,
        f"Non-documentation change: {sorted(changed - PUBLIC_DOC_PATHS)}",
    )
    for name in ("LICENSE", "NOTICE", "THIRD_PARTY.md", "sam-logo.png"):
        require(
            git(root, "rev-parse", f"{base}:{name}") == git(root, "hash-object", name),
            f"Changed attribution/logo: {name}",
        )
    return {"base": base, "commits": len(history), "changed_files": sorted(changed)}


def luminance(color):
    values = [int(color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values]
    return sum(v * weight for v, weight in zip(linear, (0.2126, 0.7152, 0.0722), strict=True))


def audit(root, profile, release_base=None):
    root = root.resolve()
    tracked = git(root, "ls-files", "--cached", "--others", "--exclude-standard").splitlines()
    pages = list(COMMON_PAGES)
    if profile == "release":
        pages += ["docs/DEVELOPMENT_STATUS.md", "docs/PUBLIC_DOCUMENTATION_VC.md"]
    else:
        pages += [
            "docs/OWNER_REQUIREMENTS.md",
            "docs/BACKLOG.md",
            "docs/ROADMAP.md",
            "docs/STATE.md",
            "docs/VB_CLOSURE_AUDIT_VC.md",
        ]
    local_links = check_links(root, pages, tracked)
    diagrams = {}
    for name, expected in generated_diagrams().items():
        diagrams[name] = check_svg(
            (root / "docs/diagrams" / name).read_text(encoding="utf-8"), expected
        )
    minimum_contrast = 100.0
    for ink in ("text", "muted", "control", "data", "delivery", "warning"):
        for surface in ("background", "panel", "card"):
            dark, light = sorted((luminance(PALETTE[ink]), luminance(PALETTE[surface])))
            minimum_contrast = min(minimum_contrast, (light + 0.05) / (dark + 0.05))
    require(minimum_contrast >= 4.5, "Diagram text contrast")
    readme = (root / "README.md").read_text(encoding="utf-8")
    require("--branch v0.2.5" in readme and "**Released · v0.2.5**" in readme, "Release pin/status")
    require("**Future**" in readme and "v0.2.6+" in readme, "Release/dev/future separation")
    require(
        "0.2.3" not in readme and "remaining hosted Ubuntu" not in readme, "Stale README status"
    )
    require('src="sam-logo.png"' in readme, "Original logo reference")
    require("Copyright 2026 Alfonso Ernesto de la Fuente Ruiz, PhD" in readme, "Apache attribution")
    require(
        "Original Sam material is licensed under the Apache License, Version 2.0." in readme,
        "Apache wording",
    )
    report = {
        "profile": profile,
        "pages": len(pages),
        "local_links": local_links,
        "svg_sha256_lf": diagrams,
        "minimum_palette_text_contrast": round(minimum_contrast, 2),
        "rendered": False,
        "external_urls_checked": False,
    }
    if release_base:
        report["release_diff"] = check_release_diff(root, release_base)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--profile", choices=("development", "release"), default="development")
    parser.add_argument("--release-base")
    args = parser.parse_args()
    print(json.dumps(audit(args.root, args.profile, args.release_base), indent=2))


if __name__ == "__main__":
    main()
