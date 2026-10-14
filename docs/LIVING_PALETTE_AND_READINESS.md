# Living palette and provider lifecycle presentation

2026-10-14, post-v0.2.4 dev. Starting bc91a03 was clean and already on origin/dev;
no preservation push was necessary. All changes below stay local, without a
version bump. Machine-use permission permits bounded offscreen validation only;
no Sam/provider/audio/visible window or human beta is used.

## Stage 1 — locally evolving composed harmonies

The previous map compressed a scalar palette coordinate into mostly gold/copper,
rose and cyan. Its two clocks changed balance/contrast, but the anchors stayed
fixed. Field transport therefore moved very similar colors indefinitely.

A small shared `palette.ts` now owns three four-anchor cyclic color banks and
one CPU/GPU composition grammar. They include gold/crimson/blue/copper,
blue/violet/emerald/teal, and emerald/rose/gold/violet. Adjacent anchors interpolate
with a C1 smoothstep, not a global HSV rotation. Broad/medium fields place coherent
territories; local field offsets and the two different existing clock rates
(.027/.016 radians per second at default Motion) give regions different evolution.
A small local chroma/luminance cycle supports the hue-family changes. No random
per-frame sampling, new noise evaluation or new clock is introduced.

Body and film share the grammar. Lifted-film contrast/chroma/diffuse attenuation,
attachment continuity, satin/backlight and High contact remain. Particles use the
same banks/clocks with seeded tint coordinates; counts/passes do not increase.
The field/geometry/independent transport, Low/Medium/High identity and Reduced
Motion freeze remain. Canvas fallback retains its deliberately cheap warm gradient.

The two phase values add one vec2 upload for each body, membrane and particle
program. Three small four-stop bank evaluations and bounded sine/interpolation
ALU replace the fixed-color map; no mesh, texture, framebuffer or draw is added.
No GPU timing/full-app performance claim is made in this desktop-safe pass.

## Temporal evidence

[Fixed-camera comparison](evidence/living-palette/temporal-compositions.png)
uses 480 square/DPR1, seed 0x5a17, yaw .75 and unchanged exposure/light/geometry/
curl. Columns are 0, 15, 45, 120, 300 seconds. Rows isolate:

1. Old body/membrane mapping from bc91a03, with existing balance/contrast clocks.
2. New palette clocks/mapping, with surface transport held still.
3. New mapping with palette held still, showing transport alone.

The baseline shader keeps the new phase uniform live using a sub-quantization
1e-8 term; particle coloring is current in every row. This is an isolated pigment
comparison, not an exact full historical binary screenshot. [Body versus quiet film](evidence/living-palette/film-across-colors.png) and
[identical-camera tiers](evidence/living-palette/palette-tiers.png) retain the same
geometry and phase. Folds remain recognizable to Codex in these limited views;
this is not an all-orientation perceptual acceptance claim.

The palette-only row visibly moves from gold/violet toward red/violet, blue/plum
and gold/green compositions. This is Codex inspection, not owner acceptance.
Central RGB mean change at 120 s is 36.64/255 versus old-map 0.25/255; at 300 s,
15.94 versus 2.96. Adjacent 20 ms palette-only mean change is 0.0024/255.
These establish temporal change and continuity, not beauty or perceptual scores.
[Measurements and normalized source hashes](evidence/living-palette/measurements.json).

Four new source tests cover bank/wrap continuity, different regional trajectories,
finite RGB/channel diversity, cadence independence, Surface Flow independence and
Reduced Motion. Existing field/geometry/ownership/reactivity gates are retained.
Stage gate: 116 focused visual checks, TypeScript, changed-file Biome and the
production frontend build pass. One small explicitly headless, sandboxed, muted comparison compiled the real shaders
and produced 23 frames; it never connects to a core/provider or opens a desktop UI.

## Stage 2 — provider preparation is visible and distinct

One pure frontend projection, `providerPresentation`, reads the existing reducer's
confirmed state. It provides discovery, connection/inventory retry, loading,
replacement, unloading, unloaded, ready, failure and stopped presentations. A
small persistent header block stays visible after the startup card is dismissed;
it names the requested model/provider where known, explains that loads may take
a minute or more, and reports elapsed waiting observed by this window. It never
reports percent complete, remaining time or a model as active before confirmation.

