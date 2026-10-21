import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { createBuildProvenance } from "./build-provenance.mjs";

export default defineConfig(({ command }) => {
  const provenance = command === "build" ? createBuildProvenance() : null;
  return {
    plugins: [
      react(),
      ...(provenance
        ? [
            {
              name: "sam-build-provenance",
              generateBundle() {
                this.emitFile({
                  type: "asset",
                  fileName: "assets/sam-build.json",
                  source: `${JSON.stringify(provenance, null, 2)}\n`,
                });
              },
              transformIndexHtml() {
                return [
                  {
                    tag: "meta",
                    attrs: { name: "sam-ui-source", content: provenance.sourceDigestSha256Lf },
                  },
                ];
              },
            },
          ]
        : []),
    ],
    define: {
      "import.meta.env.SAM_UI_SOURCE_ID": JSON.stringify(
        provenance?.sourceDigestSha256Lf ?? "development-source",
      ),
      "import.meta.env.SAM_UI_SOURCE_COMMIT": JSON.stringify(provenance?.sourceCommit ?? "unknown"),
    },
    clearScreen: false,
    build: {
      outDir: "../src/sam_ambient/static",
      emptyOutDir: true,
      manifest: true,
    },
    server: {
      host: "127.0.0.1",
      port: 1420,
      strictPort: true,
      watch: {
        ignored: ["**/src-tauri/target/**"],
      },
    },
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
    },
  };
});
