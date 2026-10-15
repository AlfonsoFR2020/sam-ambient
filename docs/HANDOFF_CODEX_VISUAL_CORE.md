# Sam Visual Core & Experience — v0.2.6+ continuity

**Implementation entry point, 2026-10-15.** Snapshot: released v0.2.5,
`dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`. Read
[HQ4 continuity](HANDOFF_SAM_HQ4.md) for release/security/governance and deferred
reliability work, then [STATE](STATE.md), [ROADMAP](ROADMAP.md) and local `AGENTS.md`.
This document records source facts and proposes the next assignment. It does not
authorize implementation, tests, rendering, application launch or remote changes.

## Product target and evidence boundary

The owner wants an organic, compelling, unmistakably layered living presence.
Skin should lift/peel as connected film rather than decorative wrapping straps.
Body, skin, pigment, light and particles should respond coherently to real listening,
processing and prosody. High should offer visible sophistication without disrupting
conversation. Rich regional color must evolve over appreciable time without random
rainbow noise or global hue rotation. These are **owner intentions**, not claims that
the current implementation satisfies them.

**Original concept board: missing/unrecovered.** Tracked assets contain `sam-logo.png`,
the September architecture illustration, icons and later comparison evidence. No
identifiable original board was recovered by repository inspection. Written
[visual direction](VISUAL_DIRECTION.md) and the October beta are authoritative;
the logo is a secondary reference, not a geometry specification or animated texture.
Do not invent unavailable reference imagery or silently replace Sam with a generic
glowing/plasma/noise sphere. Full historic HQ/Codex transcripts were not available.

The [October 9 triage](BETA_TRIAGE_2026-10-09.md) records polygonality/lumpiness,
dull restricted color, absent/angular peels and detached speech embodiment. It
predates Identity I–III and regional palette changes. It is neither acceptance of
today's code nor proof those later changes failed. Codex-observed later folds are
clearer but sometimes still band-like; **owner acceptance remains open**.
No image was newly rendered or human judgment acquired for this handoff.

## Evolution: preserve the reasons, not obsolete implementations

| Phase / Git landmark | What changed | Lesson / current disposition |
| --- | --- | --- |
| Early textured Orb / v1 | Luminous spheroid, analytic/rhumb-like narrow peel carriers, envelope/state targets, deterministic seeds and low-cost fallback | Current WebGL is no longer the narrow-strip geometry. Canvas deliberately remains simpler. Historical samples are comparison references. |
| Living Surface, post-v0.2.2 → v0.2.3 | Shared seam-safe object-space pigment, two shear transports, relative medium fold, independent lights/palette/particle clocks, seeded lifted dome patches | Avoid flat UV scrolling, whole-texture rotation and boiling-noise-only life. Shared body/film field and independent clocks remain. |
| Continuity repair `e48e0e5` | Fractional consumers of wrapped phase caused periodic snaps; harmonic consumers/independent phases repaired them | New periodic formulas must agree at wrap, including derivatives where relevant; elapsed-time determinism is not enough. |
| [Identity I](VISUAL_IDENTITY_I.md), `28ebb21` / `878dfb0` / `49e03d5` | Smooth zero-slope dome profile, radial sampling and irregular-boundary/body-consistent normals; less lift/relief, broader color regions and improved key depth | Body tessellation was not the only faceting source. Old dome center cusp/face-normal blend were real defects. More pixels changed did not make fragmented domes read as skin. |
| [Identity II](VISUAL_IDENTITY_II.md), `97ff884` / `0e7bff3` / `a3e77b5` | Six attached broad swept sheets with animated free-edge curl, immutable derivatives; sorted soft transparency; coherent posture/prosody; finer High and opaque-core depth prepass | Genuine geometric motion and stable attachment exist. Nine/ten draws replace four; current representation can still read as bands. |
| [Identity III](VISUAL_IDENTITY_III.md), `23b2bbc` / `bc91a03` | Quieter lifted pigment, front/underside satin/backlight/grazing cues, bounded High ambient contact; one crest shared by body/film/near particles | Camouflage is partly material hierarchy. Contact is approximate, not cast shadow/thickness/refraction; do not add outlines or merely raise opacity. |
| [Palette/readiness](LIVING_PALETTE_AND_READINESS.md), `d381947` / `9c5bce8` | Three locally evolving cyclic banks and particle tint; provider-preparation status and distinct Orb cues, reconnect last-known repair | Regional diversity now exists; do not restart the old fixed-orange/cyan palette task. Preparation must remain distinct from inference. |

