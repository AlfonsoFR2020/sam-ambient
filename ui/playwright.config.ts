import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:1422",
    browserName: "chromium",
    channel: "chrome",
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1422",
    url: "http://127.0.0.1:1422/?transport=demo",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
