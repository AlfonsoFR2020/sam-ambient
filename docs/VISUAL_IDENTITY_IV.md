# Visual Identity IV — connected living skin

**V-F3 feature-branch correction (2026-10-23):** the owner rejects the panel/island/
casing reading in V-F2's images. [Positive organic peeling](ORGANIC_PEEL_VF3.md)
is a separately selectable experiment in the same engine, with three broad-rooted
lobes rather than another complete coat containing windows. This IV parent remains
the numerical/default baseline, not an artistically accepted final shape. Historical
IV evidence remains intact; successful pigmentation is preserved.

**V-F2 feature-branch evidence (2026-10-23):** [matched software WebGL2 proof](RADIAL_SHELL_PROOF_VF2.md)
executes the actual parent/radial shaders in selected full-colour/diagnostic poses.
It preserves this parent as default and the released living pigment. Less rolled
experimental rims are visible, but casing character/Low corners and whole-motion,
hardware and owner acceptance remain open. The historical unexecuted checkpoints
below are not current blanket claims that no shader has ever run.

**V-F1 feature-branch amendment (2026-10-23):** [appearance foundation](ORB_APPEARANCE_VF1.md)
retains this parent skin as the default and numerical compatibility baseline, while
adding an internally selected connected radial-sector prototype. This does not reject
or graphically accept IV-B; shader execution, optical comparison and owner acceptance
remain open. Historical evidence and the original assessment manifest are unchanged.

**IV-D integration amendment (2026-10-21):** [current evidence](INTEGRATION_VALIDATION_IVD.md)
records 290 frontend / 223 scoped Python passes, canonical compiled assets with
source/asset fingerprints, partial renderer setup/disposal repair and additional
compact-pose/normal/descriptor proofs. No browser, GLSL, GPU or capture ran.
HQ4 confirms October 21's Start Sam beta displayed v0.2.5; its attractive swirls
and old-peel criticism do not accept IV-B. Preserve the palette and radial-sector
shell criterion. The IV-B/IV-C paragraphs below retain their historical build and
permission boundaries; IV-D supersedes the unbuilt-assets status.

2026-10-21. **IV-B is source-complete; graphical quality remains unverified.**
During IV-B, quiet-PC permission excluded all execution. [IV-C](RESPONSIVE_PRESENCE_IVC.md)
subsequently authorized short sequential non-graphical checks: topology, membrane,
contact, resource, continuity and mock-resource tests pass. A bounded TypeScript
analysis also passes after new test typing repairs. No GLSL execution, graphical
capture, GPU measurement, full build or visual acceptance is implied. Shipped
JS/CSS still select the released renderer; only HTML translation opt-out was added.

The sections below preserve IV-B's original source-only checkpoint. Their deferred
execution statements are historical; IV-C's linked evidence records subsequent checks.

## Provenance and provisional decision

Started on clean local `dev` at `b1f775b6c3532debdf0946f384f575b14ca12b86`.
The published baseline is `dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`.
The original source assessment is retained in commit `b1f775b`; its
[baseline manifest](evidence/visual-identity-IV/baseline-manifest.json) remains
unchanged. That snapshot's no-implementation/stop rule was superseded explicitly
by IV-B's permission to implement before graphical comparison.

Provisionally choose **Candidate B**, one connected spherical parent skin with
three unequal irregular openings. The six old independent, similarly tilted
long carriers have been removed from WebGL. Source diagnosis and preserved
[II isolated views](evidence/visual-identity-II/membrane-comparison.png) and
[III optical views](evidence/visual-identity-III/optical-comparison.png) support
addressing coverage rather than another width/opacity sweep. They do not prove
the candidate is attractive. Those images predate the released regional palette;
[later film/palette evidence](evidence/living-palette/film-across-colors.png) is
also historical, not a new candidate comparison. No missing reference is invented.

The original concept board remains unrecovered. Assumptions now embodied in
source are three broad unequal openings, substantial opaque resting coating and
satin rolled rims. Their locations/sizes/collars live in one descriptor function
and can be revised after comparison. No permanent second engine, theme, settings
migration, dependency or version change is introduced.

## Representation, attachment and motion

[skin-domain.ts](../ui/src/visual-engine/skin-domain.ts) defines six oriented
cube-sphere charts and three smooth star-shaped disk boundaries. Centers are
offset, radii unequal and rims use fixed seeded second/third angular harmonics.
The cube is only a parameterization: material still samples normalized spherical
object directions, not cube UVs. Conservative collar bounds stay inside charts.