Current source supersedes old fragment counts, four-draw caps, 512 KiB geometry
limits and fixed trichromatic maps in dated design sections. Preserve those sections
as history; use the source budgets and current amendments below.

## Current renderer map

All paths below are relative to repository root and link to the inspected source.

| Owner | Modules / responsibility |
| --- | --- |
| UI lifecycle and interaction | [AmbientScene](../ui/src/ambient/AmbientScene.tsx): mounts isolated engine, settings/state ingestion and pointer overlay. Canvas is pointer-transparent; `.ambient-scene__interaction` owns pointer capture. Controls/history retain their own hit regions. |
| Authoritative projection | [reducer](../ui/src/state/reducer.ts), [provider-lifecycle](../ui/src/provider-lifecycle.ts), [ProviderStatus](../ui/src/ProviderStatus.tsx): session/request/stale gates precede presentation. Labels and observed waiting are not invented progress. |
| Renderer-only input | [input](../ui/src/visual-engine/input.ts), [types](../ui/src/visual-engine/types.ts): typed `VisualInputV1`, independent input/output, lifecycle and provider cues; no turn/control authority. |
| Timing/response | [motion](../ui/src/visual-engine/motion.ts), [ambient-reactivity](../ui/src/visual-engine/ambient-reactivity.ts), [interaction](../ui/src/visual-engine/interaction.ts): phase integration, bounded posture/envelopes and quaternion/inertia. |
| Form | [geometry](../ui/src/visual-engine/geometry.ts), [membrane](../ui/src/visual-engine/membrane.ts), [living-material](../ui/src/visual-engine/living-material.ts): immutable spherical/sheet descriptors, shared body displacement, analytic curl and sampled normals. |
| Material/depth | [living-field](../ui/src/visual-engine/living-field.ts), [palette](../ui/src/visual-engine/palette.ts), [membrane-optics](../ui/src/visual-engine/membrane-optics.ts), [webgl](../ui/src/visual-engine/webgl.ts): CPU reference/shared GLSL and actual draw/compositing. |
| Surrounding field | [particles](../ui/src/visual-engine/particles.ts), [discourse-crest](../ui/src/visual-engine/discourse-crest.ts): seeded analytic paths and shared spatial response. |
| Resources/fallback | [engine](../ui/src/visual-engine/engine.ts), [quality](../ui/src/visual-engine/quality.ts), [governor](../ui/src/visual-engine/governor.ts), [canvas](../ui/src/visual-engine/canvas.ts), [settings](../ui/src/visual-engine/settings.ts): lifecycle, tier caps, adaptation and cheap fallback. |

### Body, normals and why “more polygons” is not the diagnosis

The indexed sphere is a spherical parameterization, **not** UV-mapped pigment.
`livingBodyPoint` applies shared object-space displacement then Y × 1.06. Relief is
`0.008*(broad-.5)`, local breathing `0.006*sin(breathPhase)*(1+.2*(broad-.5))`,
plus bounded older wave/ripple and receptive/discourse terms; total displacement
clamps to ±0.04. A separate global state/prosody radius is bounded 0.92–1.18.
Do not accidentally double-count those two breathing/radius contributions.

Normals are evaluated from symmetric tangent differences of the actual deformed
surface at ±0.006, including spheroid scale, then rotated with geometry. High adds
bounded screen-derivative fine satin normal perturbation; optional fine fields do
not move the main color boundaries. High body is 128×64 segments. Identity I found
the earlier 96×48 ideal-sphere chord already subpixel at ordinary sizes; faceting
also came from the dome cusp/sampling/shading. Distinguish silhouette, normal,
displacement and material contrast before changing tessellation or flattening form.

### Membrane geometry, attachment and actual motion

`createPeelDescriptors` creates the **same six sheets at every tier**, seeded
`0x5a17` by default, distributed over spherical centers. Each uses a long tangent
carrier and cross tangent, half-length 1.12–1.26 rad, half-width 0.28–0.35 rad,
curved carrier bend 0.17–0.24, lift 0.045–0.060 and curl radius 0.043–0.050.
Irregular width varies smoothly along the carrier. This elongated, independently
seeded coverage is a **source-backed reason to investigate** the band impression,
not proof of the owner's preferred replacement geometry.

