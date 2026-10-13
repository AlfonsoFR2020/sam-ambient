import { defineConfig } from "@playwright/test";

/** Desktop-safe renderer evidence: no Sam UI, owner connection or audio stack. */
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "visual-identity.spec.ts",
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:1436",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    launchOptions: { chromiumSandbox: true, args: ["--mute-audio"] },
    viewport: { width: 720, height: 720 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1436",
    url: "http://127.0.0.1:1436/tests/fixtures/visual-identity.html",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
