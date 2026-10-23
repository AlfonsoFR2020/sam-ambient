import type { RenderBudget } from "./quality";
import {
  createRadialShellFrame,
  createRadialShellWindows,
  RADIAL_ATTACHED_LATITUDE,
  RADIAL_SECTOR_CUTS,
  radialShellDirection,
  radialShellRim,
} from "./radial-shell-domain";
import type { SkinVector } from "./skin-domain";
import type { SkinDrawRange, SkinGeometry } from "./skin-geometry";

/** Four unequal meridional patches, three rounded sector windows, two closed
 * polar caps. All seams are welded indices; one sphere minus three disks.
 * Setup only. Unit object directions also remain the material coordinates. */
export function createRadialShellGeometry(budget: RenderBudget, seed = 0x5a17): SkinGeometry {
  if (!budget.peels)
    return { vertices: new Float32Array(), indices: new Uint16Array(), ranges: [], boundaries: [] };
  const n = budget.skinSegments,
    rows = budget.skinRows;
  if (
    budget.peels !== 6 ||
    !Number.isInteger(n) ||
    n < 4 ||
    n > 32 ||
    !Number.isInteger(rows) ||
    rows < 4 ||
    rows > 24 ||
    rows % 2
  )
    throw new RangeError("radial skin requires six ranges and bounded even-row sampling");
  if (20 * n * rows - 1 + (budget.sphereLongitude + 1) * (budget.sphereLatitude + 1) > 20_000)
    throw new RangeError("body and radial skin exceed the shared vertex envelope");
  const frame = createRadialShellFrame(seed),
    windows = createRadialShellWindows(seed);
  const vertices: number[] = [],
    indices: number[] = [],
    ranges: SkinDrawRange[] = [],
    boundaries: number[][] = [];
  const welded = new Map<string, number>();
  const vertex = (azimuth: number, latitude: number) => {
    const direction = radialShellDirection(frame, azimuth, latitude);
    const key = direction.map((v) => Math.round(v * 1e9)).join(",");
    const existing = welded.get(key);
    if (existing !== undefined) return existing;
    const index = vertices.length / 3;
    welded.set(key, index);
    vertices.push(...direction);
    return index;
  };
  const range = (center: SkinVector, start: number) =>
    ranges.push({ center, offset: start * 2, count: indices.length - start });
  for (let patch = 0; patch < 4; patch++) {
    const left = RADIAL_SECTOR_CUTS[patch],
      right = RADIAL_SECTOR_CUTS[patch + 1];
    const middle = (left + right) / 2,
      half = (right - left) / 2,
      window = windows[patch];
    const rings: number[][] = [],
      start = indices.length,
      perimeter = 4 * n;
    for (let row = window ? 0 : 1; row <= rows; row++) {
      const ring: number[] = [];
      for (let k = 0; k < perimeter; k++) {
        const side = Math.floor(k / n),
          t = (2 * (k % n)) / n - 1;
        const [sx, sy] = [
          [1, t],
          [-t, 1],
          [-1, -t],
          [t, -1],
        ][side];
        const x = middle + half * sx,
          y = RADIAL_ATTACHED_LATITUDE * sy;
        if (row === rows) {
          ring.push(vertex(x, y));
          continue;
        }
        const cx = window?.azimuth ?? middle,
          cy = window?.latitude ?? 0;
        const theta = Math.atan2(y - cy, x - cx),
          outer = Math.hypot(x - cx, y - cy);
        const inner = window ? radialShellRim(window, theta)[0] : 0;
        const radius = inner + ((outer - inner) * row) / rows;
        ring.push(vertex(cx + radius * Math.cos(theta), cy + radius * Math.sin(theta)));
      }
      rings.push(ring);
    }
    if (window) boundaries.push(rings[0]);
    else {
      const center = vertex(middle, 0);
      for (let k = 0; k < perimeter; k++)
        indices.push(center, rings[0][k], rings[0][(k + 1) % perimeter]);
    }
    for (let row = 0; row < rings.length - 1; row++)
      for (let k = 0; k < perimeter; k++) {
        const next = (k + 1) % perimeter;
        const a = rings[row][k],
          b = rings[row + 1][k],
          c = rings[row][next],
          d = rings[row + 1][next];
        indices.push(a, b, c, c, b, d);
      }
    range(radialShellDirection(frame, middle, 0), start);
  }
  const angles = Array.from({ length: 4 * n }, (_, index) => {
    const patch = Math.floor(index / n),
      t = (index % n) / n;
    return RADIAL_SECTOR_CUTS[patch] * (1 - t) + RADIAL_SECTOR_CUTS[patch + 1] * t;
  });
  for (const sign of [1, -1]) {
    const start = indices.length,
      count = angles.length,
      capRows = rows / 2;
    let previous = angles.map((angle) => vertex(angle, sign * RADIAL_ATTACHED_LATITUDE));
    for (let row = 1; row < capRows; row++) {
      const latitude =
        sign *
        (RADIAL_ATTACHED_LATITUDE + ((Math.PI / 2 - RADIAL_ATTACHED_LATITUDE) * row) / capRows);
      const nextRing = angles.map((angle) => vertex(angle, latitude));
      for (let k = 0; k < count; k++) {
        const next = (k + 1) % count;
        if (sign > 0)
          indices.push(
            previous[k],
            previous[next],
            nextRing[k],
            nextRing[k],
            previous[next],
            nextRing[next],
          );
        else
          indices.push(
            previous[k],
            nextRing[k],
            previous[next],
            previous[next],
            nextRing[k],
            nextRing[next],
          );
      }
      previous = nextRing;
    }
    const pole = vertex(0, (sign * Math.PI) / 2);
    for (let k = 0; k < count; k++) {
      const next = (k + 1) % count;
      if (sign > 0) indices.push(previous[k], previous[next], pole);
      else indices.push(previous[k], pole, previous[next]);
    }
    range(frame.axis.map((v) => v * sign) as unknown as SkinVector, start);
  }
  if (vertices.length / 3 !== 20 * n * rows - 1)
    throw new RangeError("radial skin seam welding mismatch");
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
    ranges,
    boundaries,
  };
}