Vertices store direction, `(u,v)`, lift/phase, spherical `du/dv`, curl/opacity and
side-vector derivatives (21 floats/vertex). Geometry is created at setup, not rebuilt
per frame. `u∈[-1,1]` runs longitudinally; `v∈[0,1]` goes from attached hinge to lip.
The lift/end factor `(1-u²)²` tapers the ends; at v=0 the hinge has zero offset.
A 0.002 gap smoothly appears away from the hinge. Curl uses a v³ roll, varying with
the existing membrane phase and bounded receptive/work/speech cues. Radial lift
and tangential return come from one shared CPU/GLSL law; radius caps at 0.068.
The compound body+film bound is **1.56**, not a second body-radius target.

The shader combines actual body displacement/normals, immutable carrier derivatives
and current curl derivatives. Shared pigment samples the attachment's spherical
coordinate so the same material continues onto the lifted film. Autonomous membrane
phase nominally advances at 0.5 × Motion rad/s, modulated by existing posture/drift,
activity and floor-holding factors. It is **real geometry flex**, not scrolling color.
Six separate sheets are not a connected manifold skin or simulated elastic film.

### Material/optical hierarchy and known depth limits

Body and film use the same broad/medium field and regional banks. Lifted film blends
medium density toward .5, compresses palette contrast/chroma and absorbs some diffuse
light; hinge remains continuous. Different front/underside satin roughness, actual
backlight and grazing response reveal curl. No bright outline or extra halo is used.
High inverse-carrier/contact lookup samples the same six descriptors/current curl,
with one tangential correction and capped **max** occlusion rather than accumulating
black overlap. Its 384 descriptor bytes are not a shadow map.

Opaque body writes depth. Six reused sheet index ranges sort by transformed center,
back-to-front; premultiplied color uses `ONE, ONE_MINUS_SRC_ALPHA`, soft color does
not write depth. High first primes depth only for sheet alpha ≥0.72, with invariant
positions/tiny positive bias, then blends against that depth; soft fringes remain
approximate. This fixes prior depth holes and improves near-opaque intersections,
but is **not** per-triangle sorting, exact OIT, directional cast shadows, physical
thickness, refraction or volumetric translucency. Curled self-overlap/inter-sheet
edges can still be ambiguous. Raised film is quieter than dense body pigment;
blindly adding color contrast can camouflage it again.

### Field, palette and independent clocks

Two asymmetrical spherical shears carry one deterministic 3D field without UV seam/
pole texture scrolling. Broad frequency 1.45 creates large territories; medium 3.6
has its own bounded relative fold; optional 7.2/14.4 detail affects luminance/roughness
only. The common field is shared, rather than independently animated body/film paint.
No fluid grid, feedback texture, CPU particle simulation or raymarched volume exists.

`MotionEvaluator` owns separately wrapped phases for spin, precession, breath, ripple,
key light, particles/orbit drift, material shear, palette pair and membrane. At unit
Motion rate: breath period 8.17 s; light .086 rad/s; particle orbit .18 and drift .051;
palette .027/.016; field transports .14/−.09 with independent shear phases. These
are base rates before settings/state factors, not fixed wall-clock output promises.
New formulas must not use fractional multiples of wrapped phase without a separate
continuous phase; preserve the earlier snap repair. Hidden/stopped suspension drops
wall time, clears held visual energy and resumes fresh without catching up a backlog.

**Motion speed** scales autonomous clocks; **Surface Flow** independently scales only
material transport/shear (bounded existing work/provider rate contribution included).
Pointer hold eases transport toward 12% with .14 s attack / .8 s release, never banks
hidden phase; quaternion drag/flick rotates the object independently. No renderer
event becomes microphone activity or model input. Particle environment does not rotate
with the manually rotated body.

`palette.ts` is the shared CPU/GPU authority for three four-anchor cyclic banks:
gold/red/blue/copper; blue/violet/emerald/teal; emerald/pink/gold/violet. C1 interpolation,
regional broad/medium offsets and separate clock rates evolve neighboring territories
differently; bounded local chroma/luminance also varies. This is not HSV rotation or
new per-frame randomness. Large regions survive optional tier detail. Palette time
is independent of Surface Flow. Canvas retains an economical warm gradient, not full
WebGL palette/material equivalence. Source defaults: intensity .82, Motion .6,
Surface Flow .6, Audio Reactivity .7, particle amount .6, glow .5, Reduced Motion system.
Legacy missing Flow inherits old Motion setting; do not reset saved preferences.

