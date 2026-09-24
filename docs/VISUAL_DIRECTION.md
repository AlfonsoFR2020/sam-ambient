# Sam Orb visual direction

Status: **future artistic and systems direction after v0.2.2**, not a description of
the current renderer or permission to implement it. [Visual Engine v1](VISUAL_ENGINE_V1.md)
defines today's renderer, data, interaction, accessibility and performance contract;
[State](STATE.md) records what has landed. This document gives later design work a
shared visual aim while leaving mathematical and performance choices open.

## A living object

Sam should feel like one living, organic orb rather than a sphere accompanied by
unrelated strips, particles and effects. Its references are atmospheric circulation,
planetary weather, convection, aurorae, liquid flow, cloud systems, breathing
membranes, glints on curved material and slow shifts of illumination. These are
analogies for motion and material, not a request for literal clouds, a planet texture,
an equalizer or a physics simulation. The object should retain Sam's recognizable
warm luminous center and substantial silhouette at small sizes.

The orb lives at silence. Broad colour currents drift around its curved surface;
smaller structure rides within them; restrained breathing changes its shape;
highlights and light direction migrate independently of object rotation. A very
slow warm/cool cycle could evoke dawn, day, dusk and night without using a clock or
turning the orb into four scenes. State and audio disturb this autonomous life;
they do not start it. Motion should remain phase continuous across every transition.

A generated Sam concept board is the **aspirational north star**, not an implemented
asset or proof that any effect is feasible. Its useful qualities are a rich fluid
spherical surface, coherent orange/red/pink/violet/blue/teal/gold currents,
translucent layered membranes, perceived depth from inner core through outer shell,
soft moving glints, sparse particles and related Idle, Listening, Speaking and
Interruption expressions. Its premium, elegant organic character matters more than
reproducing any particular pixel. The board is not stored in this repository; later
visual reviews need the actual reference image or an approved derivative. It may
eventually inform a logo/icon family, but the present `sam-logo.png` remains a
separate reference rather than a texture to animate.

The owner's ElevenLabs reference contributes *conceptual* prompts: a generated
visual base coupled to live audio, WebGL, fluid motion, simplex noise, FBM, SDF
masks, feathered sound waves, subtle grain and an internal variant explorer. Its
appearance and implementation are not Sam's specification. Do not copy its design,
code or assets; verify licenses and attribution before using any external source.

## One field, several expressions

The preferred organizing idea is a small, deterministic, time evolving field on
the orb, sampled by its body and membrane. Its direction, colour and energy should
be coherent in object or spherical coordinates, so rotating the object does not
reveal a flat image sliding over a mesh. Broad currents can advect nested detail;
light follows evolving geometry; the membrane inherits the same local colour and
flow; sparse particles appear where the shared energetic state warrants them.
Audio and conversational state alter a compact set of common parameters rather
than independently switching decorative effects.

Possible field ingredients include low order analytic flow, seeded simplex or
curl-like noise, a few FBM octaves, gentle domain warping, spherical/object-space
sampling, SDF-like masks, analytic diffuse/specular/Fresnel response and bounded
surface displacement. These are candidates, not a mandate to combine all of them.
Noise must remain coherent across the sphere's seam and poles, stable in time and
cheap enough at `mobile_2020`. A few large structures should carry the image;
fine noise, film grain and micro-detail are optional accents. Highlights should
follow the same deformed normals and material depth rather than sliding as an
unrelated overlay. Internal glow, body and outer membrane may use different
material responses without becoming disconnected layers.

The existing amber/copper/gold palette is Sam's implemented identity and the safe
baseline. The concept board's wider warm-to-cool circulation is a promising
**experimental palette extension**: warm dominance could coexist with restrained
violet, blue and teal passages if legibility, tone bounds and visual acceptance
support it. It does not silently replace v1's bounded warm themes. A broad palette
shift, true translucency or extra rendering pass needs a later contract decision;
the current Canvas/static fallbacks still need a recognizable Sam.

### Outer membrane and peels

The preferred future peel image is a thin spherical outer membrane, slightly
outside the body, with broad irregular openings. Imagine several soft cone-like
or sector-like volumes pointing approximately outward from the orb's centre.
Where each volume intersects the shell, the shell becomes invisible; surviving
curved shell fragments read as peels from the same organism. This is a conceptual
construction, not a demand for 3D boolean geometry. A mask on a thin shell may
achieve the appearance much more cheaply. Openings should be few and broad, with
moderately curved sides and softly irregular boundaries; avoid tiny detached
islands, perfectly circular holes and jittering edges.

