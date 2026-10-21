# Visual Identity IV — connected living skin

2026-10-21. **Assignment IV-B: experimental Candidate B source implementation.**
Quiet-PC permission explicitly allows implementation and test authoring before
render selection. The earlier execution-dependent stop below is historical and
superseded for source work. No tests, type/build tools, browser or GPU have run.

The first source slice uses a welded six-chart cube-sphere with three unequal
irregular openings, shared body displacement, C1 collar lift and analytic curl.
The renderer uses the new domain for geometry/normals and High contact. Tiered
clearance is a physical coat offset (0.016/0.008/0.004), not a global depth bias.
Production palette/clocks/control authority remain unchanged. Focused regressions
are authored, not executed. Source hardening and comparison tooling continue.

## Initial source assessment — preserved history

Assignment IV, **Checkpoint A: source assessment only**, before IV-B authorization.
No representation is selected or integrated. Checkpoints B/C and the visual
milestone remain incomplete. This record preserves a recoverable starting point
and the next comparison, not a green implementation or artistic acceptance.

## Execution boundary and baseline

The assignment authorizes local edits and commits, but was submitted without
`MACHINE-FREE: YES`. No tests, lint/type/build tools, application/server processes,
headless browsers, GPU rendering, providers, models or audio were run. Inspecting
already saved images and hashing tracked files are source/evidence work only.
The task stops before a new render-dependent representation decision. Any later
permission must come from the owner for this task; this document grants none.

- Starting checkout: local `dev`, clean, HEAD
  `486c4a800e5a337ee76a5d4deb355c5f4bc6390b`.
- Published baseline: `dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`.
  The one intervening commit changes nine documents only; product source is identical.
- [Baseline manifest](evidence/visual-identity-IV/baseline-manifest.json) records
  tracked source/fixture Git blobs, LF-normalized SHA-256, existing evidence hashes
  and comparison settings. Git retains the unchanged renderer and original images;
  no duplicate images or generated product assets are needed for this checkpoint.
- No fresh v0.2.5 baseline images or candidate images exist for Assignment IV.
  Existing Identity II/III comparisons predate the released regional palette.
  [Palette evidence](evidence/living-palette/measurements.json) identifies its source
  commit and current-bank rows separately from the shader-substituted old-palette row.
  The old contact sheets must not be relabelled as fresh release/candidate comparisons.

## Diagnosis from source and preserved images

| Finding | Evidence and implication |
| --- | --- |
| Independent long footprints are the leading structural cause | [Descriptors/carriers](../ui/src/visual-engine/geometry.ts) generate six independent rectangular charts: half-length 1.12–1.26 rad, half-width 0.28–0.35 before the width modulation. Nominal aspect ratio is about 3.2–4.5, not projected screen aspect. All have similar tilt, 0.30–0.60 rad, and Fibonacci-like center distribution rather than a shared opening/attachment layout. |
| Free edges reinforce the long-carrier shape | [Curl](../ui/src/visual-engine/membrane.ts) attaches v=0 and rolls toward v=1 along nearly the entire u span. `(1-u*u)^2` suppresses lift at the ends; alpha fades there. This smooths a strap without making separate charts one parent skin. |
| Optics are a secondary visibility problem | In [II isolated/neutral views](evidence/visual-identity-II/membrane-comparison.png), the crossing strips persist without pigment. [III optical comparison](evidence/visual-identity-III/optical-comparison.png) shows calmer film/contact helps separation but retains long lips. The [released-bank film views](evidence/living-palette/film-across-colors.png) still show the long central boundary at several hues. These are provisional Codex observations, not owner acceptance or a new controlled experiment. |
| Real motion and attachment already exist | CPU/GLSL share the curl law, with a zero hinge offset and zero first offset derivatives at v=0. Immutable carrier/side derivatives and displaced body normals feed the shader. [Saved curl phases](evidence/visual-identity-III/curl-phases.png) are subtle at contact-sheet size; three stills cannot establish natural continuous motion. Retain these mechanics rather than inventing speech energy or multiplying body radius. |
| Existing depth is deliberately approximate | [Renderer](../ui/src/visual-engine/webgl.ts) sorts six sheet-center ranges, leaves soft color depth writes off and adds High opaque-interior depth priming. [II depth comparison](evidence/visual-identity-II/depth-comparison.png) shows a repaired dotted edge. Center sorting cannot prove correct curled self-overlap or a future connected shell's transparency. |

