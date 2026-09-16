import { describe, expect, it } from "vitest";
import { placeTooltip } from "../src/tooltip";

const viewport = { width: 390, height: 844 };

describe("tooltip placement", () => {
  it("keeps a wide tooltip inside the left edge and opens below a top control", () => {
    const placement = placeTooltip(
      { left: 12, top: 16, right: 112, bottom: 48, width: 100, height: 32 },
      { width: 250, height: 58 },
      viewport,
    );

    expect(placement).toMatchObject({ left: 12, top: 54, side: "below" });
    expect(placement.maxWidth).toBe(366);
  });

  it("keeps a wide tooltip inside the right edge and opens above a bottom control", () => {
    const placement = placeTooltip(
      { left: 290, top: 790, right: 378, bottom: 822, width: 88, height: 32 },
      { width: 250, height: 58 },
      viewport,
    );

    expect(placement).toMatchObject({ left: 128, top: 726, side: "above" });
  });

  it("clamps oversized popovers to the usable viewport", () => {
    const placement = placeTooltip(
      { left: 140, top: 390, right: 250, bottom: 422, width: 110, height: 32 },
      { width: 600, height: 1000 },
      viewport,
    );

    expect(placement).toMatchObject({ left: 12, maxWidth: 366, maxHeight: 820 });
    expect(placement.top).toBeGreaterThanOrEqual(12);
    expect(placement.top).toBeLessThanOrEqual(12);
  });
});
