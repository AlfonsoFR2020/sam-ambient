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
comparison, not an exact full historical binary screenshot. The full/body-only
and identical-camera tier frames remain reproducible from the fixture.

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

## Stage 2

Provider/model status and bounded visual waiting behavior follow as an independent
checkpoint. No provider machinery/routing or fabricated progress will be added.
