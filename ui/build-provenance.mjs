import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const uiRoot = dirname(fileURLToPath(import.meta.url));
const buildInputs = [
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
];

/** Content identity survives Git-less source archives; Git identity is supplemental.
 * No timestamps, machine paths, credentials or runtime conversation data are emitted.
 */
export function createBuildProvenance(root = uiRoot) {
  const paths = [...buildInputs];
  function collect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) collect(path);
      else if (entry.isFile()) paths.push(relative(root, path).replaceAll("\\", "/"));
      else throw new Error("Frontend build inputs must be ordinary files/directories");
    }
  }
  collect(join(root, "src"));
  const sourceFiles = Object.fromEntries(
    paths.sort().map((path) => [
      `ui/${path}`,
      createHash("sha256")
        .update(
          /\.(?:[cm]?tsx?|[cm]?js|css|json|html|ya?ml)$/.test(path)
            ? readFileSync(join(root, path), "utf8").replaceAll("\r\n", "\n")
            : readFileSync(join(root, path)),
        )
        .digest("hex"),
    ]),
  );
  let sourceCommit = null;
  let sourceDirty = null;
  try {
    const git = (args) =>
      execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 2000 }).trim();
    sourceCommit = git(["rev-parse", "HEAD"]);
    sourceDirty = git(["status", "--porcelain", "--untracked-files=normal", "--", "."]) !== "";
  } catch {
    // Source archives need not contain Git; a content identity is still mandatory.
  }
  return {
    schema: 1,
    visualIdentity: "connected-skin-ivd-experimental",
    sourceCommit,
    sourceDirty,
    sourceDigestSha256Lf: createHash("sha256").update(JSON.stringify(sourceFiles)).digest("hex"),
    sourceFiles,
  };
}
