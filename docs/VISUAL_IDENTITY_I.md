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

## Final comparable outputs

- [Form and membrane, front and rotated](evidence/visual-identity-I/form-comparison.png)
- [Baseline/new material at 0, 8, 24 and 60 seconds](evidence/visual-identity-I/material-evolution.png)
- [Quiet/speech emphasis, listening and adjacent frames](evidence/visual-identity-I/speech-and-continuity.png)
- [Low/medium/high tiers](evidence/visual-identity-I/quality-tiers.png)
- [Machine-readable measurements and source provenance](evidence/visual-identity-I/measurements.json)

Each contact-sheet cell uses the same 500 × 500 crop of the original 720 × 720
frame, resampled to 400 × 400 and composited onto #090b12. No exposure or camera
adjustment flatters the new version. The recorded baseline is a282193; new normalized
source hashes identify the final implementation, including the last lift-dependent
membrane light refinement. That refinement followed image inspection showing weak
tonal separation despite repaired curvature. It adds bounded broad satin light
at raised centers/shoulders, retaining shared pigment and body tone at the edge.

The normal diagnostic render confirms smoothly varying displaced body normals;
the light-only render isolates a curved key/glint response. The complete composition
still needs human judgment; normal continuity does not prove an attractive object.

### Fixed-camera behavioral proxies

Differences average absolute RGB byte changes over the central 360 × 360 region.
“Changed” means mean channel difference ≥ 3/255. These are conservative connectivity/
continuity checks, not a score for beauty, membrane recognizability or physical accuracy.

| Comparison | Baseline | New | Meaning / limit |
| --- | ---: | ---: | --- |
| Membrane vs body, changed fraction | 31.0% | 43.8% | More of the face has layer-dependent response; not perceptual acceptance |
| Rotated membrane, changed fraction | 37.1% | 48.4% | Separation survives another fixed view; not every orientation |
| 8-second material change, mean /255 | 28.65 | 26.77 | Both actually transport material; no claim that more pixel change is better |
| 60-second material change, mean /255 | 30.31 | 24.31 | Spatial/palette evolution survives longer observation |
| Adjacent 40 ms frames, mean /255 | 1.03 | 0.81 | Smooth short-step change, far below spaced-time differences |
| Quiet → ordinary output, mean /255 | 7.95 | 6.90 | Signal still reaches actual geometry/light |
| Ordinary → emphasis, mean /255 | 7.15 | 6.24 | Stronger output remains distinguishable |

RMS 0.12 expands the evaluated speaking radius 1.02883 → 1.04997;
RMS 0.45 reaches 1.06978. These radius values are identical before/after: no audio
gain retuning. Listening RMS 0.12 gives a much smaller receptive contraction
(1.05383 → 1.05043), not the speaking expansion. Audio Reactivity zero produces
zero meaningfully changed pixels (mean difference < 0.001/255 quantization noise).
Existing attack/release, emphasis, retirement, Reduced Motion and continuity tests pass.

### Performance and tier bounds

RTX 3070, ANGLE D3D11, headless Chrome, 720 × 720 backing/DPR 1. Twelve valid,
non-disjoint GPU timer queries per tier, eight fixed-frame draws/query after warm-up.
The GPU samples are device timers; neither browser submission nor `finish` wall time
is substituted for GPU time. This tiny isolated fixture is not full Sam or CI FPS.

| Tier | Body vertices | Membrane vertices before → new | GPU median before → new | New sampled p95 |
| --- | ---: | ---: | ---: | ---: |
| Low | 561 | 294 → 294 | ~0.043 → 0.046 ms | ~0.047 ms |
| Medium | 2,701 | 671 → 891 | ~0.087 → 0.096 ms | ~0.100 ms |
| High | 4,753 | 1,936 → 3,216 | ~0.140 → 0.161 ms | ~0.162 ms |

High adds roughly 103 KiB of membrane vertex/index buffers. Fragment noise samples,
four draws, particle counts 12/24/40, pixel/DPR/cadence caps and seeded identity stay
unchanged. Vertex surface evaluations increase from three to five for body normals
and from one to five for membrane/body-normal agreement. High's modest measured
increase is acceptable in this fixture; no performance optimization or sphere
tessellation increase is justified. Low/medium remain materially cheaper.
The unit regression bounds combined high body/membrane vertices at 8,500 and preserves
relative tier advantages, without a machine-dependent FPS assertion.

CPU/submission medians are below the browser timer's useful resolution here.
Eight-frame batch quantization is about 0.0125 ms/frame; do not interpret recorded
zeros as zero CPU cost. No frame cadence, real audio latency, maximum-DPR, thermal,
integrated inference or representative low-power measurement was attempted.

### Validation and acceptance boundary

- **103 visual unit tests** across ten files, including new cusp/irregular-gradient
  and tier-bound regressions; TypeScript and changed-file Biome pass.
- The explicitly headless/sandboxed fixed-render fixture passes; production frontend
  build updates the shipped owner assets without starting Sam. Diff/link checks pass.
- No dependencies, settings schema/defaults, provider/audio behavior, version, release
  or remote Git changes. No personal recordings, audio capture/playback or visible app.
- Technical polygon cues from the pointed/coarsely sampled membrane and inconsistent
  normals are addressed. Higher quality no longer depends on stronger/smaller caps.
  Palette allocation and territory scale are improved composition hypotheses.
- The owner's judgment of a living, beautiful Orb, visible coherent skin, richer color
  and natural response remains **unverified**. The original concept board is absent.
  Do not mark October 9 visual criticism resolved merely from these measurements.

The single highest-value remaining graphical improvement is coherent **layered
membrane depth**: current fragments still approximate soft overlaps. Guide that
bounded next visual step with the actual reference and a later review, rather than
adding shader layers, particles or more geometry blindly. No such work starts here.

### Explicit limitations

The skin is still seeded fragments, not a connected refractive shell. Near-opaque
depth-writing soft overlaps are an approximation; exact alpha ordering and the
read as one loosened layer remain open. Low deliberately retains a coarse body.
Changed light/color is an artistic hypothesis; no perceptual acceptance is claimed.
The actual concept board is unavailable, no human test occurred, and no full-app,
inference coexistence, sustained thermal or representative low-power cost was measured.
