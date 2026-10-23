# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: orb-vf3.spec.ts >> hosted matched skin smoke, equations and representative views
- Location: tests/browser/orb-vf3.spec.ts:10:1

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 0.0001
Received:   0.00010608920274735034
```

# Test source

```ts
  13  | }, info) => {
  14  |   const fsPath = "node:fs",
  15  |     cpPath = "node:child_process";
  16  |   const fs = (await import(fsPath)) as {
  17  |     mkdirSync(path: string, options: { recursive: boolean }): void;
  18  |     writeFileSync(path: string, data: string | Uint8Array): void;
  19  |     readFileSync(path: URL, encoding: "utf8"): string;
  20  |   };
  21  |   const cp = (await import(cpPath)) as {
  22  |     execFileSync(file: string, args: string[], options: { encoding: "utf8" }): string;
  23  |   };
  24  |   const environment = (globalThis as unknown as { process: { env: Record<string, string> } })
  25  |     .process.env;
  26  |   const failures: string[] = [],
  27  |     consoleErrors: string[] = [];
  28  |   const shots: { name: string; image: string }[] = [];
  29  |   fs.mkdirSync(info.outputDir, { recursive: true });
  30  |   const source = JSON.parse(
  31  |     fs.readFileSync(new URL("../../../vf2-evidence/source-assets.json", import.meta.url), "utf8"),
  32  |   );
  33  |   const metadata = {
  34  |     ...VF3_PLAN,
  35  |     head: cp.execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  36  |     run: environment.SAM_VF3_RUN_URL,
  37  |     browserVersion: browser.version(),
  38  |     source,
  39  |     views: [] as unknown[],
  40  |     equationProofs: [] as unknown[],
  41  |     hypotheses: [] as unknown[],
  42  |     failures,
  43  |     consoleErrors,
  44  |     limitation:
  45  |       "Hosted SwiftShader establishes software WebGL execution, not hardware performance, full-app coexistence or owner acceptance",
  46  |   };
  47  |   const saveMetadata = () =>
  48  |     fs.writeFileSync(info.outputPath("evidence.json"), JSON.stringify(metadata, null, 2));
  49  |   const saveImage = (name: string, image: string) =>
  50  |     fs.writeFileSync(
  51  |       info.outputPath(`${name}.png`),
  52  |       Uint8Array.from(atob(image.split(",")[1]), (c) => c.charCodeAt(0)),
  53  |     );
  54  |   page.on("pageerror", (error) => consoleErrors.push(error.message));
  55  |   page.on("console", (message) => {
  56  |     if (message.type() === "error") consoleErrors.push(message.text());
  57  |   });
  58  |   await page.route("**/*", (route) => {
  59  |     const url = new URL(route.request().url());
  60  |     return url.origin === "http://127.0.0.1:1436" ? route.continue() : route.abort();
  61  |   });
  62  |   try {
  63  |     saveMetadata();
  64  |     await page.goto("/tests/fixtures/visual-identity.html");
  65  |     const capturePair = async (sample: typeof VF3_SMOKE) => {
  66  |       const result = [];
  67  |       for (const appearance of VF3_APPEARANCES) {
  68  |         const shot = await page.evaluate(
  69  |           async ({ sample, appearance }) => {
  70  |             const path = "/tests/fixtures/orb-vf3.ts";
  71  |             const api = (await import(path)) as typeof import("../fixtures/orb-vf3");
  72  |             return api.renderVF2(sample, appearance, api.vf2Frame(sample));
  73  |           },
  74  |           { sample, appearance },
  75  |         );
  76  |         // Persist each view immediately, including the first if its counterpart fails.
  77  |         result.push(shot);
  78  |         shots.push(shot);
  79  |         saveImage(shot.name, shot.image);
  80  |         metadata.views.push(shot.metadata);
  81  |         saveMetadata();
  82  |       }
  83  |       for (const shot of result) expect(shot.metadata.frame).toEqual(result[0].metadata.frame);
  84  |       for (const shot of result) {
  85  |         expect(shot.metadata.backend).toBe("webgl2");
  86  |         expect(shot.metadata.error).toBe(0);
  87  |         expect(shot.metadata.version).toContain("WebGL 2");
  88  |         expect(shot.metadata.coveredPixels).toBeGreaterThan(sample.radius ? 3000 : 10000);
  89  |         expect(shot.metadata.colourRange[1] - shot.metadata.colourRange[0]).toBeGreaterThan(10);
  90  |       }
  91  |     };
  92  |     await capturePair(VF3_SMOKE); // No matrix before both actual shaders/contexts succeed.
  93  |     for (const appearance of VF3_APPEARANCES) {
  94  |       const result = await page.evaluate(async (appearance) => {
  95  |         const path = "/tests/fixtures/skin-gpu-proof.ts";
  96  |         return ((await import(path)) as typeof import("../fixtures/skin-gpu-proof")).proveSkinGPU(
  97  |           appearance,
  98  |         );
  99  |       }, appearance);
  100 |       metadata.equationProofs.push(result);
  101 |       if (
  102 |         !result.finite ||
  103 |         result.error !== 0 ||
  104 |         result.samples !== 192 ||
  105 |         result.maxPositionError >= 0.0001 ||
  106 |         result.maxNormalError >= 0.005
  107 |       )
  108 |         failures.push(`Equation proof outside contract: ${appearance}`);
  109 |       saveMetadata();
  110 |       expect.soft(result.error).toBe(0);
  111 |       expect.soft(result.samples).toBe(192);
  112 |       expect.soft(result.finite).toBe(true);
> 113 |       expect.soft(result.maxPositionError).toBeLessThan(0.0001);
      |                                            ^ Error: expect(received).toBeLessThan(expected)
  114 |       expect.soft(result.maxNormalError).toBeLessThan(0.005);
  115 |     }
  116 |     for (const sample of VF3_CASES) await capturePair(sample);
  117 |     for (const sample of VF3_PARTICLES) {
  118 |       const shot = await page.evaluate(async (sample) => {
  119 |         const path = "/tests/fixtures/orb-vf3.ts";
  120 |         const api = (await import(path)) as typeof import("../fixtures/orb-vf3");
  121 |         return api.renderVF2(sample, "organic-peel-experimental", api.vf2Frame(sample));
  122 |       }, sample);
  123 |       saveImage(shot.name, shot.image);
  124 |       metadata.hypotheses.push(shot.metadata);
  125 |       saveMetadata();
  126 |       expect(shot.metadata.error).toBe(0);
  127 |     }
  128 |     const sheet = await page.evaluate(async (shots) => {
  129 |       const path = "/tests/fixtures/orb-vf3.ts";
  130 |       return ((await import(path)) as typeof import("../fixtures/orb-vf3")).vf2Sheet(shots);
  131 |     }, shots);
  132 |     saveImage("comparison", sheet);
  133 |     expect(metadata.views).toHaveLength(3 * (VF3_CASES.length + 1));
  134 |     expect(consoleErrors).toEqual([]);
  135 |   } catch (error) {
  136 |     failures.push(String(error));
  137 |     throw error;
  138 |   } finally {
  139 |     saveMetadata();
  140 |   }
  141 | });
  142 | 
```