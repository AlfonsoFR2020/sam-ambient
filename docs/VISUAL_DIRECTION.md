# Sam Orb visual direction

Status: **artistic and systems direction for continuing visual stages**, not a
description of all current renderer behavior. [Visual Engine v1](VISUAL_ENGINE_V1.md)
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

The broad structures must visibly circulate over seconds in ordinary use; changing
phase values without perceptible migration is insufficient. Preserve coherent forms
as they travel, without a frozen skin or boiling detail. Manual rotation should feel
like grasping one material body. If time evolution competes with that impression,
reduce or hold its *rate* while the pointer owns the Orb and ease the rate back after
release; never reset the phases or change coordinate space at that boundary. Keep
autonomous rotation and surface flow conceptually separable even if today's Motion
control drives both. A future dedicated flow control should be calibrated around
the accepted idle equilibrium; an Auto setting needs a real control signal.

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
Within this warm identity, hue relationships, saturation and tonal balance should
shift slowly enough to feel like one living organism rather than cycle through fixed
red/cyan/yellow/orange placements or flicker through rainbow noise.

The current small-scale ovoid and mountain/valley relief has naturalistic appeal.
Retain bounded relief while comparing subtler and stronger expressions; neither a
perfect sphere nor exaggerated terrain is a decided target.

### Living-field substrate and constraints

Use a **procedural 3D object-space field carried by two broad spherical
shears**. The present UV mesh remains geometry only; never use longitude/latitude
to address the material. For each normalized, unrotated object direction `n`,
let two fixed nonparallel unit axes be approximately
`a1 = normalize(.4,.8,.3)` and `a2 = normalize(-.7,.2,.6)`. For each axis in order:

```text
mu_i = dot(a_i, q_previous)
f(mu,q) = (1-mu*mu)*(1+0.35*mu)*(1+0.42*dot(otherAxis,q))
theta_i = phi_i + twist_i*f(mu_i,q_previous)
q_i = rotate_about_axis(q_previous, a_i, -theta_i)
q_0 = n; q = normalize(q_2)
```

`phi_i` advance at `+.14` and `-.09` rad/s before the Motion control's default
0.6 scale. `twist_i = A_i*sin(psi_i)` uses `A_i = +.78, -.56` rad and `psi_i`
rates `+.19, -.13` rad/s; seeded phase offsets keep the default seed's shear
active immediately. Compute `sin(psi_i)` once per frame, not per fragment.
Wrap each phase modulo `2*pi`; rotations stay continuous at the wrap. The old
uniform-angle terms mostly transported the pattern as a rigid image, while its
small shear began near zero with the default seed. The companion-axis profile
adds broad, asymmetric deformation as regions travel. It remains smooth across
the whole sphere, though the exact analytic inverse of the prior axisymmetric
latitude shear is no longer assumed. No grid simulation or growing history is needed.
Use one shared deterministic seed for fixed noise offsets, not per-frame random
values. These are bounded starting parameters for visual acceptance. The
existing Motion control scales the phase rates. A material-specific rate gate
reduces flow toward 12% while the pointer holds the Orb (0.14 s easing) and
returns it toward normal after release (0.8 s easing). Integrate that gate over
elapsed time; do not accumulate hidden phase or catch up after release. Breathing,
whole-Orb rotation and particle orbits continue independently. A future persisted
Surface Flow control can scale this internal rate without changing the field shader;
an Auto speed would require a real signal and is not claimed here.

Sample one specified, self-contained **3D simplex gradient noise** function at
two scales from this same `q`:

```text
B = sat(.5 + .5*N3(1.8*q + seedOffset1))   // broad density
M = sat(.5 + .5*N3(3.6*q + seedOffset2))   // medium folds
balance = .68 + .07*sin(palettePhase)
contrast = 1 + .14*sin(paletteContrastPhase)
palette = sat(.5 + (balance*B + (1-balance)*M - .5)*contrast)
coolBoundary = .12*(contrast-1) + .10*(balance-.68)
cool = .94*(1-smoothstep(.29+coolBoundary,.57+coolBoundary,B))
       *smoothstep(.39-coolBoundary,.63-coolBoundary,M)
activity = smoothstep(.20,.50,abs(B-M))
```

The offsets are fixed, independent vectors derived once from the existing test
seed. `palettePhase` and `paletteContrastPhase` have separate `.027` and `.016`
rad/s base clocks before the high-level Motion scale. They change the relation
and local boundaries of broad and medium warm regions, not the hue of the entire
Orb. A warm linear-light palette maps `palette` through
red/copper, orange and gold. `cool` gates a localized pink-to-violet/blue/teal
accent instead of a global rainbow gradient; the default should remain
predominantly warm. Those
palette stops and the cool-region fraction need human review, but hue placement
must depend on `B`, `M` and `q` at every quality tier. Optional samples at
`7.2*q` and `14.4*q` may modulate luminance/roughness only, with amplitudes at
most `.06` and `.025`; dropping them must not move the main colour boundaries.
Expose the reusable field vocabulary as object direction `n`, transported `q`,
`B`, `M`, palette coordinate, local activity and future excitation. Materials
derive final RGB, alpha and specular response from that vocabulary.

