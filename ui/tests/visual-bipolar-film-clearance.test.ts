import { expect, it } from "vitest";
import { bipolarTriangles, clearancePoses } from "./fixtures/bipolar-clearance";
import { BIPOLAR_FILM_API } from "./fixtures/bipolar-film-analysis";
import { surfaceClearance } from "./fixtures/triangle-clearance";

it("V-F6 retains every V-F5 clearance pose/quality without relaxing the full triangle guard", async () => {
  const reports = [];
  for (const quality of ["low", "medium", "high"] as const)
    for (const { name, pose } of clearancePoses()) {
      const report = {
        name,
        pose,
        quality,
        ...surfaceClearance(
          bipolarTriangles(BIPOLAR_FILM_API, pose, quality),
          (0.025 * (pose.bodyRadius ?? 1.18)) / 1.18,
        ),
      };
      reports.push(report);
    }
  const env = (globalThis as unknown as { process: { env: Record<string, string> } }).process.env;
  if (env.SAM_VF6_REPORT) {
    const path = "node:fs";
    const fs = (await import(path)) as { writeFileSync: (p: string, s: string) => void };
    fs.writeFileSync(env.SAM_VF6_REPORT, JSON.stringify(reports, null, 2));
  }
  for (const r of reports)
    expect(
      r.pairs.filter((p) => p.intersections || (p.surfaces[0] !== p.surfaces[1] && p.near)),
      `${r.quality}/${r.name}`,
    ).toEqual([]);
}, 30000);