A candidate sector has a centre direction, angular radius and a few boundary
controls. Smoothly moving those controls changes the opening without rebuilding
mesh topology. In active states its effective origin could shift slightly in XYZ,
altering the projected shell intersection and making the opening migrate through
the orb. Any such shift must stay bounded and continuous. Along surviving edges,
subtle lift, curvature, finite thickness or translucency can separate the shell
from the body. The membrane samples the body's flow and colour field while using
a somewhat stronger rim response, different reflectivity or softened opacity.
Its silhouette remains elegant and connected to the sphere.

Several cheap representations deserve a measured comparison before selection:

| Candidate | Useful property | Main uncertainty |
| --- | --- | --- |
| Angular cap mask with smooth angular samples | Few parameters, stable shell mesh and smooth feathering | Repeated caps can look circular or regular. |
| Low order Fourier perturbation of sector radius | Compact analytic irregular boundary, easy continuous phase | Harmonics can ripple, alias or form small islands. |
| Short spline/Bézier boundary controls | Art-directable broad bends and asymmetric openings | Control interpolation, seams and intersections need care. |
| Existing loxodromic carriers | Already implemented, batched, cheap and useful for Canvas fallback | Thin ribbon silhouette does not by itself read as a shell. |

These can be hybridized: a few masked shell openings for the broad silhouette and
the existing carriers for limited edge highlights or low-cost fallback. The v1
loxodromic peels remain the implemented geometry and a valid comparison baseline,
not discarded history. A full translucent shell, multiple layers or refraction
should not be assumed affordable: depth, blending, overdraw and fallback behaviour
must be checked against the current four-draw and memory envelope before changing
it. The engineering pass should settle masks, mesh continuity, edge treatment,
occlusion and deterministic seeding with representative mobile and desktop views.

## One continuous conversational body