The body uses the same `B` for small geometry variation:

```text
d_field = .012*(B-.5) + .006*sin(breathPhase)*(1+.2*(B-.5))
d_total = clamp(d_field + existing_v1_audio_displacement, -.04, .04)
position_object = diag(1,1.06,1) * n * (stateRadius + d_total)
```

The spatial breath is therefore a deformation of the body, not canvas scaling.
At vertices, evaluate the displaced position at `n` and two small, oriented
tangent offsets; their cross product gives an outward normal after spheroid
scaling. This costs three broad-field evaluations per vertex and avoids noisy
per-fragment normal resampling. Interpolate unrotated `n` to fragments, normalize
it and resample `B/M` there for colour. Broad illumination, inner warmth,
specular/glints and the existing bounded Fresnel rim use that material plus
normals. Apply the existing object orientation (including user quaternion drag)
*after* field sampling; keep analytic light positions in world/view space. Drag
therefore changes which moving currents catch the slowly orbiting lights, and
the day/night impression arises from light/material geometry rather than a
four-state palette animation. Preserve v1 tone, extent and no-flash bounds.

The primary light travels in world/view space across the visible limb rather
than remaining in a nearly front-facing arc. Its phase retains the independent
`.086` rad/s base clock before Motion scaling (about two minutes at the default
Motion setting). Medium/high add low-weight fill lights instead of equally strong
keys, while the material keeps a stable ambient floor. This addresses the old
front-biased trajectory and multi-light flattening without moving the material
coordinates. Isolated fixed-body WebGL pixels show a spatial lighting change;
human perception and representative-device contrast remain unverified.

The shared GLSL field chunk is used by body and the WebGL membrane fragments.
Both sample the same `n` and identical transported `q/B/M`; the membrane adds
separate lift, soft edges and material response. Sparse particles may sample `B/activity`
at their object directions in the vertex shader. Keep four draws, depth order,
WebGL2 and Canvas/static fallback. The field and four phases must be owned above
the replaceable backend: the engine-owned evaluator/phase clock supplies both
renderers and survives quality changes and context recreation. Hidden/stopped/reduced-motion rules
freeze spatial phase according to v1; no catch-up work is queued on return.

The post-release surface pass addresses a remaining perceptual weakness: broad
and medium pigment previously used exactly the same transported direction, so
their combined boundaries could keep a stable-looking relationship even when
pixel differences were measurable. Medium pigment now samples a modest
phase-driven relative fold of that direction; the two shear phases evolve more
strongly while rigid rotation rates stay unchanged. The body and membrane keep
one shared field, two mandatory noise samples, seed determinism, pointer-hold
attenuation and a separate slow palette clock. A coarse front-hemisphere
contrast metric changes over seconds and stays continuous across a frame; it
cannot establish human visual acceptance.

Low/`mobile_2020` evaluates the two mandatory noise scales and one light at the
existing low mesh, DPR and cadence caps. Balanced may add one fine sample and
the existing medium light/mesh/pixel caps; high may add the second fine sample
and the existing high caps. Two rotations (four per-fragment sine/cosine results)
and the two mandatory noise calls dominate base fragment ALU; extra noise calls
and pixel count dominate rich tiers. Vertex normal sampling is secondary to
fragment work. Keep these counts compile-time bounded, with no textures, CPU
simulation or per-frame allocations. On overload, shed optional detail and DPR
before the shared `B/M` structure; recover only with existing hysteresis. A
future trusted workload hint may cap optional detail during local model work,
but frame pacing alone cannot identify prefill or prove spare VRAM. Canvas should
reuse the palette/phase grammar with a cheaper broad approximation, not CPU
per-pixel noise. An [isolated Windows desktop WebGL2 sample](VISUAL_PERFORMANCE_0.2.3_DEV.md)
measured low/medium/high GPU draw medians around 0.045/0.179/1.815 ms after
the post-release visual changes. Full-app contention, sustained cost, fallback
appearance and `mobile_2020` still require representative measurement before
acceptance.