### Particles and spatial composition

Analytic seeded paths span radius 1.2–2.45, near-biased with a sparse far tail,
independent orbit planes and signed integer harmonics ±1/±2. Radial/vertical wander,
size and opacity vary; seeded visibility rank makes Particle amount choose a stable
fraction of the tier cap. Palette phases/banks provide coordinated temperature/hue.
The shared world-space speech crest reaches nearby particles with radius-dependent
phase, so spread/size/opacity respond locally instead of every point flashing.
Maximum measured spread contribution is .14 Orb units, orbit-rate boost .30 and
opacity boost .26. Body/High membrane depth occludes rear particles; Canvas has none.
These are visual signals, not simulated acoustic propagation or semantic understanding.

### Lifecycle, audio, cancellation and accessibility

`voice.level` derives from gained capture PCM; `tts.level` from post-volume synthesis
PCM **before output writes**. The latter is scheduled intended audio, not verified
speaker emission/acoustic delay. `input.ts` validates source sequence/session/generation,
keeps channels separate, starts age decay after 250 ms and removes at 1000 ms.
Retired generation/input and stream changes clear old energy. Current data is latest
compact state, not raw PCM or a frame queue in React.

`AmbientReactivity` alone owns visual attack/release: output compression and slow
baseline preserve ordinary syllables and stronger peaks, 35 ms attack /110 ms release
(70 ms interruption); separate input response 65/180 ms. Integration caps at 50 ms
with bounded substeps. No richer spectral/prosody extractor or inferred emotion is
claimed simply because optional type fields exist.

| State / signal | Current coordinated grammar | Boundary |
| --- | --- | --- |
| Idle | Quiet breathing, pigment transport, independent light/skin/particle life | No fake audio required to make Sam alive |
| Listening / measured input | Inward front tension, receptive curl/opening and localized light; actual input modulates smaller response | Front focus is illustrative, not microphone direction estimation |
| Transcribing / inference Thinking | Settling/consolidation; inward working posture, internal current light and modest material-rate increase | Existing real lifecycle cue, not semantic insight or new model signal |
| Speaking / output envelope | Coordinated bounded expansion, satin/crest light, skin flex and near-particle response | Synthetic peak radius ~1.115 is evidence, not a mandate to multiply expansion again |
| Interrupted / recovery | Fast bounded disturbance/release then continuous return; old output cannot replay | TurnManager decides interruption, never renderer |
| Discovery / loading / replacement | Quiet search then broad existing-ripple-clock circulation, distinct provider posture and text/elapsed wait | No fake Thinking, completion percentage, countdown or new polling |
| Unloading / ready / failure | Settling; one ready light cue decays with .65 s constant; calm recoverable failure | Repeated status/meter events cannot replay ready; disconnect retires cues |

Audio Reactivity **0 removes audio-driven modulation**, retaining autonomous life and
lifecycle/provider posture. Reduced Motion freezes spatial/autonomous/audio motion,
keeps bounded/static state distinctions and accessible labels, and omits ready pulse.
Starting/reconnecting/stopped availability freezes spatial motion and retires provider
illumination; a reconnected socket does not make stale last-known model data live.
Controls intensity/motion/Flow/reactivity/particles/reduced/fullscreen and Device
quality/profile remain normal owner surfaces, not Diagnostics-only settings.

## Fidelity, fallback and performance: current numbers, limited claims

| Source budget | Low | Medium | High |
| --- | ---: | ---: | ---: |
| Body segments | 32×16 | 72×36 | 128×64 |
| Six sheet samples, each | 16×6 | 28×10 | 64×24 |
| Body+sheet vertices / triangles | 1,275 / 2,112 | 4,615 / 8,400 | 18,135 / 34,560 |
| Immutable geometry bytes | 86,496 | 276,768 | 1,229,648 |
| Particles / lights / optional fine samples | 12 / 1 / 0 | 24 / 2 / 1 | 64 / 3 / 2 |
| Draws / opaque film depth prepass | 9 / no | 9 / no | 10 / yes |
| DPR / backing pixels | 1 / 1M | 1.5 / 2M | 2 / 3M |
| Idle / active cadence target | 24 / 30 | 30 / 60 | 30 / 60 |

