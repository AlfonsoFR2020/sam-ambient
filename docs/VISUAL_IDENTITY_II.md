# Visual Identity II — living sheets, behavior and fidelity

2026-10-14, local post-v0.2.4 dev. The previous six tested commits were preserved to
origin/dev at 49e03d5; all new work stays local. No version/release change.

## Reference and safety boundary

The tracked asset search found the Sam logo and the September architecture
illustration, not the missing concept board. The logo supports broad wrapping
layers and a warm luminous body; it is not used as an animated texture. Written
[visual direction](VISUAL_DIRECTION.md), October 9 rejection and
[Identity I comparisons](VISUAL_IDENTITY_I.md) remain authoritative. No invented
reference, physical audio, full Sam/provider/model session or visible app is used.

The explicit headless Chromium-sandbox config serves only a blank local fixture
and renderer modules. Synthetic renderer input cannot emit core/conversation events.

## Stage 1 — representation, not another dome adjustment

Closed, body-colored dome fragments were structurally difficult to read as peeling
skin. Identity I fixed their curvature but retained that representation. The new
membrane is **six broad curved sheets**, identical across tiers. Long attached
edges stay on the displaced body; the free side rises and rolls back. Seeded width,
carrier bend and phase avoid regular plates. The shared spherical pigment follows
the attachment and continues across the sheet; the underside shades more quietly.

One bounded analytic curl law controls radial lift and tangential return. The
existing membrane clock now advances at 0.5 × Motion rad/s before existing bounded
activity/drift factors. It flexes curl radius/angle smoothly, independently of the
color field. Ends taper into the body and the hinge stays attached at every phase.
Carrier, tangent and side derivatives are immutable geometry attributes; dynamic
normals include the body's displaced normal and actual curl derivatives.

Soft alpha no longer writes depth. Six reusable ranges are sorted back-to-front by
their transformed centers and blended against the opaque body's depth. This fixes
the prior faint-edge depth holes; center ordering is a bounded approximation for
intersecting open sheets, not exact per-triangle transparency. Nine draws replace
the old arbitrary four-draw limit (halo/body/six sheets/particles). No per-frame
mesh rebuild or unbounded sorting is introduced. High refinements/cost follow in
Stage 3; fallback and automatic profile/pixel/cadence protections remain.

The compound body/skin radius contract becomes 1.56 units to accommodate a folded
lip rather than a spherical bump. Tested worst-case curl/pose stays inside it;
the ordinary body remains near unit radius. This is not a new owner setting.

### Evidence and remaining stages

Three fixed orientations compare body-only, full color, neutral structure and
isolated membrane at 0/12 seconds. Color/light/body clocks are held fixed while
only the membrane clock advances. A silhouette-mask check proves actual rasterized
geometry moves, not just texture/illumination. These views make raised/curling
structure assessable, but do not establish human aesthetic acceptance.

## Stage 2 — one behavior grammar

Existing authenticated UI state and freshness/owner-checked input/output envelopes
feed the existing adapter and motion evaluator. No new microphone, model or core
events are invented. Idle keeps the autonomous baseline. Listening adds smooth
inward front tension, a more open curl and localized measured-input light.
Processing tightens the curl, modestly accelerates the existing material clock and
lights internal currents from its existing lifecycle cue. Speaking couples the
same bounded prosody pulse to body expansion, satin highlights, curl lift and
particle spread/brightness. These are illustrations of state, not inferred meaning
or a claim to know a speaker's physical direction.

The default synthetic two-peak sequence reaches radii 1.086 / 1.115 versus quiet
1.001; at 1,200 ms its pulse is 6.2% of the emphasized peak. Listening reaches
0.994 versus idle 1.005 at 760 ms; processing reaches 0.982 with work cue 0.945.
Isolated body, skin and particle renders each change under the speech envelope.
The scalar radius is one part of this coupled response, not its acceptance metric.

Output uses a compressive envelope and a soft pulse target integrated in bounded
substeps, preserving stronger emphasis without saturating ordinary speech. Existing
35 ms attack / 110 ms release (70 ms on interruption) remain. Audio Reactivity zero
removes measured modulation exactly while lifecycle posture remains. Reduced
Motion freezes spatial/audio modulation; stale generations and owner-stream
changes retire envelope state. The behavior is independent of quality tier.

Four new adapter-to-motion regressions and the headless temporal/isolated-parts
check cover the coordinated signal, zero, cancellation, stale ownership and
Reduced Motion. This establishes connectivity and visible differences in controlled
renders, not human perceptual or acoustic acceptance.

## Stage 3 — fidelity within the same identity

High samples the body at 128×64 and each of the same six sheets at 64×24. Finer
curves reduce angular lip/silhouette cues, while bounded fine-field derivatives
shade satin relief (roughly four degrees maximum normal perturbation). The first
stronger relief trial looked coarse/busy in the comparison and was reduced, rather
than retaining noise to advertise quality. A broad lifted-shoulder sheen uses the
existing pigment/light. No tier changes palette, seed or behavioral grammar.

High first primes depth for alpha >=0.72 sheet interiors, then blends the sorted
color ranges against nearest opaque depth. It resolves opaque self/intersections
and also occludes rear particles. Soft fringes retain the cheaper approximate
ordering. Invariant vertex positions and a minimal positive depth bias prevent
precision speckles; an isolated alpha regression proves no holes are punched
through previously opaque skin. This is not exact order-independent transparency,
contact-shadow rendering or simulated membrane thickness.