The evidence supports investigating coverage/topology first. It does not yet prove
that reorganized sheets fail, nor that a connected parent mesh will look better.
Neither extra tessellation nor optical constants alone has earned selection.

## Two bounded candidates; selection deferred

### A — reorganized swept sheets

Keep the existing carrier, derivative and curl machinery. Replace independent
near-uniform long carriers with a related arrangement of broader, shorter,
asymmetric footprints and local free edges around a few exposed-body regions.
Define placement in one deterministic layout so tiers change sampling, not identity.
Specific widths/coverage remain prototype choices, not new production constants.

This is the smallest implementation risk and the control comparison against B.
Its limitation is structural: adjacent/overlapping sheets are still separate
charts. Wider straps or plates fail even if their shading is attractive. No
extra variants or prolonged width/opacity sweep should follow that failure.

### B — one parent skin with broad openings (leading hypothesis)

Explore one indexed spherical domain with a few separated, broad irregular
openings and attached-to-lifted collars/lobes along their free rims. Openings are
actual mesh boundaries, not transparent painted stripes over a complete sphere.
Connectedness must exist in indexed adjacency, not only in shared color or in
separate patches placed close together. Keep openings apart with substantial
connecting skin; no sliver bridges, islands or regular circumferential cuts.

A bounded construction to prototype is a shared sphere mesh whose cut cells are
clipped/retriangulated once at setup, with shared cut-edge vertices. Opening
descriptors use smooth spherical local coordinates away from their antipodes;
boundary interpolation must resolve the same curve and tangent on both sides of
cell edges. Reject tiny triangles and T-junctions rather than hiding them with
alpha. Do not select a triangulator/dependency or pretend this construction is
already proved. A full boundary loop may need finer setup sampling than its
attached interior; all tiers must retain the same opening topology.

Let q run from the attached collar (0) to free rim (1), and s run periodically
around that rim. Reuse body displacement and the current wrapped membrane phase.
The candidate radial lift and tangential return must vanish with their first
derivatives at q=0; the existing quadratic-lift/cubic-roll law is a useful starting
point. Smoothly vary rim lift/roll along s using integer angular harmonics and
fixed seeded coefficients, with the same existing receptive/work/speech inputs.
Do not use a fractional multiple of a wrapped clock. Compute normals from the
complete deformed surface, including q/s gradients and local tangent changes.

Before selecting B, resolve three concrete risks in the isolated prototype:

1. **Resting surface:** avoid coincident body/skin depth fighting or doubled
   coating. Decide whether the resting region is represented optically by the
   body with a smooth collar transition, or uses mutually exclusive coverage.
   A generic global depth offset is not proof of correct attachment. Invisible
   connecting triangles alone must not count as a convincing connected skin.
2. **Topology and orientation:** one connected component; boundary edges form only
   the intended simple opening loops; interior edges have two incident faces;
   consistent winding, nonzero areas, no duplicated cut seam or fold inversion
   across the existing posture extremes. These are required future checks.
3. **Transparency:** a connected mesh has no equivalent to six independently
   sorted sheet centers. Start with the existing opaque-body/depth-interior and
   soft-edge strategy, but assess actual self-overlap and the need for bounded
   setup draw ranges. Connectivity does not solve blending. Exact OIT/refraction,
   cloth physics, new framebuffer systems and per-frame triangle sorting are
   outside this proposal; stop if convincing depth requires them.

Choose B only if the matched views show recognizable continuous skin with broad
openings, legible curl in released color and justified cost. Choose A if it meets
that visual target more simply. If both fail, retain the released renderer and
report the smallest missing reference/technical decision to HQ. There is no
accepted architecture deviation to add to DECISIONS at this stage.

## Integration seams and protected contracts

- `geometry.ts` owns setup topology/descriptors and immutable ranges; `membrane.ts`
  owns shared CPU/GLSL deformation. Keep current body point, pigment attachment
  coordinates and independent membrane clock. No per-frame mesh rebuild/allocation.
- `membrane-optics.ts` currently inverts six specific carriers. B must replace
  that lookup with its actual opening/collar domain, shared with geometry; A must
  update the inverse if its carrier equation changes. Test both footprint and
  tangential-return correction. Do not leave obsolete six-sheet shadow stripes.