Four programs/seven geometry buffers; no texture or framebuffer target added by
Identity II/III. High adds sampling, satin fine normals, opaque-core depth and local
contact, **not** a different palette or behavior. Low has no MSAA, fewer samples and
lights. `mobile_2020`/`low_power` cap at Low; explicit desktop AUTO starts Medium,
high_end starts High, otherwise conservative Low until measurement/profile resolution.
Effective DPR also obeys pixel cap. Automatic 5 s windows/hysteresis can change whole
budgets and eventually fall back; manual quality/profile still obeys caps. This is
frame/submission-based adaptation, not a GPU-memory or inference-workload governor.
WebGL loss/failure retains Canvas/static recovery; hidden rendering does no work.

The [v1 envelope](VISUAL_ENGINE_V1.md#8-performance-envelope-and-quality) targets
≤1.5 MiB geometry/uniform data, bounded render CPU heap/surfaces and no per-frame React
animation state. Those are design budgets, not measured total process/VRAM usage.
Revise a budget only for a demonstrated visible benefit and explicit documented choice.

Recorded RTX 3070 / Windows ANGLE-D3D11 isolated Identity III High GPU median/p95:
480² DPR1 .431/.543 ms; 720² DPR1 .798/1.540; 720² DPR2 2.057/2.842;
960² DPR1 1.038/1.296. Twelve non-disjoint samples/configuration; CPU submission
median .1 ms at coarse browser-clock precision. Earlier Identity I .046/.096/.161 ms
tier medians used simpler material/geometry and different scheduling; not a controlled
speed comparison or evidence that all remaining frame budget is free. Palette/readiness
adds ALU/uniforms but no new samples/draws; its final GPU cost was **not profiled**.

Historical October 8 default full-app headless inference sample: 101 submissions,
36.4 ms median /42.4 p95, no >100 ms gaps. It **predates** new visual work, measures
CPU/browser submission scheduling, not GPU or presented frames. Identity III's one
real attempt reached auth/Gemma/Quit, but a strict label selector failed before
inference/High/fullscreen sampling. The probe was repaired headlessly, not product
Controls. No current sustained full-app, low-power, thermal, visible speech-latency
or full VRAM acceptance follows. Do not relaunch Sam just to complete this handoff.

## Evidence to carry forward

- [Identity I comparison index](VISUAL_IDENTITY_I.md): cusp/normal diagnosis,
  before/after form and material, quiet/emphasis and tiers.
- [II membrane structure](evidence/visual-identity-II/membrane-comparison.png),
  [actual geometry flex](evidence/visual-identity-II/membrane-flex.gif),
  [depth comparison](evidence/visual-identity-II/depth-comparison.png).
- [III full-color/neutral/body-only](evidence/visual-identity-III/optical-comparison.png),
  [curl phases](evidence/visual-identity-III/curl-phases.png),
  [behavior](evidence/visual-identity-III/behavior-contact.png),
  [tiers](evidence/visual-identity-III/quality-contact.png),
  [machine measurements](evidence/visual-identity-III/measurements.json).
- [Palette development](evidence/living-palette/temporal-compositions.png):
  0/15/45/120/300 s with palette-only versus transport-only clocks;
  [film across hues](evidence/living-palette/film-across-colors.png),
  [provider postures](evidence/living-palette/provider-postures.png).

Existing fixtures: `ui/tests/fixtures/visual-identity-II.ts`,
`ui/playwright.visual-identity.config.ts`, browser Identity I/II/III and
`palette-lifecycle.spec.ts`. Unit protection includes `visual-membrane`,
`visual-membrane-optics`, `visual-living-field`, `visual-continuity`, `visual-palette`,
`visual-behavior`, `visual-discourse-crest`, `visual-input`, `visual-motion`,
`visual-ambient-reactivity`, `visual-quality`, `visual-governor`, plus
`provider-embodiment`, `provider-reliability`, lifecycle and settings tests.
These are future validation entry points, **not commands run or permitted now**.

## Visual requirements traceability

| Intended experience | Current implementation / evidence | Acceptance and gap | Priority / dependency / human need |
| --- | --- | --- | --- |
| One connected peeling skin | Six long hinged/curling sheets; III optical/neutral comparisons | Real flex/attachment protected; no connected topology and some band reading | **1**, reference/representation choice; owner connected-film judgment required |
| Organic smooth form | Shared displaced spheroid, symmetric normals; I/II form/tier evidence | Source defects repaired; lumpiness/softness not owner-accepted | Preserve; fix only demonstrated new representation artifacts, later human view |
| Moving folds with physical depth | Analytic curl, quiet film, High depth/contact | Center-sort/fringe/self-overlap approximate, no thickness/cast shadow | Part of 1; choose minimum optics after representation, human material judgment |
| Local expressive discourse | Fresh separate envelopes/state, crest/curl/particle grammar | Synthetic differences proven; physical timing/naturalness open | **2** after skin; existing signals only, later timed perception |
| Rich flowing pigment | Shared two-scale field and regional banks; 0–300 s rows | Temporal change/continuity proven, not appeal; film can be camouflaged | Preserve then **4**, connected film/lighting dependency; human harmony choice |
| Spatially coherent particles | Seeded near-biased field, bank tint and local crest | Existing owner particle feedback broadly positive; current composition unaccepted | Refine with 2/4 only, no new passes/count by default |
| High visibly worthwhile | Finer curves/satin/contact/64 points/depth pass | Controlled views improve detail; new full-app cost not established | **3**, chosen representation plus isolated budget, later representative permission |
| Responsive, accessible same identity | Tier caps/auto hysteresis/Canvas/static/reduced/zero | Deterministic protection exists, hardware breadth limited | Mandatory throughout; current source truth over old v1 budgets |
| Alternative identities | Owner requests smoke/cloud/fractal/paint/synthwave/HAL/dark/gold options later | No theme engine implemented or approved by this handoff | **Later**, after coherent accepted baseline; new separate design/owner selection |

## First Visual Core assignment

### Objective and bounded result

**“Connected peeling film — representation and optical proof.”** Deliver one substantial
improvement in how skin attaches, tears/opens and lifts, so representative normal-color
views read as a loosened outer layer rather than crossing straps. Retain the working
visual engine, shared field/palette, independent clocks, behavior and authority.
Do not begin another membrane geometry rewrite without showing why existing carrier
shape/coverage cannot meet the target. This is the first proposed assignment, not work
already authorized or a promise that a particular mesh is correct.

Use GPT-6 Sol **High**. Extra High, if available, is appropriate only for a bounded
topology/optical-depth decision, then return to a proportionate implementation effort.
Use two or three coherent boundaries: diagnosis/representation selection, implementation,
comparable evidence/closure. Do not multiply tiny checkpoints or accumulate a large
unreviewed visual system.

### Reference decision before irreversible art choices

Seek the original board or owner-approved example **through HQ**, not by fabricating it
or making Codex search personal folders. Clarify three concrete visual questions when
references become available: connected sheet with broad openings versus a few peeling
lobes; thin translucent film versus more opaque living skin; desired amount of exposed
body and curl. In its absence, the written connected-film intent supports a reversible
technical comparison, **not final artistic acceptance or an invented reference**.
If alternatives imply substantially different identity and cannot be selected from
written intent, stop with precise comparison/design evidence for HQ rather than tune
constants indefinitely. No additional human beta is automatically required now.

### Candidate approaches and tradeoffs

Evaluate at most two serious representations, plus released baseline:

1. **Retain swept-sheet machinery, change spatial organization.** Broaden/shorten selected
   footprints, use related attachment domains and asymmetric local free edges rather
   than six similarly long diagonal carriers. Preserve analytic curl/derivatives and
   immutable setup. Lowest engineering risk, but may merely produce wider straps or
   overlapping plates; stop if neutral silhouette still lacks connected-film reading.
2. **A shared parent skin domain with a few broad peel openings/lobes.** Derive attachment
   and lift masks from one sphere-domain topology, with C1 boundary/hinge derivatives
   and locally curling free regions. Reuse body point/field and current deformation
   clock. Better continuity potential; risks cuts/degenerate triangles, self-overlap,
   normals and transparency cost. Keep mesh generated once, finite indexed ranges,
   no tiny islands/regular wrapping bands or large simulation dependency.

Choose geometry/coverage from neutral/depth evidence **before** material tuning. Then
carry the existing quiet-film optical hierarchy and adapt High contact to the actual
new footprint, rather than leaving six-sheet contact shadows under different geometry.
Retain cheap Low/Medium cues. A bounded thickness/backface or contact solution may be
considered if visible benefit is demonstrated; exact OIT/refraction, fluid simulation,
new textures/framebuffers/passes or a new skin solver are not assumed necessary.
Any resource-envelope change needs an explicit decision, measurement and fallback.

### Preserve and validate

- Freeze baseline at v0.2.5/current clean commit; preserve before images and normalized
  source hashes. Same seed 0x5a17, framing, camera, exposure, quality and state.
  Compare yaw 0/.75/1.6 and curl 0/6/12 s; hold transport/palette/light/body clocks fixed
  when measuring geometry. Include full composition, body-only, neutral/isolate,
  normal/depth and attachment close views. Do not brighten “after” or move the camera.
- Prove actual geometry changes with phase and stable attachment/finite normals under
  extreme existing posture/audio combinations; no depth holes, detached fragments,
  flickering or phase-wrap seams. Test cancellation/stream reset and adjacent frames.
- Test the existing rich palette at 0/15/45/120/300 s separately from transport so film
  remains legible across hues. Do not redesign palette banks during this assignment.
- Carry idle/listening/thinking/speaking synthetic sequences, emphasis/ordinary speech,
  exact zero Audio Reactivity, Reduced Motion, hidden resume and stale owner inputs.
  Compare the entire composition; do not increase radius gain to disguise weak skin.
- Low/Medium/High must depict the same identity. Keep existing caps initially (9/9/10
  draws, 12/24/64 points, High <20k body+skin vertices /1.5 MiB geometry envelope).
  If a bounded revised representation exceeds a cap, document why the observed visual
  gain warrants it before expanding. Avoid per-frame mesh allocation/rebuild or React
  state. Protect Canvas/static fallbacks and pointer ownership.
- When explicitly permitted, use focused geometry/material/state/tier tests, TypeScript/
  Biome, headless actual shaders and frontend build. Capture isolated GPU median/p95 at
  e.g. 720² DPR1/2 and 960² DPR1, multiple poses/states; record effective backing size,
  device, samples, disjoint handling and CPU timing separately. Compare matching baseline.
  Do not convert these into full-app FPS/thermal/inference coexistence claims.
- No Sam/provider/audio/visible browser session unless separately authorized for that
  assignment. An occupied-machine restriction may prohibit even headless GPU/tests.
  Documentation/source inspection can proceed; do not silently skip a required validation
  and call the implementation green.

### Decision and stop criteria

Success requires legible lifted/attached regions in normal colored comparison views,
not just neutral geometry or changed-pixel percentages; recognizable continuous curl
over ordinary intervals; preserved smoothness/behavior/palette/fallback; and justified
cost. Codex visual judgment is provisional. Record which views fail as well as pass.
Owner's later acceptance decides attractiveness, connected-skin character and naturalness.

Stop at a coherent boundary if both bounded alternatives remain straps/plates, required
optics become an invasive transparency/physics subsystem, references imply a different
identity, safe rendering is unauthorized, or quota prevents proper validation. Report
the smallest missing reference/technical decision; do not improvise a new engine, relax
authority/accessibility, run repeated full Sam launches or continue unrelated work.

### Scope exclusions and closure

No STT/AEC, conversation/provider machinery, launcher, security upgrades, memory,
Agency/browser/workspace powers, persona editor, theme engine, native packaging or
version/publication work. Update only actual visual contracts/state/backlog/evidence.
Prefer a meaningful incremental visual alpha later if technically green and candidly
described; no automatic v0.2.6 release commitment or new human-beta request.

## Fresh Codex thread starter

Create a new task in the **existing Sam project**, local `dev`, titled
“Sam Visual Core & Experience — v0.2.6+”. Do not create an unrelated checkout or
silently archive/move old conversations. Suggested first message:

> Read AGENTS.md, docs/STATE.md, docs/HANDOFF_SAM_HQ4.md and
> docs/HANDOFF_CODEX_VISUAL_CORE.md, then the linked current visual contracts and
> evidence. Verify actual branch/HEAD/status before assuming the snapshot is current.
> Our first proposed task is “Connected peeling film — representation and optical
> proof” in the Visual Core handoff. Preserve released clocks, regional palette,
> behavior, authority and fallbacks. Do not start implementation or tests/rendering
> until this task's scope and occupied-machine permission are explicitly established.
> State the bounded plan and missing reference choices, then follow HQ's authorized
> brief. No remote operations, version bump or automatic next task.

HQ can then authorize that exact bounded implementation assignment with current machine
permission. This handoff itself ends after one local documentation commit.
