# Bipolar peel separation and optical coherence — V-F5

Experimental `feature/orb-appearance-foundation` starts at
`d9502927c4f01f27d3b889c4d37eea580dd4bde5`. Integration dev remains
`cc69bc2b90eac4068c929af4beb1bb95705b14af`; published v0.2.5 remains
`dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`. No default promotion or merge.

## Diagnosis and bounded correction

The [V-F4 record](BIPOLAR_PEEL_VF4.md) and all its negative images are retained.
Its final 76-input assets match source `62758e9`; remote quality 40076807632
and WebGL 40076807654 passed. Closure changes only tests/docs/evidence. The
earlier anchor failure was repaired; old Windows shutdown timeouts remain
unattributed. No graphical campaign is repeated just to audit closure.

The old centerline-crossing test did not establish surface clearance. A new
offline AABB sweep examines every indexed triangle, with full edge/face,
vertex/face and edge/edge distance tests. Shared indexed tessellation vertices
are legitimate adjacency; nonadjacent self intersections are tested. Local UV
neighbors are exempt only from *near-distance* warnings, not intersections.
Witnesses include surface/triangle IDs, all three UV coordinates and world points.
This is a diagnostic, never a frame-loop collision solver.

V-F4 reproduces actual triangle piercing in a controlled deformed body at idle,
loading, thinking, quiet/silent speech, interruption and compact/departure poses.
At Medium idle phase 0, 23 triangle pairs between peels 0 and 1 intersect;
the first witness is south peel 1 at t≈.50–.544, v≈.50–.75 against northern
peel 0 at t≈.711–.75, v≈−1 to −.75. High and silent-pose checks also reproduce
intersections. These are full surfaces, not camera-only centerline crossings.
This CPU body is controlled, not the entire production procedural body.

One analytic correction spreads the roots/trajectories around the sphere,
retains opposing north handedness, and gives the three lifted surfaces unequal
height lanes (.20/.44/.31 before the existing smooth shoulder). The south path
reaches the opposite hemisphere. Lift, longitudinal bend and transverse twist
now respond differently to measured speech and existing work/settling signals.
The C1 root, deterministic atlas, fixed setup arrays and material coordinates
remain. No new topology family, clock, audio inference or radius gain is added.

## Optical contract

V-F4 uses translucent alpha and sorts six ranges using undeformed centers.
That cannot correctly sort arbitrary interleaved surfaces. The bipolar strategy
now explicitly chooses `opaque-depth`: ordinary per-fragment depth and solid
coverage at **all** quality tiers. Six color ranges write depth with blending
disabled; High does not need the old extra membrane prepass. The normal particle
blend state is restored. No framebuffer, sorting framework, OIT or extra resource.

The shader retains an alpha in [.9999,1] to keep its shared emission/edge inputs
live; with blending disabled it behaves as a solid coating. Front/underside
lighting and the shared living pigment remain unchanged. This is a deliberate
experimental material-opacity change, not a claim of physically exact film
transmission. Root contact remains the existing actual-root ambient proxy;
it does not cast shadows between peels. Other strategies keep their old equations
and sorted film behavior; the default shader/geometry snapshot is unchanged.

Geometry stays at 399/999/3,723 skin vertices and 648/1,728/6,912 triangles.
Body-plus-skin vertices stay 960/3,700/12,108. Geometry including ordinary
particles stays 28,284/118,188/386,204 bytes, plus the same halo/descriptors.
Bipolar draws are 9/9/9 instead of 9/9/10; ordinary parent remains 9/9/10.
Particles stay 12/24/64. The extra work-twist series adds one bounded analytic
sin/cos evaluation per surface evaluation (five evaluations including normals).
Reduced draws or small buffers do not establish physical GPU cost.

## Evidence and verification boundary

The initial 45-second CPU diagnostic was stopped at its bound. Narrowing local
self-near queries before the exact phase made the complete selected-mesh checks
practical; a reduced initial sample then completed in 1.74 seconds. The stopped
operation is not a passing test. Broad-phase behavior is independently compared
with exhaustive pairs on a small deterministic triangle fixture.