- `webgl.ts` currently assumes 21 floats per sheet vertex and six equal contiguous
  draw ranges. B requires explicit immutable topology/range metadata rather than
  reinterpreting those assumptions silently. Preserve actual front/back normals,
  premultiplied blending and matched position evaluation in color/depth passes.
- Retain quiet raised pigment, front/underside distinction, regional palette and
  common lighting. Add thickness/backface support only after a visible need is
  isolated; do not add outlines, bloom or saturation to conceal geometry.
- Input/reducer/provider facts, cancellation and commands remain authoritative
  outside the renderer. No changes to clocks, audio extraction, radius gain,
  pointer overlay, governor, saved controls, Canvas/static recovery or dependencies
  are proposed. Reduced Motion, zero Audio Reactivity and hidden suspension remain.

Current recorded budgets remain 9/9/10 draws, 12/24/64 particles and
1,275/4,615/18,135 body-plus-skin vertices. Recorded geometry arrays are
86,496/276,768/1,229,648 bytes with 384 High contact-uniform bytes; these are
source/evidence budgets, not new resident-memory measurements. No cap is expanded.

## Evidence needed to complete Checkpoint A, then B/C

After explicit machine permission, capture the unchanged release renderer first,
then A/B with seed `0x5a17`, yaw 0/0.75/1.6 and curl samples 0/6/12 seconds.
Use the existing fixture convention `peelTravel = base + seconds * 0.3` for the
isolated geometry comparison and record the resulting phase values. These labels
are controlled fixture time, not a promise of the autonomous default wall-clock
rate. Match camera, framing, exposure, quality and all other frame fields.

Extend only isolated evidence tooling as needed: existing fixtures expose body-only,
membrane-only, neutral and full-color modes; explicit normal and encoded depth
views/attachment crops need to be made comparable. They are not product controls.
Preserve complete composition views so close-ups cannot conceal band/plate reading.

| Gate | Required evidence; not executed in this checkpoint |
| --- | --- |
| Geometry and motion | Matched full/body/skin/neutral/normal/depth views, attachment close-ups, ordinary adjacent frames and wrap-neighbor values/derivatives. Connected-component, edge-incidence, boundary-loop, triangle-area/winding and deformed-normal checks for B. Existing derivative-magnitude tests alone do not prove those topology properties. |
| Palette and optics | Current banks at 0/15/45/120/300 s; palette-only and transport-only rows; unchanged geometry/light clocks; legibility at all three yaws, normal color and both sides of folds. Identity III's old-palette images are historical references only. |
| Behavior and recovery | Idle/listening/thinking/speaking/interruption/recovery; ordinary and emphasized synthetic envelopes; exact zero reactivity, Reduced Motion, hidden/resumed clock, cancellation/stream reset and stale owner/generation inputs. Preserve provider posture without routing changes. |
| Tiers and fallbacks | Same openings/identity at Low/Medium/High; actual resource counts/bytes and bounds; pointer ownership, governor, Canvas/static and context-loss recovery. No new fallback equivalence claim from static reading. |
| Focused checks | Geometry/material/continuity/behavior/input/motion/quality/governor and relevant provider-presentation regressions; changed-file lint, TypeScript and frontend build when permitted. No broad Python/native suite is required for a visual-only slice absent new evidence. |
| Performance | Corresponding baseline/candidate High at 720-square DPR1/2 and 960-square DPR1, plus tier/pose/state coverage; effective backing dimensions, device, warm-up, sample count and disjoint handling. GPU median/p95 separate from CPU submission; no presented-FPS, thermal or inference-coexistence claim. |

Record successes, failed views, ambiguity and cost before selecting/integrating.
No new timings, test passes or visual improvement are claimed here. Existing
Identity III timings predate the released palette and are not a matching baseline.

## Closure and next authorized step

This source-only checkpoint adds this assessment, the baseline manifest and links
from STATE/BACKLOG. Production geometry, optics, motion, behavior, resources and
versions are unchanged. Read-only Git review, saved-image inspection and manifest
hashing are the only new evidence. No green visual candidate or v0.2.6 readiness.

Resume **this assignment**, not a new programme: obtain task-specific
`MACHINE-FREE: YES`, generate the matched release/A/B proof, then close Checkpoint A
with a representation decision. Checkpoints B/C follow only a defensible choice.
Full Sam, providers/models, capture/playback and intrusive visible sessions remain
excluded even then. No remote operation, version bump, publication or human beta.
