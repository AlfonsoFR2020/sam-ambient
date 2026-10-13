# Visual Identity I — organic membrane and living pigment

2026-10-13, post-v0.2.4 dev. Scope: form/membrane and composed living color.
No Sam/provider/audio/device session, visible browser or human beta is used.
The concept board is absent from the repository; the written
[visual direction](VISUAL_DIRECTION.md) and October 9 owner findings guide this pass.

## Diagnosis before editing

- The body already has 96 × 48 high-tier subdivision and field-derived normals.
  Its undisplaced silhouette chord error is subpixel at the fixture radius.
  Increasing this mesh cannot fix a membrane cusp or inconsistent shading.
- Patches use only three radial rings, starting at 0.55: a large central fan.
  `pow(1-r,1.35)` has a nonzero derivative at the center, making a pointed dome.
  The center normal and approximate radial normals cannot describe that cusp
  continuously. High quality increases circumferential samples, not radial curvature.
- Membrane normals omit the body's field displacement and use a hard-coded 0.42
  angular width despite seeded, irregular patch boundaries. Soft alpha writes depth;
  overlaps remain a bounded single-pass approximation, not sorted transparency.
- The shared pigment grammar gates cool colors to low broad/high medium density,
  then uses those same densities to select cool hue. This correlates selection with
  blue/teal and underuses the documented pink/violet anchors. Most warm mid-values
  blend through copper/orange; simply adding anchors cannot fix their allocation.
- At the default initial phase the moving key lies behind much of the front
  hemisphere. Low fill and broad color blending can reduce apparent form/material
  distinction. This is an aesthetic hypothesis supported by the fixed render,
  not proof of the owner's perceptual root cause.
- Fixed-camera broad material pixels already change substantially over 8/60 seconds.
  Transport is connected; speeding every clock is not justified. Preserve independent
  flow, light, breathing, pointer ownership and audio clocks.

## Reproducible desktop-safe fixture

From `ui`, use the existing Node runtime and run:

```text
playwright test --config playwright.visual-identity.config.ts --output ../.tmp/visual-identity/sample
```

This separate config explicitly sets **headless**, Chromium sandbox, one worker,
a temporary browser profile and muted audio. It opens only a blank local fixture with direct renderer
imports on loopback port 1436, never the Sam app, owner connection or audio stack.
Fixed seed 0x5a17, 720 × 720 backing pixels, DPR 1, unchanged settings and framing.
Snapshots isolate material evolution by holding orientation/light/body clocks fixed;
speech snapshots use the actual evaluator with synthetic RMS only.
PNG/JSON outputs are temporary. GPU queries, when valid and non-disjoint, are real
device timer samples; submission and finish-wall timing are separate coarse browser
measurements. These are isolated fixed-frame costs, not full-app or low-power evidence.

## Implementation and comparative evidence

The implementation removes the pointed profile using `(1-r²)²`, adds radial
curvature samples where needed, stores the actual spherical gradient of each
irregular boundary and includes the body's displaced normal. Symmetric tangent
sampling removes one-sided normal bias. The sphere stays 96 × 48 at high.
Broader patches (0.40–0.54 radians, previously 0.35–0.48) lift less
(0.028–0.044, previously 0.045–0.065). This changes the silhouette toward lower,
wider loosened skin rather than small inflated caps. Body field relief decreases
from 0.012 to 0.008 times density offset; breathing/audio radius mapping is unchanged.

Broad noise frequency decreases 1.8 → 1.45, with existing medium 3.6 relative fold.
The palette coordinate uses 1.55 contrast; rose enters warm currents independently,
and cool hue no longer requires the same high-medium condition that favored teal.
Gold/pink/violet/blue/teal anchors become more chromatic. These are deliberate
composition choices within the written direction. Two mandatory fragment samples,
optional 0/1/2 fine samples, deterministic seeding and independent clocks remain.
The key now travels in depth (`z=.65+1.55*cos(phase)`), catching the initial front
hemisphere; a broader satin glint and lower ambient floor reveal curvature.

102 visual unit tests, TypeScript, changed-file Biome and the isolated renderer
comparison pass; shipped frontend assets are rebuilt. Numeric dome/gradient tests
cover the removed cusp and actual irregular boundary. Four draws, particles12/24/40,
DPR/pixel/cadence caps and Canvas/static fallback remain.
Comparative output/cost tables follow in the final evidence checkpoint.

### Explicit limitations

The skin is still seeded fragments, not a connected refractive shell. Near-opaque
depth-writing soft overlaps are an approximation; exact alpha ordering and the
read as one loosened layer remain open. Low deliberately retains a coarse body.
Changed light/color is an artistic hypothesis; no perceptual acceptance is claimed.
The actual concept board is unavailable, no human test occurred, and no full-app,
inference coexistence, sustained thermal or representative low-power cost was measured.