[skin-geometry.ts](../ui/src/visual-engine/skin-geometry.ts) builds structured
annuli from an opening rim to each chart's square edge. Closed charts end in a
center fan, not collapsed zero-area quads. Shared chart-edge vertices are welded
before indexing; six ranges partition **one connected mesh**, not six overlays.
The intended topology is a sphere minus three disks: Euler characteristic -1,
three boundary loops, one connected component. All tiers use the same descriptors
and topology. Setup guards bound sampling and Uint16 indices. The topology tests
are authored, not executed, so these properties remain to be verified numerically.

[membrane.ts](../ui/src/visual-engine/membrane.ts) reuses the current displaced
body point and membrane clock. Collar coordinate q runs from resting hinge (0)
to free rim (1). Lift is quadratic and roll cubic at attachment, so relative
position and first derivatives vanish at q=0. Local seeded harmonic flex and a
broad lobe vary around each rim; existing receptive/work/output/recovery inputs
modulate this same law. No new oscillator, radius gain or semantic/audio signal.

Curl return follows the spherical gradient of the **irregular** boundary rather
than a radial ray from the opening center. CPU and GLSL contain matching gradient,
offset and full-surface normal equations. Symmetric tangent samples include body
displacement, coating clearance and collar/curl variation. The map continues just
past the free boundary for derivative samples; actual mesh vertices stop at it.
Integer angular/time harmonics preserve both rim and wrapped-clock continuity.

Motion, Surface Flow, palette/light/particle clocks, input freshness, cancellation,
zero Audio Reactivity, Reduced Motion and hidden suspension owners are unchanged.
Skin consumes the existing MotionFrame, not a second event or control pipeline.
Immutable geometry/ranges/descriptors are created at setup; none rebuild per frame.

## Material, contact and depth

[webgl.ts](../ui/src/visual-engine/webgl.ts) now consumes one three-float direction
attribute instead of the old 21-float sheet layout. Resting coating is opaque;
rim alpha softens toward approximately 0.7, preserving the existing premultiplied
blend and quieter raised pigment/front/underside satin/backlight hierarchy. Shared
field, asymmetric transports, regional banks, light/crest and particles remain.
Collar darkening is gated off at q=0 so it does not darken the entire resting skin.

Near-body physical clearance is Low 0.016 / Medium 0.008 / High 0.004 Orb units,
compensating for coarser chord approximation without changing audio radius gain.
Relative collar lift starts smoothly from this resting coat. This is a provisional
thin-coating strategy, **not** exact zero-gap welding, proven collision avoidance
or thickness/refraction. Tier transitions and worst-pose raster coverage need review.

Six immutable connected-chart ranges retain bounded center sorting. High retains
the existing alpha >=0.72 opaque-interior depth pass, invariant color/depth positions
and tiny prepass bias. Soft fringes remain approximate; chart sorting does not solve
within-chart curled self-overlap. Both sides render explicitly with culling disabled.
No texture, framebuffer, OIT, raymarcher, fluid/cloth solver or new draw pass.

[membrane-optics.ts](../ui/src/visual-engine/membrane-optics.ts) replaces the old
six-carrier inverse with actual opening/collar coordinates and the shared current
curl law. High uses bounded max ambient contact with an approximate tangential
correction; Low/Medium retain cheaper material cues. It is not a directional shadow.
Descriptor packing is shared with proof fixtures (four vec4 arrays, three openings).
Shader compilation/link failure now retires its program and successful shader
objects; ordinary disposal and Canvas/static recovery remain in their existing owners.

## Source resource calculation — not measured GPU cost

Let N be samples per chart side and R radial intervals. For this exact layout:
`skin vertices = 24*N*R - 1`; `skin triangles = 4*N*(12*R - 3)`.
Each skin vertex is 12 bytes and each triangle six index bytes.

| Tier | N / R | Skin vertices | Body + skin vertices / triangles | Geometry bytes including particles, excluding halo |
| --- | --- | ---: | ---: | ---: |
| Low | 6 / 4 | 575 | 1,136 / 2,040 | 32,988 |
| Medium | 12 / 8 | 2,303 | 5,004 / 9,504 | 150,252 |
| High | 24 / 16 | 9,215 | 17,600 / 34,272 | 519,500 |

Add the unchanged 44-byte halo geometry. Opening descriptors are 192 bytes per
program; pose/phase/clearance/count another 32. Skin uses these at all tiers and
High body contact has a second copy: 224/224/448 added uniform bytes. These are
source layout calculations, not driver allocation/resident-memory measurements.

Draws remain **9/9/10**, particles **12/24/64**, programs four and geometry buffers
seven. High stays below 20,000 vertices and the 1.5 MiB envelope. Medium has more
vertices than released sheets (5,004 versus 4,615), but fewer bytes due to the
compact layout. No envelope expands. Pixel/DPR/FPS/profile/governor caps stay intact.
Full-surface normals and wider coating coverage can still increase shader/fill cost;
smaller buffers do not prove faster rendering or inference coexistence.

