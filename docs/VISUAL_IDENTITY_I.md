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

This separate config explicitly sets **headless**, one worker, a temporary browser
profile and muted audio. It opens only a blank local fixture with direct renderer
imports on loopback port 1436, never the Sam app, owner connection or audio stack.
Fixed seed 0x5a17, 720 × 720 backing pixels, DPR 1, unchanged settings and framing.
Snapshots isolate material evolution by holding orientation/light/body clocks fixed;
speech snapshots use the actual evaluator with synthetic RMS only.
PNG/JSON outputs are temporary. GPU queries, when valid and non-disjoint, are real
device timer samples; submission and finish-wall timing are separate coarse browser
measurements. These are isolated fixed-frame costs, not full-app or low-power evidence.

## Implementation and comparative evidence

Pending the coherent implementation checkpoint. Human visual acceptance remains open.
