/** Authored only: requires explicit headless/WebGL permission before execution. */
import { expect, test } from "@playwright/test";

test("smoke: compiled frontend identity and private-style asset delivery", async ({
  page,
}, info) => {
  const modulePath = "node:fs";
  const fs = (await import(modulePath)) as { readFileSync(path: URL, encoding: "utf8"): string };
  const staticRoot = new URL("../../../src/sam_ambient/static/", import.meta.url);
  const build = JSON.parse(fs.readFileSync(new URL("assets/sam-build.json", staticRoot), "utf8"));
  // No Sam/core connection or owner binding: requests receive only compiled test
  // assets. All other paths/origins are blocked, including WebSocket/network IO.
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const relative = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (
      url.origin !== "http://127.0.0.1:1436" ||
      request.method() !== "GET" ||
      (relative !== "index.html" && !/^assets\/[A-Za-z0-9._-]+$/.test(relative))
    ) {
      await route.abort();
      return;
    }
    await route.fulfill({
      body: fs.readFileSync(new URL(relative, staticRoot), "utf8"),
      contentType: relative.endsWith(".js")
        ? "text/javascript"
        : relative.endsWith(".css")
          ? "text/css"
          : relative.endsWith(".json")
            ? "application/json"
            : "text/html",
    });
  });
  await page.routeWebSocket("**/*", (socket) => socket.close());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?transport=browser");
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-sam-ui-build", "built-assets");
  await expect(root).toHaveAttribute("data-sam-ui-source", build.sourceDigestSha256Lf);
  await expect(root).toHaveAttribute("data-sam-visual-identity", build.visualIdentity);
  await expect(page.getByLabel("Sam startup")).toHaveAttribute("data-expanded", "false");
  await expect(page.locator('[data-sam-renderer="webgl2"]')).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("compiled-startup.png") });
  await info.attach("production-build-provenance", {
    body: JSON.stringify(build, null, 2),
    contentType: "application/json",
  });
});
