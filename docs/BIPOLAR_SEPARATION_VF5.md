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
