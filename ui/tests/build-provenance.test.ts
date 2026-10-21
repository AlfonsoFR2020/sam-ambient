import { afterEach, describe, expect, it, vi } from "vitest";
import { createBuildProvenance } from "../build-provenance.mjs";

const source = vi.hoisted(() => ({
  app: "export const app = 1;\n",
  gitAvailable: true,
  dirty: false,
}));
vi.mock("node:fs", () => ({
  readdirSync: () => [{ name: "App.tsx", isDirectory: () => false, isFile: () => true }],
  readFileSync: (path: string) => (path.endsWith("App.tsx") ? source.app : "build configuration\n"),
}));
vi.mock("node:child_process", () => ({
  execFileSync: (_file: string, args: string[]) => {
    if (!source.gitAvailable) throw new Error("Git unavailable in source archive");
    return args[0] === "rev-parse" ? `${"a".repeat(40)}\n` : source.dirty ? " M src/App.tsx\n" : "";
  },
}));
afterEach(() => {
  source.app = "export const app = 1;\n";
  source.gitAvailable = true;
  source.dirty = false;
});

describe("canonical frontend content provenance", () => {
  it("fingerprints source and build inputs reproducibly without machine paths or timestamps", () => {
    const first = createBuildProvenance("private-machine/ui");
    expect(createBuildProvenance("private-machine/ui")).toEqual(first);
    expect(first.sourceCommit).toBe("a".repeat(40));
    expect(first.sourceDirty).toBe(false);
    expect(Object.keys(first.sourceFiles)).toContain("ui/vite.config.ts");
    expect(Object.keys(first.sourceFiles)).toContain("ui/pnpm-lock.yaml");
    expect(first.sourceFiles["ui/src/App.tsx"]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(first)).not.toContain("private-machine");
    source.app = "export const app = 2;\n";
    source.dirty = true;
    const changed = createBuildProvenance("private-machine/ui");
    expect(changed.sourceDigestSha256Lf).not.toBe(first.sourceDigestSha256Lf);
    expect(changed.sourceDirty).toBe(true);
  });
  it("normalizes checkout line endings without hiding source changes", () => {
    const first = createBuildProvenance("fixture/ui");
    source.app = source.app.replaceAll("\n", "\r\n");
    expect(createBuildProvenance("fixture/ui").sourceDigestSha256Lf).toBe(
      first.sourceDigestSha256Lf,
    );
  });
  it("retains content identity in Git-less source archives without inventing a clean commit", () => {
    const first = createBuildProvenance("fixture/ui");
    source.gitAvailable = false;
    const archive = createBuildProvenance("fixture/ui");
    expect(archive.sourceDigestSha256Lf).toBe(first.sourceDigestSha256Lf);
    expect(archive.sourceCommit).toBeNull();
    expect(archive.sourceDirty).toBeNull();
  });
});