The final curl also uses the smooth work/receptive cues directly: receptive lips
unfurl, working lips coil, measured speech adds bounded flex. Attachment remains
exact. The worst-case combined cue/pose test was strengthened and the maximum
curl radius capped at 0.068 to preserve the existing 1.56 compound radius bound.

| Resource | Low | Medium | High |
| --- | --- | --- | --- |
| Body + sheet vertices | 1,275 | 4,615 | 18,135 |
| Body + sheet triangles | 2,112 | 8,400 | 34,560 |
| Particle cap | 12 | 24 | 64 |
| Draws | 9 | 9 | 10 |
| Immutable geometry bytes uploaded | 86,496 | 276,768 | 1,229,648 |

Four programs/seven geometry buffers remain; the extra pass reuses existing
resources. No textures, framebuffer target, render task/thread, per-frame mesh
rebuild or new dependency is added. High stays below 20,000 body/sheet vertices and
the revised 1.5 MiB geometry envelope. Low disables MSAA and optional fine noise;
Medium keeps balanced sampling. Automatic quality hysteresis, lower-profile caps,
pixel/DPR/cadence bounds, hidden/stopped suspension and Canvas/static fallback remain.

### Cost evidence and limits

Explicit headless sandboxed Chrome, Windows ANGLE/D3D11 on NVIDIA RTX 3070.
Each configuration has 18 warm frames and 12 non-disjoint GPU timer samples,
covering idle/speech/working states and three orientations. CPU submission uses
the browser clock and is approximately 0.1–0.3 ms median; its coarse precision
does not establish an exact microsecond cost. Small GPU samples vary with driver
warmth/scheduling (even identical Low backing sizes differ); these are observations,
not a portable performance gate.

Final draw timings in milliseconds, **median / p95**:

| CSS size / requested DPR | Low | Medium | High |
| --- | --- | --- | --- |
| 480 / 1 | 0.156 / 0.187 | 0.055 / 0.564 | 0.116 / 0.512 |
| 720 / 1 | 0.151 / 0.442 | 0.098 / 0.124 | 0.330 / 1.180 |
| 720 / 2 | 0.062 / 0.180 | 0.201 / 0.658 | 0.924 / 1.672 |
| 960 / 1 | 0.091 / 0.470 | 0.155 / 0.191 | 0.505 / 1.408 |

At requested DPR 2 the actual Low/Medium/High DPR is 1/1.5/2. These isolated
draws do **not** measure full-app FPS, inference coexistence, compositor/presentation
latency, energy, total driver/MSAA/VRAM allocation or low-power hardware. Existing
automatic protection remains necessary. Historical Identity I timings have different
sampling/warmth and are context, not a controlled speedup/slowdown calculation.

## Comparable evidence

- [Before/new/neutral/isolated membrane](evidence/visual-identity-II/membrane-comparison.png):
  same 720 px, DPR 1, camera, seed and 0 s frame; baseline is 49e03d5.
- [Geometric flex clip](evidence/visual-identity-II/membrane-flex.gif): 24 frames,
  500 ms each, one play; no time compression or false loop seam. Body, color and
  light held fixed while the actual membrane phase advances. The 0/12 s mask
  changes at 4,005 silhouette pixels; this supports geometric motion only.
- [Behavior contact sheet](evidence/visual-identity-II/behavior-contact.png): identical
  presentation for idle/listening/working/speaking at 160/420/760/1,200 ms.
- [Tier contact sheet](evidence/visual-identity-II/quality-contact.png): same seed,
  field, state and presentation; smoother edges/folds and High satin response.
- [High depth comparison](evidence/visual-identity-II/depth-comparison.png) isolates
  the compositing change from geometry/material/settings changes.
- [Machine-readable samples/provenance](evidence/visual-identity-II/measurements.json)
  contains normalized source hashes, actual backing sizes, resource counts and all
  timing results. Raw PNGs are generated in ignored `.tmp`, not permanent large media.

Reproduce with `cd ui` and `playwright test visual-identity-II.spec.ts --config
playwright.visual-identity.config.ts --output ../.tmp/visual-identity-II/final` using
the installed locked tooling. It navigates only a blank local fixture; no core or
owner connection. The comparison sheets only arrange/resize those PNGs, without
exposure/color edits. Gray views intentionally replace pigment with neutral light.

## Validation and acceptance boundary

108 focused visual tests across 12 files passed; the depth-precision refinement
then passed 25 relevant checks, TypeScript and refreshed three-case headless gate.
Changed-file Biome, production frontend build and diff/link/source-hash checks pass.
No Python, provider, native, full-Sam, real audio or broad browser suites are needed.

Raised curling structure is plainly assessable in neutral/isolated and silhouette
views and is more visible in full color than the dome baseline. Dense pigment can
still camouflage folds at some angles. Speech is clearly stronger in the controlled
composition; listening and working use distinct posture/currents, but their perceived
character remains unaccepted. High resolves more detail/depth; the distinction is
more useful at large/DPR 2 presentation than a thumbnail, not a different identity.
No automated measure answers whether the owner finds any of this attractive/natural.

The most valuable next graphical improvement is reference-led full-color membrane
readability: calibrate contact-shadow/translucency and pigment contrast so the layer
stays legible without harsh plates or decorative outlines. The original concept
board remains absent; do not fabricate it or start blind shader expansion.
