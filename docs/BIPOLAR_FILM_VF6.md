# Rounded bipolar boundaries and thin transmission — V-F6

2026-10-26. Experimental `feature/orb-appearance-foundation` starts at
`3c35fe9dc1abf4c534f6c231e5820fc6be333753`. Dev stays `cc69bc2`;
published v0.2.5 stays `dc64c5d`. No default promotion, merge or release.

## Starting audit

[V-F5](BIPOLAR_SEPARATION_VF5.md)'s closing commit changes only documentation and
evidence, not production, fixtures or assets. Its 76-input bundle still matches
clean source `de87e52`, JS `index-DnQAp2-a.js`, CSS `index-D-dPdcI6.css`.
Current remote feature is `33b0d89`; final CI 40226840062 and WebGL 40226839968
remain green. All 71 inventoried V-F5 evidence blobs verify. The local-only
closing commit hides no unverified production change. [Audit](evidence/orb-vf6/baseline-audit.json).

The actual logo is `sam-logo.png`; its curved, broad counter-sweeping boundaries
inform the refinement without inventing the missing concept board. The owner
rejects V-F5's angular blade/belt ends and pale opaque material. Its negative
south-polar and colour images remain intact.

## Boundary and cross-section

Keep the same three unequal north/south trajectories, descriptors, lift lanes,
C1 attachment shoulder, body foundation and motion equations. The new internal
`bipolar-film-experimental` is a refinement of the same `bipolar-peels` family,
not a new representation or owner theme. V-F5 remains selectable and unchanged.

`bipolar-film.ts` uses a C1 longitudinal half-width:

`width / .31 * (.055 + .23*smoothstep(0,.35,u) - .16*smoothstep(.65,1,u))`.

The distal half-width stays approximately .117–.129 radians instead of .035;
no width function collapses into a blade tip. The rectangle ends at u=.9. Its
free boundary is the half ellipse `u=.9+.1*cos(theta), v=sin(theta)`, with theta
from −pi/2 to pi/2. The cap tangents join the side boundaries continuously.
This rounds the actual mesh boundary; it does not warp the deformation's t by v
or introduce square-root derivatives into the shader.

An immutable polar half-disk tessellation shares its entire diameter with the
last strip row, including its center. There are no duplicated endpoint vertices
or degenerate triangles. The first attempted construction reused one corner for
every cap row; its thin fans failed the unchanged .8 face/normal alignment guard
(Medium .7655, High .6523 at compact speech). It was rejected before rendering.
Sharing distinct diameter vertices resolves the issue without loosening a guard.

The smooth point map remains defined in ordinary atlas u/v beyond the cut, so
complete-map finite differences use the same .003 step at every cap point.
Material directions use the refined cross-section before the shared body
displacement/pigment sampling. Shallow outward cupping (.08 × current lift × v²)
shares the existing C1 root and speech/lifecycle response. No new clock, radius
gain, dynamic mesh, solver or independent displacement system.

## Optical technique and limitations

`nearest-transmission` primes the existing depth buffer with every covered peel
fragment, after the body is rendered. The color pass uses **EQUAL** depth, no
depth writes and ordinary premultiplied blending. Identical invariant vertex
positions and no polygon offset select one nearest surface independent of six
range order. Depth/color masks, LESS depth testing and particle blending are
restored. All tiers use the same identity; no new framebuffer, texture or program.

`bipolar-film-optics.ts` samples the same pigment once, without the old veil,
contrast compression or desaturation. Center-to-grazing opacity and restrained
Fresnel-like reflection, smoother lifted normals, existing orbital lights and
distinct underside response make a bounded thin-film approximation. Attached
regions stay substantially opaque to retain body/film continuity. No blur pass,
bloom, thick outline, random highlight or alternative palette is introduced.

Only the nearest film layer transmits the already shaded body. Farther peels do
not cumulatively attenuate it; there is no physical refraction, environment map,
multilayer absorption, cast inter-peel shadow or exact linear-light transport.
Particle depth follows the selected surface, preserving the established policy.
Those limitations must not be described as physically correct glass.

The parent, radial, organic and V-F5 opaque paths retain their previous shaders
and pipeline. New rendering is explicit internal selection only. Canvas/static,
quality governor, settings and all nonvisual authority remain unchanged.

## Source resource calculation

| Tier | Skin vertices / triangles | Body + skin vertices | Geometry bytes including ordinary particles |
| --- | --- | --- | --- |
| Low | 444 / 738 | 1,005 | 29,364 |
| Medium | 1,083 / 1,896 | 3,784 | 120,204 |
| High | 4,083 / 7,632 | 12,468 | 394,844 |

Existing halo 44 bytes and descriptor uniforms 224 / 224 / 448 bytes remain.
Four programs and seven buffers, no new vertex attribute. The candidate uses
10/10/10 draws, one more than V-F5's 9/9/9, because the nearest pass is one
aggregate indexed draw. Parent stays 9/9/10. Particle caps stay 12/24/64.
The extra pass repeats skin vertex work; memory/draw counts do not prove physical
GPU or inference-coexistence acceptability. No new dependency or OS change.

## Verification and graphical plan

At this source checkpoint, 95 distinct local frontend cases pass in eleven files,
with TypeScript and focused Biome checks. All old V-F5 clearance poses/qualities
remain under the same .025 × radius/1.18 guard. All deformed triangles retain
the .8 normal-alignment / 1e-8 area guards. Widths, cap tangents, topology,
finite coordinates, resources and immutable setup are checked. The existing
24-second trusted synthetic delivery, zero gain, Reduced Motion, hidden retirement
and stale-event tests now exercise both V-F5 and V-F6, preserving every old case.
[Controlled clearance](evidence/orb-vf6/controlled-clearance.json).

Hosted proof is pending at this checkpoint. The unchanged strict position .0001
and normal .005 limits retain every old sample and append cap/width-shoulder
coordinates: 468 samples per refined pose, versus V-F5's 240. Actual production
shader vertex feedback independently checks full indexed-surface clearance.

Matched evidence uses seed 0x5a17 and the existing V-F5 frames/cameras/material
clocks/lights. Archived actual V-F5 pixels are matched by exact frame equality;
fresh parent and selected fresh V-F5 images must remain byte-identical.
Reversing triangle submission and color ranges must preserve actual decoded RGBA.
A body-color probe intersects visible-film/body masks and measures only underlying
body response, with a V-F5 opaque-material ablation on the same new geometry.
This avoids mistaking exposed-body changes or a faded film tint for transmission.

Full-resolution static, south-polar, side, neutral, attachment, normal/depth and
compact Low views, material ablation, enlarged details and the continuous synthetic
quiet/pause/resumption sequence are required. Final run IDs, builds, failures,
negative views and acceptance limitations follow after execution. No local
browser, WebGL/GPU, Sam, model/provider or physical audio is authorized or run.