Local structural tests include all three qualities, controlled deformed-body
poses, roots/free edges, strict normal alignment, wraps, continuous-sequence
body clearance, differentiated late quiet-speech bend/twist, cancellation,
zero gain, Reduced Motion, hidden retirement, default snapshots and cleanup.
The selected-mesh clearance guard is .025×radius/1.18 world units between peels;
it is a finite mesh/pose guard, not a universal continuous collision guarantee.

Hosted verification is **pending at this source checkpoint**. It reuses the
existing isolated sandboxed one-worker workflow, strict position <.0001 and
normal <.005 guards, and matches the archived V-F4 *actual* WebGL pixels by exact
frame equality. No fabricated old rendering. Separate transform feedback samples
every vertex from the actual production body/skin shader, including two frozen
V-F4 geometry diagnoses. The old-geometry diagnostic's current optical pixels
are discarded; only archived original images serve as the optical baseline.

Final run identities, images, actual production-surface results, limitations,
source/build correspondence and closure checks will be recorded below. No
attractive appearance, physical GPU performance, acoustic timing or owner
acceptance is inferred from the current CPU results. `living-connected` remains
the ordinary default; no UI, speech infrastructure, palette or particle change.

## First actual production proof and image inspection

[Hosted run 40225722161](https://github.com/AlfonsoFR2020/sam-ambient/actions/runs/40225722161)
at `2a088a8621528d0c20f6bad8068bd08e617bad6f` passes on its first attempt:
73 new WebGL2 views, 26 archived exact-frame comparisons, no console/GL errors.
The sandboxed Ubuntu 22.04 runner uses Chromium 153.0.8010.12 / ANGLE Vulkan
SwiftShader/Subzero, 720×720/DPR 1. The actual production shader's every mesh
vertex is sampled at 47 candidate poses/views; no unintended intersections or
inter-peel clearance violations occur. Frozen V-F4 equations/descriptors on the
same real production body reproduce **45** intersecting High triangle pairs at
idle (0/1), and **50 + 44** at silent speech (0/1 and 0/2). These counts differ
from the controlled Medium CPU fixture because tier/body/pose differ.

| Controlled-body strict GPU proof | Samples | Max position | Max normal |
| --- | --- | --- | --- |
| Parent | 192 | .0000231639765 | .000504075252 |
| Corrected bipolar ordinary | 240 | .0000006207471 | .000286957726 |
| Corrected compact/loading | 240 | .0000003015555 | .000293642792 |
| Corrected speaking/settling | 240 | .0000006115724 | .000286957726 |

All remain under .0001/.005; the proof is not weakened. Actual production-body
sampling is distinct from the controlled-body CPU/GPU equation comparison.
The [first comparison](evidence/orb-vf5/40225722161/comparison.png),
[negative south view](evidence/orb-vf5/40225722161/polar-south-bipolar-peel-experimental.png)
and [raw inputs/proofs](evidence/orb-vf5/40225722161/evidence.json) are retained.

Actual image inspection shows clearer separated silhouettes and no blended
cross-through in the selected corrected views. Spread polar trajectories cover
more sides. However, the south view still reads as belts/cut panels, and tall
narrow tips read as blades. The rich pigment persists, but solidity alone does
not establish graceful orange-peel curvature or convincing Escher-like weaving.
The ordered 320ms samples show continued movement through late quiet speech,
silence and resumption; naturalness remains provisional, not an acoustic or owner
acceptance claim. **No geometry promotion.** One structural correction is retained;
no fourth morphology or speculative color adjustment follows.

A final fixture-only hardening adds matched crossing pixel crops and a causal
optical ablation: reverse all six color ranges, require identical solid-depth
pixels, and compare the old blended treatment with the High prepass explicitly
disabled. That ablation uses corrected geometry, not recreated V-F4 optics.
Its final hosted result is pending; production source/assets remain unchanged.

The first standard [CI 40225722164](https://github.com/AlfonsoFR2020/sam-ambient/actions/runs/40225722164)
is green without retries: Ubuntu 817 Python / 44 skips, Windows 856 / 5 skips,
429 frontend cases per platform, lint/types/build and existing package jobs.
Overlapping platform/local batches are not summed. No local browser, GPU, Sam,
provider or audio execution; no physical performance or inference-coexistence claim.

## Final optical proof and retained comparison package

[Final hosted run 40226839968](https://github.com/AlfonsoFR2020/sam-ambient/actions/runs/40226839968)
at `33b0d89ff7b2a5ab37823f9942b191bd7ee3d4e8` passes on its first attempt.
It repeats the 73 matched/state/sequence views and strict four equation proofs,
adds eight optical-ablation renders, and retains two production-body diagnoses of
frozen V-F4 geometry. All 47 corrected sampled surfaces still pass the full indexed
triangle/clearance guard. No GL/console errors or test failures. These are sampled
surfaces/views, not 47 distinct poses or a continuous-time collision theorem.

| Range-order experiment | Yaw 0 | Yaw 1.6 |
| --- | --- | --- |
| Corrected solid-depth forward vs reversed ranges | PNG bytes identical | PNG bytes identical |
| Corrected geometry with legacy blended film, High prepass deliberately off | Different rendered PNGs | Identical; no order defect exposed here |

The exact deterministic PNG equality proves the solid result is independent of
these two range orders. The yaw-0 legacy difference demonstrates why whole-range
ordering is insufficient; the yaw-1.6 negative finding is preserved. No claim that
every angle fails, or that the ablation recreates exact V-F4 High optics. All **76**
previous PNGs match the first run byte-for-byte. All eleven ordinary parent static
PNGs also match the old V-F4 captures byte-for-byte, independently of shader hashes.
The attempted optional local decoded-pixel inspection found no Pillow; nothing
was installed and no rasterization/graphical tool was launched. The hosted PNG
comparison is the actual executed optical guard.

Exact final paths under `docs/evidence/orb-vf5/40226839968/`:

- [Compact matched comparison](evidence/orb-vf5/40226839968/comparison.png),
  [crossing close-ups](evidence/orb-vf5/40226839968/crossing-details.png).
  Crops use the same 400×480 source-pixel rectangle; no retouching or generated pixels.
- [Full-colour yaw 0](evidence/orb-vf5/40226839968/colour-yaw0-phase0-bipolar-peel-experimental.png),
  [yaw 1.6 / phase 12](evidence/orb-vf5/40226839968/colour-yaw1.6-phase12-bipolar-peel-experimental.png).
- [North](evidence/orb-vf5/40226839968/polar-north-bipolar-peel-experimental.png),
  [negative south view](evidence/orb-vf5/40226839968/polar-south-bipolar-peel-experimental.png),
  [silhouette](evidence/orb-vf5/40226839968/silhouette-bipolar-peel-experimental.png),
  [neutral](evidence/orb-vf5/40226839968/neutral-bipolar-peel-experimental.png),
  [attachment](evidence/orb-vf5/40226839968/attachment-bipolar-peel-experimental.png),
  [normals](evidence/orb-vf5/40226839968/normals-bipolar-peel-experimental.png),
  [depth](evidence/orb-vf5/40226839968/depth-bipolar-peel-experimental.png),
  [compact Low](evidence/orb-vf5/40226839968/compact-low-bipolar-peel-experimental.png).
- [Matched expression sheet](evidence/orb-vf5/40226839968/expression-comparison.png),
  [ordered late-speech/silence/resumption strip](evidence/orb-vf5/40226839968/ordered-motion.png).
  All 36 corrected lifecycle/ordered-sequence full-resolution PNGs are retained.
- [Draw-order-sensitive film, yaw 0](evidence/orb-vf5/40226839968/optical-yaw0-film-forward-bipolar-peel-experimental.png),
  [reversed](evidence/orb-vf5/40226839968/optical-yaw0-film-reverse-bipolar-peel-experimental.png),
  [solid forward](evidence/orb-vf5/40226839968/optical-yaw0-solid-forward-bipolar-peel-experimental.png),
  [solid reversed](evidence/orb-vf5/40226839968/optical-yaw0-solid-reverse-bipolar-peel-experimental.png).
  The corresponding four yaw-1.6 files preserve the negative ordering finding.
- [Raw final metadata](evidence/orb-vf5/40226839968/evidence.json): every input/frame,
  renderer, actual-surface witness, proof and optical comparison. The final subset
  retains 63 files; original V-F4 pixels remain at their existing paths, not relabelled.

Provisional visual assessment after inspecting both sheets and full-resolution
colour, normals, south-polar, quiet-speech and optical views: separation is clearer,
transparent crossing artifacts are reduced, and the successful pigment survives.
The south-polar belts/cut panels, blade-like tall ends and insufficiently organic
root/tip transition still prevent selecting this design. Reduced translucency is
an explicit aesthetic tradeoff. Remaining projected overlaps in these *sampled*
frames are not detected triangle collisions; they may still read poorly. Continued
late quiet-speech movement is visible, but the strip does not establish pleasing
natural embodiment or physical speech alignment. **Keep experimental, no dev merge
or default promotion.** No additional speculative morphology is started.

The remaining structural limitation is the retained spherical centerline/geodesic
cross-section with a common longitudinal shoulder and finite .035 distal half-width.
Separating these offset strips removes penetration but does not create independently
sculpted root/end curvature. As an inference from source and the polar/side views,
foreshortened sections still read as cut bands, while the larger south lift makes
the narrow distal region blade-like. Opacity cannot correct that silhouette. This
is an identified limitation within the existing family, not justification to start
another morphology, add glow or silently sacrifice the measured clearance.

## Final regression, assets and execution audit

Local final-source checks: **71 distinct frontend cases / nine files**, **27 scoped
Python file/asset/register cases**, 16-file Biome check and project TypeScript pass.
A 26-case adjacent rerun follows the final fixture hardening; it overlaps the 71
and is not added. The last documentation-only changes receive affected file-only
checks again. [Named checks](evidence/orb-vf5/verification.json),
[controlled surfaces](evidence/orb-vf5/controlled-clearance.json),
[frozen-baseline audit](evidence/orb-vf5/baseline-integrity.json) and
[artifact inventory](evidence/orb-vf5/integrity.json) preserve scope and hashes.
The frozen copy matches d950292's actual source after relocating imports and
formatter whitespace/one optional import comma; no equation drift or missing patch.

[Final standard CI 40226840062](https://github.com/AlfonsoFR2020/sam-ambient/actions/runs/40226840062)
is green without retries: Ubuntu 817 Python / 44 skips, Windows 856 / 5 skips,
429 frontend cases each, lint/types/build and the existing hosted package gates.
Platform/batch overlaps are not summed. Earlier V-F3 Windows shutdown timeouts
remain unattributed; these green runs are not a causal fix. The initial local
lint-authoring findings were repaired before the build; the bounded 45-second
CPU attempt and formatting-only first baseline-audit rejection are not successes.
Git's restricted index access and the first artifact-download 401 were retried
using existing authorized access; no abandoned index operation or missing file.

Canonical clean production source `de87e526e0cc3675cb75ecf872b1911fabb33eb8`,
76 inputs, LF digest `6403c9fbeb376b649a0888712fb32a18450a6df2d1dd89f3ba8dbee7d1fac3c7`,
JS `index-DnQAp2-a.js`, unchanged CSS `index-D-dPdcI6.css`;
[exact manifest](evidence/orb-vf5/frontend-assets.json). Build `tsc -b && vite build`
completed below normal priority in 5.02 seconds; Vite reported 874 ms. These are
build times, not rendering performance. Later changes are fixtures/docs/evidence,
not production inputs; the current assets still match. The ordinary private static
asset path and `living-connected` default remain. No stale earlier bundle remains
in the current static directory; earlier identity/evidence remains in Git.

Commits: `de87e52` source/diagnostic foundation; `2a088a8` canonical assets;
`33b0d89` first retained proof and optical fixture hardening; closing local commit
contains only final evidence/docs. Only the authorized experimental feature was
pushed, including its reviewed previously local V-F4 closure. No branch merge,
public-docs/UI/speech/palette/particle/version/dependency change. The current
feature and other worktrees are checked independently at closure; dev/main stay
cc69bc2/dc64c5d. All 66 requirement IDs, eleven styles, priorities and STATE's
200-line bound remain. The closing evidence/docs commit stays local to avoid
another redundant hosted campaign; tested runtime/fixtures are at pushed 33b0d89.

No GPU timer, CPU-submission timing, physical GPU/inference coexistence, thermal,
real app/provider/audio or human beta was measured. Technical separation/layering
is ready for engineering review; the candidate is **not ready as the selected
visual integration**. A later separately authorized step must address the retained
belt/blade/root-tip artistic reading and hardware cost without discarding this
recoverable separation proof or the successful living pigment.
