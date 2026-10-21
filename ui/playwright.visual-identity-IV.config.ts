import { defineConfig } from "@playwright/test";
import base from "./playwright.visual-identity.config";

/** Explicit future machine-free pass only; no Sam/core/provider/audio entry point. */
export default defineConfig({
  ...base,
  testMatch: ["visual-identity-IV.spec.ts"],
  timeout: 180_000,
  workers: 1,
});
