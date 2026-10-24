import { defineConfig } from "@playwright/test";
import base from "./playwright.visual-identity.config";

const environment = (globalThis as unknown as { process?: { env: Record<string, string> } }).process
  ?.env;
if (environment?.SAM_HOSTED_GRAPHICS !== "vf2" || environment.GITHUB_ACTIONS !== "true")
  throw new Error("V-F2 graphics are authorized only in the isolated GitHub-hosted workflow");

export default defineConfig({
  ...base,
  testMatch: ["orb-vf4.spec.ts"],
  timeout: 300_000,
  globalTimeout: 330_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["line"], ["json", { outputFile: "test-results/vf2-results.json" }]],
  use: {
    ...base.use,
    channel: undefined,
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
    launchOptions: {
      chromiumSandbox: true,
      args: [
        "--mute-audio",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
});