The [VisualInput v1 contract](VISUAL_ENGINE_V1.md#3-one-provider-neutral-visual-input)
remains the source of authoritative interaction and independent input/output audio
features. Stages below are parameter targets of one system, not scene swaps. Both
listening and speaking may be true at once; availability and reasoning cues remain
orthogonal to foreground state. The renderer observes these signals and never
decides whether speech, an interruption or a turn is credible.

| Stage | Expression within the shared field |
| --- | --- |
| Idle / quiescent | Slow circulation, restrained breathing, long lighting cycles, soft glints and nearly dormant sparse particles. |
| Listening / input active | A receptive, perhaps cooler or more focused field; currents can converge or organize around input energy with little latency, without merely brightening everything. |
| Transcribing | Captured motion briefly tightens or settles; it suggests consolidation without a spinner or new scene. |
| Thinking / inference | Deeper, slower, inward structure remains alive while visual cost yields to model prefill and inference. |
| Speaking / output active | Played audio excites coherent flow, ripples, peel lift, light and sparse particles in the rhythm of Sam's actual voice. |
| Interrupted | One quick bounded local ripple, shell shift or heartbeat-like disturbance keyed to a confirmed interruption, never a chaotic or red flash. |
| Resuming / recovery | Disturbed parameters ease back into phase-continuous life; old output energy cannot replay. |

Existing v1 state targets, opening values, phase continuity, duplex cues,
starting/degraded/reconnecting/stopped overlays and reduced-motion rules remain
the engineering baseline. The new language above describes an artistic evolution,
not revised constants. Reduced motion must retain distinct static state geometry,
accessible text and subdued changes without breathing, orbits or travelling audio
displacement. Pointer/touch quaternion rotation and damped inertia remain useful
direct manipulation, subordinate to controls and transcript hit regions.

### Audio as a timely disturbance

The orb should show what the user is putting in and what Sam is actually playing
out, with separate, correlated input/output channels. The existing envelope-only
path must remain complete when richer measurements are absent. Candidate inexpensive
features are RMS/envelope, peak, activity, low/mid/high energy and onset/transient;
cheap pitch/voicing or waveform descriptors need evidence of useful expression
before inclusion. Preserve v1's phase-insensitive autocorrelation shape vector as
a legitimate baseline; small Fourier/DCT or directional modes are alternatives to
compare, not replacements by declaration. No emotion or intent should be inferred
from loudness.

Features should drive a few shared parameters: field speed and direction, broad
deformation, membrane lift, illumination, narrow palette migration, particle
visibility and bounded ripple impulse. A plausible receptive input disturbance
may converge where output radiates, while both still influence the same field.
The existing bounded `max(E_out, 0.55 * E_in)` global composition is a comparison
baseline; separate channels must stay visible in duplex use. The feature pipeline
is one latest compact state at the actual capture/playback boundaries, not raw PCM
in the UI or a queue of old visualization work. Drop superseded samples, interpolate
only toward current measurements, clear cancelled output by generation identity,
and measure end-to-end response latency. An immediate restrained response is more
valuable than a rich response arriving hundreds of milliseconds after a syllable.
Visual diagnostics may expose stale or frozen energy to a human but never acquire
VAD, STT, interruption or cancellation authority. Section 14 of v1 keeps the
detailed feature, expiry, privacy and mapping questions for a strong-model pass.

## Richness must use spare compute

Voice capture, STT, interruption, first model content, inference, UI response, TTS
and playback take priority. The current v1 caps, including `mobile_2020`, four
draws, bounded geometry/pixels, Canvas/static fallback, no per-frame React state,
seeded determinism and zero work when hidden, remain the acceptance envelope.
The conceptual field should first be convincing with few analytic operations,
low internal resolution, sparse particles and simple material response. Lower
tiers can reduce noise octaves, transparency complexity, sampling and update
cadence without losing the characteristic currents, membrane silhouette and
state readability. The original loxodromic or simpler Canvas peels can remain a
fallback if shell masking is too costly or unreliable.

With measured desktop GPU and memory headroom, richer field structure, finer
membrane geometry, more translucent depth, glints, particles and reflection or
refraction approximations become candidates. An excess-headroom/demo presentation
when no model is loaded is conceivable, but is not a new default quality tier or
promise of unlimited work. New passes, textures, offscreen simulation, raymarching
or true fluid dynamics would require explicit revision of v1's contract, measured
benefit and safe fallback. Efficient appearance from a few equations is preferred.

The current AUTO governor uses frame timing and hysteresis. A future governor
could also react to *measured* AI workload and resource pressure: temporarily
lower visual resolution or detail during model prefill/inference, then recover
gradually. It must not guess capacity from GPU names, thrash between qualities,
delay speech or make the orb appear to reset. Proposed workload signals and caps
need privacy-safe, low-rate integration outside the renderer. Measure p95 visual
cost together with first-token latency, inference throughput, audio continuity and
UI responsiveness on desktop and representative `mobile_2020` hardware; visual
frame rate alone is insufficient evidence.

## Orb Lab and design review

An eventual Orb Lab / Visual Explorer can render many deterministic variants as a
grid or contact sheet before scarce human acceptance. Hold seed, viewport, camera,
quality tier, state and synthetic input/output audio fixture fixed while comparing
field families, palette ranges, peel masks and material parameters. Include silent
idle, input, transcribing, thinking, played output, overlap, interruption, recovery,
reduced motion and Canvas/mobile fallbacks. Record timing and resource cost beside
the image; still frames alone cannot judge audio timing or motion quality. This
tooling should reuse the renderer's test clock and seeds, never require a model,
microphone or new production settings surface. Later visual regression assistance
can flag accidental change, while human review decides whether an image feels like
Sam. A coherent approved visual language might then guide logo/icon evolution.

## Five design stages

These are architectural dependencies, not a schedule or one release each. The
[Roadmap](ROADMAP.md) should split accepted work into frequent coherent 0.2.x/0.3.x
patches after a separate engineering design pass.

| Stage | User-visible gain and main dependency | Main risk; likely effort; visual acceptance |
| --- | --- | --- |
| 1. Living surface foundation | Coherent moving spherical currents, palette and light at silence; needs a bounded shared field and seam-safe object-space mapping. | Shader cost/aliasing; high-reasoning design then implementation-heavy; human visual review essential. |
| 2. Organic outer shell / peels | Broad connected membrane fragments instead of narrow ribbons; needs the shared field and a cheap continuous mask/edge representation. | Overdraw, geometry and fallback continuity; high-reasoning geometry choice then implementation-heavy; human silhouette review essential. |
| 3. Audio embodiment | Played and captured speech visibly disturb the same organism; needs small correlated latest-state features and timed mapping. | A/V lag or model/audio contention; high-reasoning signal/mapping review then focused implementation; human timing and visual review essential. |
| 4. Adaptive richness and polish | Better glints, particles, depth and high-end detail without losing low-end identity; needs measured cost and workload-aware caps. | GPU/VRAM competition and quality thrash; implementation-heavy with short high-reasoning performance review; human cross-tier acceptance essential. |
| 5. Visual tooling and refinement | Faster comparison and stable aesthetic decisions, then possible logo/icon coherence; needs deterministic fixtures, seeds and variant capture. | Misleading screenshots or brittle regression thresholds; moderate tooling effort plus human art direction; human selection essential. |

Before Stage 1 implementation, the later architecture pass should compare a few
complete field/mapping families and settle seam/pole behaviour, palette bounds,
the smallest useful feature set, shell mask representation, depth/blending cost,
fallback equivalence and workload signals. It should propose deterministic
fixtures and budgeted independently shippable slices. Preserve valuable older
alternatives as measured baselines until the new system earns its replacement.