Reserve an engine-local, zero-default `FieldForcing` with six finite `[0,1]`
components: `inputEnergy`, `outputEnergy`, `lowWave`, `midDrive`, `highDetail`
and `onset`. The motion evaluator may later supply two compact uniform vectors
to the shared field and materials; Stage 1 does not extract new audio, send new
protocol fields or change `VisualInputV1`. Stage 3 maps newest correlated
features into *rates* of the existing phases, twist strength, radial wave and
light/activity, never assigns a new phase. It must drop stale observations and
clear cancelled output by generation identity. A future shell reads the same
forcing through the shared field rather than receiving separate animation
commands.

Rejected baselines: scrolling longitude/latitude imagery has seam/pole and
rotation artifacts; noise animated only by changing a time coordinate boils
instead of carrying persistent currents; iterative fluid grids, feedback passes
and 3D raymarching compete with conversation and exceed the v1 resource model.
The existing analytic bands remain a low-cost fallback and comparison fixture.
If a standard simplex implementation is copied, verify its compatible license
and update `THIRD_PARTY.md`; the MIT-licensed
[webgl-noise source](https://github.com/stegu/webgl-noise) is a candidate, not a
dependency or code incorporated by this decision.

### Outer membrane and peels

The WebGL membrane now consists of seeded curved patches with broad irregular
boundaries. A fixed interleaved distribution keeps existing patches in place
when quality adds more. Each patch inherits the body's radius, bounded relief,
orientation and object-space field, then lifts most at its center and approaches
the body at its feathered edge. Near-opaque fragments write depth, reducing
the crossing order ambiguity of the old translucent ribbons. Curvature-sensitive
normals and restrained specular response let moving light reveal separation.
This remains one membrane draw, without per-frame geometry rebuilds, sorting or
extra field noise. The physical v0.2.3 beta saw faint hard-edged polygons rather
than a lifted skin. Source inspection found only 24 high-tier edge samples and a
68% triangle-face normal contribution in the membrane shader; the 96×48 body
mesh alone has subpixel chord error at normal desktop size. The post-release
form pass raises high-tier membrane samples to 40, slightly raises central
lift, shades with a smooth dome-derived normal and feathers alpha per fragment.
Low/medium/high keep 6/11/16 fragments and now 16/20/40 perimeter samples.
High membrane geometry grows from 1,168 to 1,936 vertices; draw count and
field samples are unchanged. Fixed-camera WebGL coverage and shader checks pass,
while the human faceting/membrane observation remains open for later acceptance.

The remaining visual question is whether patches read as one loosened outer
layer rather than individual plates. If not, a connected thin shell with a
few broad openings remains a candidate. Openings should have moderately curved,
irregular boundaries without tiny islands or regular bands. Later activity and
audio can modulate each fragment's lift. The current autonomous phase gives
each only a small continuous lift variation. The v1 loxodromic carriers remain
the Canvas fallback and comparison baseline. A full translucent shell, multiple
layers or refraction needs representative GPU and alpha-order measurements
before adoption.

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

The renderer-only AmbientReactivity accepts existing input/output envelopes and
the reported input peak. The input adapter validates, correlates and ages source
samples; this visual layer alone owns response attack/release, with a 50 ms
integration cap and a zero neutral state. Output RMS receives a compressed
speech-range mapping, a slow baseline and a fast emphasis pulse (35 ms attack,
110 ms release). Its pulse expands the body and raises illumination/highlight;
input RMS has a separate, smaller receptive tension and rim/opening response.
The existing Audio reactivity control scales both, including an exact zero.
Sustained/onset still provide bounded particle perturbations: at most +0.14 Orb
units of spread, +30% orbit rate, and +26% opacity. No new speech/semantic
inference or audio extractor is involved. Later richer waveform, frequency and
semantic channels require real upstream evidence and timing tests.
Suspending the visual clock clears held visual energy; resume uses only fresh
reported input and does not advance orbital phases for the hidden interval.

## Richness must use spare compute

The orbiting key must actually register as moving illumination, glints and a gentle
day/night depth change, with a believable ambient fill. Mathematical light presence
alone is not an acceptance criterion. WebGL particles now form a seeded near-biased
field with middle and sparse far paths, warm copper/gold variation, small shape and
opacity differences, independent orbit planes and slow radial wandering. Their
environmental frame does not rotate with pointer orientation; depth testing handles
body/membrane occlusion. Existing 12/24/40 counts and four draws remain, so richer
high-end populations still require measured spare compute. Canvas intentionally
retains no particles. Later activity may add restrained XYZ movement only from
timely audio/waveform evidence.

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

Core Experience Consolidation I confirmed ordinary RMS through the protocol
reducer into actual fixed-camera body expansion/illumination, with stronger emphasis
and preserved membrane/surface/particle checks. No new art or geometry was justified.
See [the acceptance matrix](CORE_EXPERIENCE_ACCEPTANCE.md): human naturalness/softness/
living-field acceptance and representative full-app/low-power cost remain open.

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
