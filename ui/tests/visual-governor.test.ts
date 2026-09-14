import { describe, expect, it } from "vitest";
import { AdaptiveQualityGovernor } from "../src/visual-engine/governor";
import type { ResolvedQuality } from "../src/visual-engine/quality";
import { RENDER_BUDGETS, resolveRenderBudget } from "../src/visual-engine/quality";
import { resolveVisualEngineSettings } from "../src/visual-engine/settings";

const automatic = resolveVisualEngineSettings({ quality: "auto", deviceProfile: "auto" });

const fill = (
  governor: AdaptiveQualityGovernor,
  renderMs: number,
  windows: number,
  nowStart = 10_000,
) => {
  let result: ResolvedQuality | undefined;
  for (let index = 0; index < windows * 5; index++)
    result =
      governor.observe(renderMs, nowStart + index * 20, automatic, RENDER_BUDGETS.low) ?? result;
  return result;
};

describe("adaptive visual quality", () => {
  it("ignores an isolated spike and promotes only after sustained headroom", () => {
    const governor = new AdaptiveQualityGovernor("low", {
      sampleWindow: 5,
      cooldownMs: 0,
      promotionWindows: 2,
    });
    for (const value of [1, 1, 30, 1, 1])
      expect(governor.observe(value, 10_000, automatic, RENDER_BUDGETS.low)).toBeUndefined();
    expect(fill(governor, 1, 2)).toBe("medium");
  });

  it("demotes sustained overload and does not adapt manual quality", () => {
    const governor = new AdaptiveQualityGovernor("medium", {
      sampleWindow: 5,
      cooldownMs: 0,
      demotionWindows: 2,
    });
    const manual = resolveVisualEngineSettings({ quality: "medium" });
    expect(governor.observe(40, 10_000, manual, RENDER_BUDGETS.medium)).toBeUndefined();
    let result: ResolvedQuality | undefined;
    for (let index = 0; index < 10; index++)
      result =
        governor.observe(40, 11_000 + index * 20, automatic, RENDER_BUDGETS.medium) ?? result;
    expect(result).toBe("low");
  });

  it("keeps adaptive suggestions beneath the selected profile cap", () => {
    expect(
      resolveRenderBudget(
        { quality: "auto", deviceProfile: "mobile_2020" },
        { measuredQuality: "high" },
      ).quality,
    ).toBe("low");
  });

  it("ignores hidden frames and requires consecutive stable windows", () => {
    const governor = new AdaptiveQualityGovernor("low", {
      sampleWindow: 2,
      cooldownMs: 0,
      promotionWindows: 2,
    });
    for (let index = 0; index < 20; index++)
      expect(governor.observe(1, index * 20, automatic, RENDER_BUDGETS.low, false)).toBeUndefined();
    for (const [index, value] of [1, 1, 30, 30, 1, 1, 1, 1].entries()) {
      const result = governor.observe(value, 1_000 + index * 20, automatic, RENDER_BUDGETS.low);
      if (index < 7) expect(result).toBeUndefined();
      else expect(result).toBe("medium");
    }
  });
});
