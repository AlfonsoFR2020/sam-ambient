# Organic peeling geometry and focused experience refinement — V-F3

Starting feature HEAD `653ca9261a79bc7308c93fc0fa262e87b1133733`; integration
dev remains `cc69bc2b90eac4068c929af4beb1bb95705b14af`. Published v0.2.5 is
`dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`. No default promotion or merge.

## Source checkpoint (graphical results pending)

The owner rejects V-F2's parent/radial morphology as flat, panel/island/casing-like.
That new artistic evidence does not reject the successful evolving pigment. The
repository `sam-logo.png` was inspected; the missing concept board remains unavailable.

Internal `organic-peel-experimental` adds three unequal, curved, tapered positive
lobes. Each is a gnomonic disk on the unchanged displaced body. A broad root rests
on that body; quadratic lift and cubic tangential bend start with zero first
derivative at the hinge. There is no circular rolled lip. Original unit directions
remain the shared pigment domain. Motion uses the existing membrane clock,
coherence and measured lift without new input authority.

This deliberately tests **three topological disks with broad body attachment**,
instead of another perforated complete coat. The common body provides material
continuity, but the film mesh is not globally connected. This consequential,
reversible interpretation is permitted by V-F3 and needs graphical/owner judgment.
Six draw ranges split the three lobes for existing sorting; descriptor sizes are
unchanged. No per-frame geometry work, extra program, framebuffer or draw is added.

`living-connected` remains the ordinary default. Default shader/geometry snapshots
pass; parent and radial remain internally selectable. No appearance preference,
palette change, radius-response gain or theme is introduced.

Particle experiments retain released 64 as baseline and compare near-field
64/128/256 with the same shader/draw. Smaller, softer, less distant motes use an
eight-bit radial distribution. No population increase is accepted on memory cost
alone; visible gains and hardware performance are separate gates.

Console/Memory share a presentation-only button/header component. Existing owner
capability commands, reviewed-Memory semantics, disabled states and close/focus
callbacks remain. CSS reduces the startup summary and unifies nonmodal panels;
required model choice and failures remain visible.

The existing sandboxed hosted workflow is reused for a bounded three-strategy
matrix, particle alternatives, numerical intermediate trace and synthetic UI
interaction. No local graphical execution is permitted or performed. Actual
results and final disposition follow after evidence, not from this source checkpoint.

## First actual comparison and evidence-led correction

[Run 40010281390](https://github.com/AlfonsoFR2020/sam-ambient/actions/runs/40010281390)
retains all 27 geometry views, four particle comparisons and four UI screenshots in
[its evidence directory](evidence/orb-vf3/40010281390). Four UI interaction tests pass;
the graphical test fails solely on the unchanged strict radial position guard.
Parent and positive-peel proofs pass (192 samples each); peels have max position
error .0000069374 and normal error .0001304003. All three render through WebGL2.

The new positive peel removes circular window rims and has clear lifted silhouette,
but its fronts are still rounded/leaf-like and several tips form an upright crown.
These negative images are retained. One bounded refinement lengthens/asymmetrically
curves the domains, reverses one peel's direction and varies the sweep. Low uses
six radial rows instead of four to support the longer curve. It remains a candidate,
not an accepted default; a second matched render must judge the result.

The actual shader trace at the old worst sample shows sin(1.7000000477) = .9914833307
instead of .9916648043 and cos = -.1288278699 instead of -.1288445416. Pair length
is .999817891. The fourth-power superellipse turns this nonunit pair into a
.0001162006 rim error, then .000581 collar error. The quarter-power's error at the
GPU's own input is only 2.47e-8. The [independent arithmetic record](evidence/orb-vf3/radial-precision-diagnosis.json)
also evaluates packed uniforms and explicit Float32 steps: ordinary rounding with
accurate trig does not explain the measured error. Uniform pair scaling predicts
the dominant rim shift. This identifies the redundant angle/trig reconstruction,
not the quarter-root or chart map, as the significant source on this renderer.

CPU/GLSL now use the normalized chart x/y directly for the rim base, derivative and
gradient. This is the same mathematical direction, without atan-to-sin/cos loss;
it is not a tolerance change or geometry clamp. Shape harmonics and all default
equations stay unchanged. A replay regression protects the measured sensitivity.
The strict .0001 position/.005 normal gates stay mandatory for the second run.

UI screenshots expose a concrete additional defect: an admitted loading snapshot
could display primary **Ready** while the secondary status said Loading. A focused
test first reproduces its missing primary label, then passes after existing lifecycle
labels are retained by the status projection. No readiness authority or state machine
changes. Narrow footer alignment is also corrected from the actual screenshot.

## Second proof and final bounded morphology correction

[Run 40011677649](https://github.com/AlfonsoFR2020/sam-ambient/actions/runs/40011677649)
passes all five browser tests. Its [30 matched views, particle and UI evidence](evidence/orb-vf3/40011677649)
retain the strict radial correction: maximum position error .0000052275, normal
.0002453279. The old fixed sample's q changes from 1.0005810261 to .9999954700
against CPU .9999999513. The parent proof is unchanged; positive peels also pass.
Tolerance, normals, seed and test body callback are unchanged.

The second images still show rounded front overlays and some projecting tips.
One final bounded correction replaces mainly radial inflation with a local
integrated peel arc. At the broad hinge, position and first derivative match the
spherical body. Beyond it, curvature becomes k/R (k approximately .68–.86), so
the surface bends outward while retaining longitudinal extent. It scales with the
existing nominal body radius, preventing disproportionate fixed-height compact ears.
No body radius gain or body deformation equation changes.

`SkinPose` gains an optional reference-only nominal `bodyRadius`, populated from
MotionFrame; the already-existing GPU `u_radius` supplies the same scale. Parent
and radial equations ignore the field and retain default snapshots. The body still
supplies all shared displacement. The arc uses cancellation-safe short-arc series
over |angle|<1.4: degree-10 cosine loss / degree-11 sine, independently checked
against integrated trigonometric arcs within 3e-7 world units. These fixed analytic
coefficients are not visual tuning or a cloth solver. Surface normals still sample
the complete deformed map. A malformed raw row count is now rejected before the
Low minimum-detail adjustment. Final source/graphical proof follows this correction.