## Authored regression and graphical proof

- `visual-skin-topology.test.ts`: connected component, index ranges, finite points,
  triangle areas/outward rest winding, edge incidence/orientation, three exact
  boundary loops, Euler characteristic, immutable ranges, seed/welding and packing.
- `visual-membrane.test.ts` / `visual-membrane-optics.test.ts`: C1 hinge, real flex,
  wrapped rim/clock values and derivatives, extreme-cue bounds, finite full-surface
  normals, deformed triangles, actual footprint/gradient/contact, zero audio and
  independent/frozen membrane clock. These are pending assertions, not passed gates.
- Quality, continuity and shared-field/mock renderer tests were adapted to the
  new layout/ranges/resources. Existing input retirement, behavior, engine/fallback,
  governor, palette, settings and provider-presentation tests remain required.
- [IV fixture](../ui/tests/fixtures/visual-identity-IV.ts) authors **92 images per
  variant**: full/body/skin/neutral/normal/depth/attachment at yaw 0/0.75/1.6 and
  curl 0/6/12 s; matched attachment crop; palette versus transport at
  0/15/45/120/300 s; synthetic lifecycle/ordinary/emphasized/zero audio, reduced,
  hidden resume, adjacent frames and tiers. Geometry comparison uses the existing
  controlled `base.peelTravel + seconds*0.3` convention, not an autonomous rate claim.
- [GPU equation proof](../ui/tests/fixtures/skin-gpu-proof.ts) authors transform
  feedback comparison of production skin point/normal GLSL against CPU references
  at 192 controlled samples. Its body callback is an explicit test spheroid;
  it isolates coat equations and does not prove the real material/body shader.
- [IV browser cases](../ui/tests/browser/visual-identity-IV.spec.ts) also author
  matched isolated High GPU median/p95 and CPU submission cases at 720-square
  DPR1/2 and 960-square DPR1, 18 warmups and 24 samples, with backing size, device,
  timer availability/disjoint reporting. No cadence/thermal/full-app inference claim.

No new images, timing samples or successful automated checks exist for IV-B.
Historical evidence is unchanged. [Implementation record](evidence/visual-identity-IV/implementation-source.json)
records source hashes, resource arithmetic and execution status separately from
the immutable original baseline manifest.

## Static hardening and later verification

Source review covered descriptor/attribute packing, imports, CPU/GLSL constants,
index/range arithmetic and winding construction, uniforms and per-frame ownership,
shader/depth symmetry, cleanup/fallback, existing state/reset semantics and test
integration. Fixed the obsolete sheet APIs/assertions, resting-region darkening,
contact-only fixture override accidentally suppressing geometry, shader-failure
cleanup and irregular-rim curl direction. Git whitespace, local import/link
resolution and resource arithmetic are lightweight checks only; no type/test pass.

The source assessment/manifest is commit `b1f775b`; geometry/integration is
`637f903`, authored proof/regressions `f79eaf1`. The closing source-review/docs
commit follows them. All remain local on dev. No dependencies, owner settings,
nonvisual authority, versions or shipped assets change; no remote operations.

For a later explicitly machine-free pass, from repository root prepare the ignored
baseline with `python scripts/prepare_visual_iv_baseline.py --prepare` (local Git
objects and current identical harness only; no application launch). Then from `ui`:

1. Run changed-file Biome, TypeScript and focused visual unit regressions, plus the
   existing input/behavior/fallback/governor/palette/provider-presentation checks.
2. Run `playwright test --config playwright.visual-identity-IV.config.ts` and the
   existing relevant headless visual cases. Inspect failures before accepting
   captures; hashes/commit identity accompany the baseline/current harness.
3. Judge normal color and motion before extra tuning: broad connected-skin reading,
   limb smoothness, exposed-body areas, rest clearance, hinge/curl normals, depth
   holes and soft self-overlap. Report failed views as well as improvements.
4. Review corresponding isolated timings and tier transitions; rebuild frontend
   assets only after repairs and focused checks. Full Sam/inference/audio remains
   separately unauthorized. Human aesthetic acceptance is separate; no beta requested.

Known uncertainties are Low faceting/clearance, automatic-tier appearance changes,
soft curled self-overlap, coating visibility across hues, normal sampling cost,
and whether three openings feel organic rather than like an opened casing.
The missing board does not block source work; owner character judgments remain.
This is a technically testable **source candidate**, not a validated v0.2.6 release.
Complete the verification/repair of Assignment IV before any next Visual Core work.
