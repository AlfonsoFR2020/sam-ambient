import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORB_APPEARANCE,
  type OrbAppearanceId,
  resolveOrbAppearance,
} from "../src/visual-engine/appearance";
import { skinPoint } from "../src/visual-engine/membrane";
import { skinPoseFromFrame } from "../src/visual-engine/membrane-optics";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import { createSkinOpenings, packSkinOpenings } from "../src/visual-engine/skin-domain";
import { createSkinGeometry } from "../src/visual-engine/skin-geometry";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";
import {
  appearanceShaderSources,
  ORB_FRAGMENT,
  ORB_VERTEX,
  PARTICLE_VERTEX,
  PEEL_FRAGMENT,
  PEEL_VERTEX,
} from "../src/visual-engine/webgl";
import { frameAt } from "./fixtures/visual-identity-II";

const hash = async (value: string | Float32Array | Uint16Array) => {
  const bytes =
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : new Uint8Array(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

describe("V-F1 default appearance compatibility", () => {
  it("retains the verified dev shader, geometry and descriptor baseline", async () => {
    const geometry = await Promise.all(
      Object.values(RENDER_BUDGETS).map(async (budget) => {
        const mesh = createSkinGeometry(budget, 0x5a17);
        return [
          budget.quality,
          await hash(mesh.vertices),
          await hash(mesh.indices),
          await hash(JSON.stringify([mesh.ranges, mesh.boundaries])),
        ];
      }),
    );
    const descriptors = Object.fromEntries(
      await Promise.all(
        Object.entries(packSkinOpenings(createSkinOpenings(0x5a17))).map(async ([key, value]) => [
          key,
          await hash(value),
        ]),
      ),
    );
    expect({
      shaders: await Promise.all(
        [ORB_VERTEX, ORB_FRAGMENT, PEEL_VERTEX, PEEL_FRAGMENT, PARTICLE_VERTEX].map(hash),
      ),
      geometry,
      descriptors,
    }).toMatchSnapshot();
  });
  it("delegates the default strategy without changing seed, arrays or reference equations", () => {
    for (const seed of [0, 0x5a17, 0xffff_ffff]) {
      const definition = resolveOrbAppearance();
      expect(definition).toBe(DEFAULT_ORB_APPEARANCE);
      for (const budget of Object.values(RENDER_BUDGETS)) {
        const setup = definition.skin.create(budget, seed);
        expect(setup.geometry).toEqual(createSkinGeometry(budget, seed));
        expect(setup.descriptors).toEqual(packSkinOpenings(createSkinOpenings(seed)));
        expect(setup.count).toBe(3);
      }
      const pose = skinPoseFromFrame(frameAt(1200, "speaking", 0.25));
      const direction = createSkinOpenings(seed)[0].center;
      expect(definition.skin.reference(seed).point(direction, pose, (n) => n, 0.004)).toEqual(
        skinPoint(direction, createSkinOpenings(seed), pose, (n) => n, 0.004),
      );
    }
    expect(appearanceShaderSources()).toEqual({
      orbVertex: ORB_VERTEX,
      orbFragment: ORB_FRAGMENT,
      skinVertex: PEEL_VERTEX,
      skinFragment: PEEL_FRAGMENT,
    });
  });
  it("keeps internal selection explicit and outside owner persistence", () => {
    expect(Object.isFrozen(DEFAULT_ORB_APPEARANCE)).toBe(true);
    expect(DEFAULT_ORB_APPEARANCE.material.coordinateSpace).toBe(
      DEFAULT_ORB_APPEARANCE.skin.materialSpace,
    );
    expect(DEFAULT_ORB_APPEARANCE.fallback).toBe("shared-recovery");
    expect(DEFAULT_VISUAL_ENGINE_SETTINGS).not.toHaveProperty("appearance");
    expect(() => resolveOrbAppearance("external-glsl" as OrbAppearanceId)).toThrow(/Unsupported/);
    expect(appearanceShaderSources()).toBe(appearanceShaderSources("living-connected"));
    expect(Object.isFrozen(appearanceShaderSources())).toBe(true);
  });
});