The timer is scoped by session/operation/phase/route identity, ticks once per second
only while busy, and is disposed on phase change/unmount. Meter events do not
restart it. The stable label is a polite live output; changing seconds are not
announced every second. Controls, diagnostics and Quit remain accessible. Rescan
keeps existing safe admission rules: available after terminal failure/success and
for inventory retry, disabled with an explicit reason during another live operation.
No new provider polling, command, routing, profile or permission system is introduced.

The reducer now retains a tiny **frontend-only confirmed-unloaded fact** from the
existing `provider.discovery: unloaded` event or startup snapshot. Labels do not
infer an unloaded outcome from provider reason prose. No wire format changes.

### Orb presentation

- Discovery/inventory connection: quiet field-search illumination.
- Loading/replacement: a broad circulating light pattern using the existing ripple
  clock, modest coherent posture and a bounded 15% material-rate contribution.
  It is separate from model inference's reasoning cue; no fake Thinking or audio.
- Unloading: restrained inward settling, coherent folds and slower existing drift.
- Confirmed ready after work: one small light transition decays with a 0.65 s time
  constant, returning to Idle. Repeated state/meter updates cannot replay it.
- Failure: calm ordinary posture as work illumination retires, with actionable text.

The first static comparison showed weak loading-light contrast; its one localized
crest was strengthened while leaving radius/speech gains and geometry unchanged.
[Postures including genuine Thinking state](evidence/living-palette/provider-postures.png)
and [loading circulation](evidence/living-palette/loading-circulation.png) hold color,
transport and camera fixed. The latter advances only the existing ripple phase.
These cues are deliberately subtler than the explicit status label; recognition
and appeal of the Orb alone remain unaccepted. No new oscillator or spinner.

Audio Reactivity zero suppresses audio only, not provider work. Reduced Motion
freezes autonomous clocks and uses bounded posture transitions; the ready pulse is
omitted. Disconnect/shutdown immediately retire provider illumination and any
confirmation pulse. New sessions do not inherit a ready transition.

### Reconnect regression and evidence

A deterministic red/green regression exposed an edge in the new presentation:
transport could reconnect while the old route was still marked `stale`, before
`system.ready`. The projection, status summary, last-known model details and visual
availability now continue to say reconnecting until fresh core state arrives.
The authoritative reducer's request/session/stale-completion gates remain intact.

[Headless loading/Controls at 640px](evidence/living-palette/loading-controls.png)
confirms persistent exact model identity, elapsed waiting, Controls/Quit access,
retirement of the elapsed label at ready and rejection of an older request result.
[Lifecycle measurements and final source hashes](evidence/living-palette/lifecycle.json).
All protocol data here is generated, with no owner proof, personal transcript or
raw audio. No Sam, LM Studio, real inference or visible browser session occurred.

## Final gate and limits

156 focused tests across 19 files pass: visual engine/field/palette/settings,
provider presentation/reliability, frontend lifecycle and status. Seven added
provider cases cover normal/slow operations, failed/rapid replacement, stale
completion, reconnect/fresh snapshot, shutdown, ready retirement and Reduced
Motion. Three bounded headless cases cover real shader temporal rendering,
provider posture and the current UI; TypeScript, changed-file Biome, production
frontend build, local documentation links and Git whitespace checks pass.
No Python core changed; no unrelated Python/native/Agency/Memory suites ran.

Extra loading/search fragment work is gated when inactive. One vec4 per body/film
program carries bounded provider cues. Meshes, buffers, particle counts, draws,
profile/pixel/cadence protections and Canvas fallback are unchanged. GPU/CPU timing,
full-app performance and low-power behavior were not profiled while the owner was
multitasking. Shader compilation and finite bounds are not a performance claim.

The palette comparisons are source-pinned to the first checkpoint; lifecycle
source hashes identify the final implementation. The original concept board is
still absent. Color appeal, connected film character and naturalness require later
owner judgment. No beta, version bump, release, provider machinery or audio change.
Composable launcher flags, security maintenance, v0.2.5 publication, major STT,
reference-guided membrane redesign and later themes/capabilities remain separate.
