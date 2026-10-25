import { describe, expect, it } from "vitest";
import type { SkinVector } from "../src/visual-engine/skin-domain";
import { bipolarClearanceReport } from "./fixtures/bipolar-clearance";
import { surfaceClearance, triangleDistance } from "./fixtures/triangle-clearance";

describe("offline full triangle surface diagnostic", () => {
  const a: SkinVector[] = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
  ];
  it("detects piercing, coplanar containment, separation and edge-nearest contact", () => {
    expect(
      triangleDistance(a, [
        [0.2, 0.2, -1],
        [0.2, 0.2, 1],
        [0.8, 0.2, 0],
      ]),
    ).toBe(0);
    expect(
      triangleDistance(a, [
        [0.1, 0.1, 0],
        [0.2, 0.1, 0],
        [0.1, 0.2, 0],
      ]),
    ).toBe(0);
    expect(
      triangleDistance(
        a,
        a.map((p) => [p[0], p[1], p[2] + 0.1]),
      ),
    ).toBeCloseTo(0.1, 12);
    expect(
      triangleDistance(a, [
        [1.02, 0, 0],
        [2, 0, 0],
        [1.02, 1, 0],
      ]),
    ).toBeCloseTo(0.02, 12);
  });
  it("ignores shared indexed attachment but tests nonadjacent self intersections", () => {
    const t = {
      id: 0,
      surface: 0,
      ids: [0, 1, 2],
      points: a,
      uv: [
        [0, 0],
        [1, 0],
        [0, 1],
      ] as const,
    };
    expect(surfaceClearance([t, { ...t, id: 1, ids: [0, 3, 4] }], 0.05).tested).toBe(0);
    expect(
      surfaceClearance([t, { ...t, id: 1, ids: [3, 4, 5] }], 0.05).pairs[0].intersections,
    ).toBe(1);
  });
  it("broad phase agrees with exhaustive triangle pairs on a bounded independent fixture", () => {
    let seed = 71;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const triangles = Array.from({ length: 16 }, (_, i) => ({
      id: i,
      surface: i,
      ids: [i * 3, i * 3 + 1, i * 3 + 2],
      points: Array.from({ length: 3 }, () => [random(), random(), random()] as SkinVector),
      uv: [
        [0, 0],
        [1, 0],
        [0, 1],
      ] as const,
    }));
    let intersections = 0,
      near = 0;
    for (let i = 0; i < triangles.length; i++)
      for (let j = i + 1; j < triangles.length; j++) {
        const d = triangleDistance(triangles[i].points, triangles[j].points);
        if (d <= 1e-8) intersections++;
        else if (d < 0.025) near++;
      }
    const report = surfaceClearance(triangles, 0.025);
    expect(report.pairs.reduce((sum, p) => sum + p.intersections, 0)).toBe(intersections);
    expect(report.pairs.reduce((sum, p) => sum + p.near, 0)).toBe(near);
  });
  it("retains full-surface V-F4 diagnosis and bounded candidate witnesses", async () => {
    const report = {
      baseline: bipolarClearanceReport("vf4"),
      baselineHigh: bipolarClearanceReport("vf4", "high", ["idle-0", "speech-silence"]),
      candidate: [
        ...bipolarClearanceReport("candidate"),
        ...bipolarClearanceReport("candidate", "low"),
        ...bipolarClearanceReport("candidate", "high"),
      ],
    };
    const environment = (globalThis as unknown as { process: { env: Record<string, string> } })
      .process.env;
    if (environment.SAM_VF5_REPORT) {
      const fsPath = "node:fs";
      const fs = (await import(fsPath)) as { writeFileSync: (p: string, s: string) => void };
      fs.writeFileSync(environment.SAM_VF5_REPORT, JSON.stringify(report, null, 2));
    }
    expect(report.baseline.some((p) => p.pairs.some((p) => p.intersections > 0))).toBe(true);
    expect(report.baselineHigh.every((p) => p.pairs.some((p) => p.intersections > 0))).toBe(true);
    for (const pose of report.candidate) {
      expect(
        pose.pairs.filter((p) => p.intersections || (p.surfaces[0] !== p.surfaces[1] && p.near)),
        `${pose.name}/${pose.quality}`,
      ).toEqual([]);
    }
  }, 30000);
});
