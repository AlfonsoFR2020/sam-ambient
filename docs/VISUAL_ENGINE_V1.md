# Sam Visual Engine v1

Status: implementation contract. The core renderer, state choreography, direct
manipulation, persistent visual preferences and bounded measured adaptation have
landed on `dev`; human visual/native acceptance remains pending.
Spectral/prosodic mapping and the audio-reactive embodiment direction in section 14
remain future design work. This document owns renderer, input, motion, quality and
settings decisions. [Sam Orb visual direction](VISUAL_DIRECTION.md) records the
post-v0.2.2 artistic aim and alternative geometry; it does not change these
implementation bounds or voice policy by itself.

## 1. Visual identity and renderer decision

Sam is a luminous amber spheroid with fragmented wrapping peels, a quiet inner glow
and a few orbiting lights. The reference is the spherical, flowing, warm-light
language of [sam-logo.png](../sam-logo.png), not its lettering, pixels or outline.
Never animate that PNG or import the rejected ambient composition.

- Presence before ornament: a coherent, substantial object, not scattered dust.
- Alive at silence: breathing, precession and light travel require no audio.
- Readable state, restrained energy: geometry conveys state even at zero amplitude.
- Warmth without glare: burnt-orange body, amber bands, small warm-gold highlights
  on a dark neutral background; preserve detail rather than clipping to white.
- Audio modulates one physical-looking form, not separate frequency-bar displays.
- No HUD, spinner, texture atlas, physics, raymarching, volumetrics or postprocess bloom.

Decision: a small custom **WebGL2** renderer, without a rendering library. Depth,
surface lighting and depth-occluded spherical peels justify it over
Canvas/SVG. Canvas would require CPU projection and depth sorting; SVG would add
many animated nodes. A deliberately simpler Canvas 2D fallback shares the input
and motion model. Neither renderer owns application state or audio devices.

## 2. Geometry, coordinates and light

Use right-handed object space: origin at orb center, +Y up, rest radius 1. An
orthographic camera at +Z looks at the origin. Orthographic projection preserves
scale across aspect ratios. Apply, in order: bounded surface displacement,
spheroid scale, object orientation, camera projection. All lengths below are in
rest-radius units unless stated otherwise.

### Sphere

An indexed latitude/longitude UV mesh has a duplicated longitude seam and no
zero-area pole triangles. Medium uses 72 longitude segments and 36 latitude
segments: at most 2,701 vertices and 5,040 triangles. Keep static unit normals/UVs
in immutable buffers. Base spheroid axes are `(1, 1.06, 0.96)`; state opening can
change the Y axis by at most 0.04. The final radial bound in section 5 is mandatory.

### Fragmented loxodromic peels

This is the implemented v1 geometry and a valid efficient fallback. The preferred
future outer-membrane interpretation, including sector masks and candidate cheap
boundary representations, is described in [Sam Orb visual direction](VISUAL_DIRECTION.md#outer-membrane-and-peels).
Replacing this geometry or its draw/depth rules requires a measured engineering
decision; the direction document does not silently supersede this contract.

The loxodromes are invisible mathematical carriers, never complete visible
ribbons. Render 6/11/16 independent elongated peels at low/medium/high quality,
with 16/20/24 centerline samples each. Each peel stores a carrier/family,
center parameter, half-length, angular half-width, radial lift, opacity, phase,
speed and seeded orientation/tilt. Two transverse vertices per sample form one
batched indexed peel draw; static `q`, transverse side and peel identity are vertex
attributes, while time/state/audio are uniforms. Do not rebuild meshes on the CPU.

For peel `i`, `q` spans `[-1,+1]`:

```text
latitude  phi(u) = atan(sinh(u))
u_i(q,t) = center_i + speed_i*t + q*halfLength_i
longitude lambda_i(u,t) = k_i(t)*u + familyPhase_i
C = (cos(phi)*cos(lambda), sin(phi), cos(phi)*sin(lambda))
k_i(t) = 1.65 + 0.12*sin(0.07*t + seedPhase_i)
T = normalize(dC/du)
B = normalize(cross(C,T))
endFade(q) = smoothstep(0,0.18,1-abs(q))
w_i(q,t) = halfWidth_i(t) * endFade(q)
surfaceDirection = normalize(C*cos(v*w_i) + B*sin(v*w_i)), v in {-1,+1}
position = displacedOrbSurface(surfaceDirection) + normal(C)*lift_i(t)
```

For fixed `k`, `d(lambda)/d(phi) = k/cos(phi)`: this is a constant-bearing
loxodrome away from the poles, not a helix pasted in screen space. Each short
interval stays within `u in [-1.8,1.8]`, wrapping its center periodically without
crossing the pole limit. Half-length is seeded in `[0.22,0.58]`; angular half-width
in `[0.042,0.100]`, opacity in `[0.38,0.80]`, and drift speed in
`[0.006,0.018]` rad/s with seeded direction. Soft end alpha uses `endFade^2`.

Rotate each carrier by a fixed seeded tilt of at most 40 degrees around X/Z,
then evaluate the same surface displacement as the sphere. Radial lift stays in
`[0.020,0.050]`, with any later audio/state addition capped at 0.018; this keeps
peels close to the body rather than flying free. State separation may change tilt
by at most another 4 degrees and width/lift within these bounds. Nearby fragments
can align, overlap and share travelling highlights to suggest reconnection; there
is no topology merge/split, physics or fragment spawning.

Draw the opaque orb first with depth writes. Draw all semi-transparent peels in
one batch afterward with depth test on and depth writes off, using bounded
premultiplied emissive blending. Back-side fragments disappear behind the orb
naturally. Do not CPU crop or sort them merely for horizon visibility; a small
`smoothstep(0.0,0.15,dot(normal,view))` horizon fade may soften entry and exit.
Human review found that the horizon fade hid the existing ribbons prematurely;
the current WebGL pass relies on geometric depth occlusion instead. Intersections
between unsorted translucent ribbons can still show ordering lines; the future
outer membrane is the preferred structural solution, not per-frame CPU sorting.

### Orientation, lights, particles

```text
orientation = Ry(precession) * Rx(0.22) * Rz(0.08*sin(0.035*t)) * Ry(spin)
precession += 0.018 * motionScale * dt
spin       += stateAngularSpeed * motionScale * dt
```

Phases remain continuous through state changes. Do not reset Euler angles when
speaking starts. Rebase periodic phases modulo `2*pi`; no unbounded time uniforms.
Any periodic consumer of a wrapped phase must use an integer harmonic (or its
own independently wrapped phase). Fractional multipliers on a wrapped phase
caused visible ribbon/shape resets in human review and are not safe at the wrap.
An independent light coordinate frame is centered on the orb, not fixed to its
spinning surface. Each of 1–3 analytic point lights travels an inclined elliptical
orbit with radii `(1.6,1.3,1.5)`, inclinations up to 35 degrees and angular speeds
0.07–0.13 rad/s. Clamp audio speed modulation to +35%. Particles marking the light
positions may be slightly brighter but must not look like satellites with trails.

Use 12/24/40 seeded camera-facing particle quads on shells of radius 1.1–1.4.
Analytic phases produce slow orbit and bounded +/-0.025 radial drift; no simulation,
sorting, spawning or unbounded lifetimes. Fade particles behind the sphere using
depth testing. Particle density scales visibility, not random emission rate.

Lighting: vertex-shader geometry/displacement, fragment-shader diffuse light,
one broad specular lobe (Blinn exponent 24), rim term `(1-dot(N,V))^3` and bounded
emission. Compute deformed normals from the analytic tangent gradient of the
displacement, then the spheroid inverse-transpose. No shadow maps. Draw a single
analytic soft halo quad behind the object; this is the entire bloom approximation.
Use linear-light calculations, a fixed soft tone curve `c/(1+c)`, and one sRGB
conversion. Do not accumulate additive brightness without a final bound.

## 3. One provider-neutral visual input

The adapter accepts authoritative application events and publishes the following
conceptual TypeScript contract. This is not a replacement for Sam protocol-v1:
transport decoding, authorization and stale-event rejection remain outside it.

```ts
type AudioFeatures = {
  receivedMs: number;                 // local monotonic clock, per channel
  envelope: number;                   // [0,1], required when channel exists
  peak?: number; transient?: number;  // [0,1]
  bands?: [number, number, number];    // low, mid, high, each [0,1]
  shape?: [number, number, number, number]; // signed [-1,1], definition below
  activity?: number; confidence?: number;  // [0,1], absent != zero
};
type Interaction = {
  foreground: "idle" | "listening" | "transcribing" | "thinking" |
              "speaking" | "interrupted" | "resuming";
  listening: boolean; speaking: boolean;  // may BOTH be true
  floor: "none" | "user" | "sam" | "shared" | "holding" | "yielding";
  acknowledgement: boolean;
  userPause: boolean;
  reasoning: boolean; delegatedWork: boolean; responseReady: boolean;
  interruptSerial: number;            // increases only for confirmed interruption
  availability: "starting" | "ready" | "degraded" | "reconnecting" | "stopped";
};
type ExpressionHint = {
  source: "synthesis" | "interaction" | "semantic" | "prosody";
  confidence: number;                 // [0,1]
  warmth?: number; energy?: number; coherence?: number; // [-1,1]
  receivedMs: number; ttlMs: number;   // at most 2000 ms
};
type VisualInputV1 = {
  version: 1;
  streamKey: string;                  // session/runtime incarnation
  sequence: number; receivedMs: number;
  audio: { input?: AudioFeatures; output?: AudioFeatures };
  interaction: Interaction;
  expression?: ExpressionHint;
};
```

All timestamps used for expiry are receipt times on the same local monotonic
clock. Never subtract server monotonic time from browser time. Adapter checks
session/turn/generation/cancellation correlation using current Sam state before
publication. It resets samples on a new runtime incarnation, ignores old sequence
numbers, and clears output immediately on confirmed cancellation/stop. Late levels
from old speech must never relight the orb. Invalid/nonfinite fields are dropped;
finite fields are clamped. The renderer cannot cancel, grant authority or infer a
turn transition from audio. Typed hints are data, never scripts, colors or shaders.

Input and output age independently: after 250 ms without a channel update, fade
its features toward zero with a 180 ms time constant; after 1000 ms clear them.
At a confirmed output stop clear excitation immediately, easing geometry over
120 ms. Do not pretend absent telemetry is silence with measured confidence.
Interaction persists until an authoritative change or disconnect; disconnect
clears both channels and uses the reconnecting appearance.

### Adapter for today's `dev`

Reuse `UiState`, `VoiceMetrics` and the existing correlation-aware reducer in
`ui/src/protocol/types.ts` and `ui/src/state/reducer.ts`. Replace the presentation
mapping in `ui/src/ambient/model.ts` later, not the conversation state machine.

- `voice.level`: `rms -> input.envelope`, `peak -> input.peak`,
  `speech_probability -> input.activity`; these are already normalized metrics.
- `tts.level.envelope -> output.envelope`; generation filtering remains mandatory.
- Neither event currently supplies bands/shape: leave them **absent**, not invented
  from RMS. Envelope-only rendering must already be convincing and complete.
- `IDLE` stays idle; `LISTENING`, `USER_SPEAKING`, `ENDPOINT_CANDIDATE` map to
  listening. Existing `stt_finalizing -> COMMITTING` maps to transcribing.
  `THINKING` and `SPEAKING` map directly. `INTERRUPTED` increments the interrupt
  serial; `INTERRUPTION_CANDIDATE` keeps prior foreground and adds receptiveness,
  never fires the confirmed-interruption impulse. `RECOVERING` restores the
  prior active state; resuming applies only if actual playback resumes.
- `ERROR`, `OFFLINE`, connection and applicationStopped drive availability, not
  pretend speech. Mic/output enablement gates their channels; mic-muted idle is
  not presented as actively listening. Keep existing accessible state text.
- Tool/reasoning cues use actual correlated lifecycle events when available;
  otherwise false. Do not infer activity from response length or elapsed time.

A future duplex adapter supplies simultaneous listening/speaking and independent
reasoning/tool signals through this same interface. Interaction-vs-slower-cognition
separation (the GPT-Live-1 architectural precedent in the brief) is motivation,
not an SDK, provider requirement or claim of current Sam functionality. No cloud
connection is needed. Foreground follows the interaction adapter; backend reasoning
must not replace visible speaking/listening just because it runs concurrently.

## 4. Audio analysis outside the renderer

Rich features are optional. Place one reusable bounded extractor at existing
capture and **actual playback** PCM boundaries, independent of STT/TTS providers.
Do not analyze synthesized-but-not-played buffers. A future Web Audio/duplex adapter
may implement the same numerical contract in its audio worker. Never open an extra
microphone, route PCM over the UI protocol solely for visuals, or retain audio.

Reference extractor, per channel: mono analysis copy at 16 kHz using a streaming
low-pass resampler when needed; 1024-sample Hann FFT, 400-sample hop (40 Hz).
Compute RMS and absolute peak on the newest 400 samples. Low quality may publish
20 Hz. Preallocate ring/FFT/scratch buffers. Analysis runs off the audio callback
and main render thread; bounded queue size one drops old visual work, never audio.

```text
sat(x) = clamp(x,0,1)
normAmplitude(a) = sat((20*log10(max(a,1e-6)) + 60)/54)
smooth(y,x,dt,tau) = y + (1-exp(-dt/tau))*(x-y)
```

The reference has a -60 dBFS floor and -6 dBFS upper point, no per-frame AGC.
Use envelope attack/release 35/220 ms; peak 15/120 ms. Transient is
`sat(4*max(0,E-E_previous))`, with 15/180 ms smoothing. These are visual features,
not VAD decisions. Do not apply dB normalization again to today's normalized UI
metrics; the adapter marks them as legacy envelope-only internally.

FFT power bins define bands `[80,300)`, `[300,2000)`, `[2000,7500]` Hz. For band
power `P_b`, total power `P` over 80–7500 Hz, publish
`E*sqrt(P_b/max(P,epsilon))`, gated to zero below -60 dBFS. Smooth 60/240 ms.
This carries both spectral balance and level without amplifying quiet noise.

The four waveform-shape coefficients are normalized autocorrelation of the
mean-removed window at lags 16,32,64,128 samples (1,2,4,8 ms): numerator is the
lagged dot product, denominator the geometric mean of the two segment energies.
Clamp to [-1,1], multiply by `E`, zero at the noise floor, smooth at 100 ms.
This phase-insensitive waveform descriptor avoids unstable raw waveform snapshots.
Optional activity/confidence comes from available metadata, never fabricated.

Publish only the compact features at analysis rate. A mutable target store and
exponential visual-rate interpolation (60 ms, transient 25 ms) decouple rendering
from arrival cadence. Do not interpolate using future samples or add a jitter
buffer. Feature-only transport additions, if needed later, remain optional and
backward-compatible; they must not be smuggled into existing amplitude fields.

## 5. Bounded audio-to-form mapping

Let `e(x)=x*x*(3-2*x)` after clamping. Compute input and output responses
independently, gated by their interaction flags. Listening gain is 0.55, speaking
gain 1.0; simultaneous channels combine as `max(output,0.55*input)` for global
radius/light, not a sum. An input-weighted opening cue remains visible in duplex.
No live input response when mic is muted. Missing bands/shape contribute zero;
autonomous breathing is separate, never described as measured audio.

`E,P,L,M,H,W` below are the resulting envelope, transient, three bands and four
shape coefficients after reactivity scaling and clamping. Use these common
parameters for all geometry, never four independent audio-driven objects:

```text
radius = clamp(stateRadius + 0.010*sin(breathPhase) + 0.055*e(E), 0.92,1.10)
luminance = clamp(stateGlow + 0.28*e(E) + 0.10*P, 0.12,0.85)
halfWidth = clamp(0.045 + 0.018*e(M) + stateWidth, 0.035,0.085)
separation = sat(stateOpening + 0.28*e(M))
highlightImpulse = min(0.12,0.12*P)       // local ridge/halo, never full-screen flash
particleExcitation = sat(0.15 + 0.60*e(H))
```

`stateWidth` is zero in v1; `stateRadius`, `stateGlow`, `stateOpening` and
`stateAngularSpeed` come from section 6. Apply intensity to final emission and
glow_intensity to halo emission, not geometry. Apply motion_intensity to all
time-varying spatial excursions and speeds, but retain static state geometry.
Reactivity zero removes measured audio modulation without removing idle motion.

For unit direction `n`, define fixed seeded unit axes `a,b,c,d_i`:

```text
displacement(n) = clamp(
  0.008*sin(2*dot(a,n)+breathPhase)
  + 0.020*L*sin(3*dot(b,n)+slowPhase)
  + 0.007*H*sin(14*dot(c,n)+ripplePhase)
  + 0.006/4 * sum_i(W_i*sin((4+2*i)*dot(d_i,n)+phase_i)), -0.04,0.04)
```

Apply radial displacement before spheroid scale. The final body distance from
center must remain within `[0.84,1.26]`, peels within 1.31, halo within 1.65.
Enforce bounds after all settings/expression/state combinations, not only defaults.
Low band changes broad curvature/breathing; mid band changes peel width,
separation and pitch by at most 0.08; high band changes only fine ripples/particles.
Waveform coefficients never exceed 0.006 total displacement. Orbital speed changes
follow 250 ms filtering; audio does not directly set angles. Limit luminance change
to 0.8 units/s and the highlight excursion to 0.12, with no hard strobes.

## 6. Continuous state language

All rows are target parameters for one renderer, not separate animation clips.
Defaults below precede audio and user intensity. Blend state targets with a
250 ms time constant; transcribing 160 ms, interrupted 70 ms contraction followed
by 250 ms recovery. Oscillators continue in phase; transitions never restart loops.

| Foreground | Radius / glow | Opening / spin rad/s | Silent identity and audio treatment |
| --- | --- | --- | --- |
| Idle | 1.00 / .24 | .10 / .045 | Coherent peels, 8 s breathing, slow light travel. |
| Listening | 1.05 / .34 | .78 / .055 | Open/lift peels, outward rim emphasis; input drives broad response. |
| Transcribing | .97 / .34 | .14 / .030 | Captured opening converges once over 450 ms; aligned ridges remain until done. |
| Thinking | .945 / .31 | .04 / .025 | Peels tighten toward body, inward drift, focused inner light; no progress spinner. |
| Speaking | 1.025 / .44 | .50 / .065 | Stronger bounded peel width/lift and travelling highlights; strongest output coupling. |
| Interrupted | .94 / .26 | .12 / .020 | One contraction/rephasing per serial, no red flash; then actual next state. |
| Resuming | towards speaking | towards speaking | 300 ms opening ramp; fresh output resumes, old energy never replays. |

For transcribing, capture the last opening value, not audio content. Ramp to the
target without endlessly repeating a resolving gesture. Reverse peel phase
drift gently while thinking; no literal inward travel beyond the bounded lift.
Interruption rephasing is a maximum 0.12-radian target offset eased continuously.

Orthogonal duplex cues: holding slows drift; yielding opens bands over 300 ms;
backchannel gives one small warm ridge lift, not a full speaking transition;
user pause relaxes input excitation while listening remains open. Reasoning adds
a slow inner ridge when another foreground is active. Delegated work adds one
secondary light modulation, at most 0.04 luminance, not another orbiting widget.
Response-ready holds that ridge steady. Secondary cues never mask foreground.

Starting/reconnecting uses a dim stationary coherent form plus existing status
text, not fake progress. Degraded appearance follows whichever interaction still
works; show the reason outside the artwork. Stopped clears all activity and holds
a dim static form. These are availability overlays, not new conversation states.

## 7. Isolated renderer and lifecycle

```text
React/application events -> visual-state adapter -> mutable target/current state
                                                   -> WebGL2 or Canvas renderer
audio feature extractor ---------------------------> adapter (features only)
```

Expose only `mount(hostElement, options)`, `update(input)`, `configure(settings)`,
`resize(cssWidth,cssHeight,dpr)`, `setVisible(boolean)`, `dispose()` and a test-only
clock/seed hook. Keep the motion evaluator a pure function of targets, prior
state and delta time. React owns mounting, controls and accessible state text;
refs own renderer state. **No setState, DOM measurement or allocation per frame.**

One requestAnimationFrame scheduler checks the chosen cadence; integrate using
monotonic delta time capped at 50 ms. No catch-up simulation after a stall.
Preallocate typed arrays, meshes and uniforms; upload only uniforms per draw.
Batch all peels; instance particle quads. Render halo, opaque body, peels,
particles in at most four draw calls. Body writes depth; translucent surfaces
depth-test without depth writes using bounded premultiplied additive light.
Use one active canvas, one depth buffer, no offscreen render targets or textures.
The renderer owns the canvas inside the React-owned host; replace the canvas on
WebGL/2D mode changes because a context-bound canvas cannot change context type.

ResizeObserver updates backing storage only when dimensions change. The layout
supplies the unobstructed ambient rectangle after controls/transcript allocation.
Let `S=min(width,height)`, rest body diameter `0.56*S`; maximum halo diameter
is `0.924*S` at the 1.65 radius bound. Fit the maximum halo bound, not just the rest
sphere. No fixed desktop pixel cap; use the same rule on small windows. The canvas
remains `aria-hidden` and ignores pointer events. A bounded app-owned interaction
region over the orb accepts primary mouse or single-touch rotation; transcript,
controls and dialogs remain outside it and retain normal hit testing.

Page visibility, zero-size canvas or offscreen intersection suspends rAF and
drawing. Stopped availability draws one final static frame and suspends until a
state/layout/settings change. Audio/authoritative runtime continues independently. On return, discard
expired features, resume current targets, do not replay elapsed animation.
Reduced motion draws only on changed inputs/settings, at most 15 Hz. Dispose
disconnects observers/listeners, cancels rAF and deletes every GL resource.

On context loss prevent the default destruction behavior, stop GL work and show
Canvas fallback. Attempt one restoration/recreation per loss, at most two in a
session; repeated failure stays Canvas until explicit retry/reload. Keep no old
GPU handles. Seed procedural phases with a fixed v1 seed (test-overridable), not
user identity/audio. Tests can manually advance time and read bounded motion
parameters, quality, resource counts and draw statistics without relying solely
on screenshots. Shaders are bundled static source compatible with current CSP.

## 8. Performance envelope and quality

These are implementation/acceptance budgets, **not measurements of current Sam**.
Maintain the same two-scale Living Surface, palette grammar, breathing and state
geometry at every level; optional detail must not move primary colour regions.

| Budget | Low | Medium | High |
| --- | --- | --- | --- |
| Sphere segments longitude x latitude | 32 x 16 | 72 x 36 | 96 x 48 |
| Sphere vertices / triangles, upper bound | 561 / 960 | 2701 / 5040 | 4753 / 9024 |
| Peels x centerline samples | 6 x 16 | 11 x 20 | 16 x 24 |
| Peel vertices / triangles | 192 / 180 | 440 / 418 | 768 / 736 |
| Particles / lights | 12 / 1 | 24 / 2 | 40 / 3 |
| Optional fine field samples per fragment | 0 | 1 | 2 |
| Idle / active FPS | 24 / 30 | 30 / 60 | 30 / 60 |
| DPR cap / backing-pixel cap | 1 / 1M | 1.5 / 2M | 2 / 3M |

Enforce both caps: `effectiveDpr=min(deviceDpr,qualityCap,sqrt(pixelCap/(w*h)))`.
Maximum four draws, eight GPU buffers, 512 KiB geometry/uniform GPU data, 256 KiB
audio scratch per channel. Incremental renderer CPU heap target <4 MiB; render
surfaces including driver MSAA target <64 MiB at high. Disable MSAA at low;
prefer shader edge feathering. Browser/React/Python memory is outside this budget.

Target p95 renderer main-thread work <2 ms/frame on desktop/modest laptop and
<3 ms on representative mobile; GPU work <4 ms desktop / <8 ms low-power.
Audio analysis target <0.5 ms/channel/hop desktop, <1.5 ms low-power. Measure
separately from model inference and compositor contention; no claim based on
requestAnimationFrame interval alone. GPU timer queries are optional diagnostics,
never a rendering requirement. Record device, viewport, DPR and quality in reports.

Visual quality controls richness; device profile constrains the allowed envelope.
Profiles are `auto`, `mobile_2020`, `low_power`, `desktop`, and `high_end`.
`mobile_2020` formally supports 360x640 through 390x844 CSS portrait viewports at
effective DPR 1, low geometry, no required MSAA/offscreen targets/textures/post
processing, <=4 draws, about 24 FPS idle and 30 FPS active. `low_power` shares the
low cap at other viewport shapes. `desktop` caps AUTO at medium until measured
headroom promotes it; `high_end` permits high but never changes visual identity.
An explicit lower profile always caps an explicit or automatic richer quality, so
this remains one resolved budget rather than a quality/profile matrix. Desktop
developers can force `mobile_2020` for repeatable feedback. Do not use GPU strings.

AUTO starts medium only for explicit desktop/high-end profiles and low otherwise;
platform hints select only an initial conservative preset. Over a 5-second visible active
window, if >10% of intervals exceed 1.5x the frame budget, lower resolution first,
then particle count, then mesh/peel sampling and cadence. Change at most once
per 5 seconds. Preserve at least six peels. Recover one level after 30 seconds
of stable headroom; AUTO on desktop/high_end may promote through high after sustained
measured headroom. Explicit profiles remain hard caps and explicit quality a desired
ceiling, not proof that the device can sustain it.
Ignore hidden/startup windows in adaptation. Poor performance at minimum selects
Canvas after two bad windows; expose the fallback in unobtrusive diagnostics,
not an intrusive permanent control. Do not probe GPU vendor strings as proof
of capability. Explicit quality still obeys memory caps.
The current v0.2.3 governor switches whole resolved budgets with this existing
hysteresis. It uses paced frame intervals to detect overload and bounded CPU
render-submission duration to infer promotion headroom; neither is a GPU timer
nor a trusted model-inference workload signal. Component-by-component shedding
remains a later refinement, not a present claim.

## 9. Accessibility, fallback and platform parity

Effective reduced motion defaults to `prefers-reduced-motion`, observed live.
Explicit on/off overrides are user choices. In reduced motion, freeze rotation,
orbits, breathing, particles, travelling highlights and all audio displacement.
Use distinct static band openings/ridge patterns per state; interpolate shape
only on state changes over 200 ms, and subdued audio luminance over 250 ms.
No repeated spatial motion. Discreet textual state remains accessible; do not
announce amplitude updates to assistive technology. Color is never the sole cue.

Canvas 2D fallback: a radial-gradient spheroid, three sampled projected rhumb
curves (48 samples each), one warm highlight and halo. Clip back-facing curve
segments using the direction's Z sign; no depth-sort simulation. Reuse the motion
evaluator with deformation capped at 0.01, no particles, DPR <=1, idle 24/active
30 FPS maximum. Cache gradients on resize/theme change, avoid large blur filters.
Reduced-motion rules are identical. If Canvas is also unavailable, render a
static CSS warm orb plus state text. Disabled visuals leave transcript/controls
and state text usable, and allocate no animation resources.

WebGL2 failure, repeated context loss and weak/software GPU behavior all degrade
gracefully. No fullscreen flashes on recovery. Tauri/WebView2, browser fallback,
future Linux and mobile WebViews use the identical input and lifecycle API;
platform code only supplies visibility/layout/initial-quality hints. No native
IPC, filesystem, network calls or Tauri imports inside the engine.

## 10. Settings contract and general Sam rule

Sam's schema-v1 loader now supports the user-facing quality, device profile,
intensity, motion, audio reactivity, particle density and reduced-motion keys below.
The trusted owner control persists those values in Sam's runtime state so Controls
changes survive interface reload and Sam restart. Renderer selection, glow and theme
remain specification-level extensions rather than advertised persisted settings:
Auto quality initially uses low for Auto/mobile/low-power profiles, medium for
Desktop and high for an explicitly chosen High-end desktop; the measured governor
can still demote or promote within the profile cap. Low power and `mobile_2020`
currently share the same low cap, which Controls labels explicitly.

```toml
[visual]
enabled = true
renderer = "auto"        # auto | webgl2 | canvas2d; failures still fall back
quality = "auto"         # auto | low | medium | high
device_profile = "auto"  # auto | mobile_2020 | low_power | desktop | high_end
intensity = 0.82         # 0..1, overall emission scale
motion_intensity = 0.6   # 0..1, scales spatial speeds/excursions
audio_reactivity = 0.7   # 0..1, scales measured feature contribution
particle_density = 0.6   # 0..1, scales preset particle count
glow_intensity = 0.5     # 0..1, halo strength, not blur size
theme = "amber"         # amber | copper | gold, all retain warm identity
reduced_motion = "system" # system | on | off
```

Reject unknown keys/types, out-of-range settings and nonfinite numbers with named
errors. Numeric feature clamping is different from configuration validation.
Keep existing defaults -> user -> workspace -> environment -> explicit CLI
precedence; add no environment/CLI switches solely for completeness. Export only
resolved visual settings to the UI, never the full config or credentials.

TOML supplies the configured baseline; explicit owner changes made in Controls are
stored separately as runtime preferences and override that baseline on later starts.
Automatic quality/fallback and detected capabilities remain ephemeral runtime state.
Map existing brightness percentage to intensity once, and existing reduced-motion
control to the override; do not multiply two brightness preferences. No settings
migration is performed by this design pass. Themes select predefined palettes
centered on hue 30/22/40 degrees; constrain all variations to warm 18–48 degrees.

**General Sam settings rule:** whenever a meaningful optional or system-dependent
alternative makes user choice matter, provide an understandable settings/config
surface. Show detected/available choices, current selection, automatic/default
behavior, unavailable alternatives honestly, and a short plain-English explanation.
This applies to model runtimes/endpoints, STT, local/cloud TTS, native/browser
shells, visual rendering/quality and MCP providers. Do not silently enable a remote
service or grant authority through selection. The global Settings UI is outside
this specification; implementing this engine must not create a parallel settings
system or expose raw shader internals.

## 11. Optional expression/prosody

The optional expression hint is complete when absent: neutral contribution zero.
Never infer emotion, intent or psychological state from loudness. Future sources
can be synthesis metadata, a duplex frontend, explicit semantic output or prosody
analysis. These are bounded aesthetic hints, not authoritative interaction state.

Ignore confidence below .6; otherwise scale by confidence and smooth over 800 ms.
Expired hints decay to neutral over 600 ms; clear on turn/runtime replacement.
Warmth offsets hue by at most 4 degrees and lighting tint by 5%; energy offsets
saturation by at most .06 and curvature by .02 rad; coherence offsets relative
phase by at most .08 rad and particle phase spread by 10%. Clamp final parameters
to earlier bounds. Reduced motion suppresses spatial effects. Do not infer missing
channels, persist hints, or let hints override foreground/cancellation. Future
ElevenLabs/Hume-style adapters may supply such data; no integration is implied.

## 12. Acceptance

### A. Automated (later implementation)

- Seeded silent/state/audio fixtures, including overlapping duplex reasoning and
  speech, exercise all rows, availability overlays and continuous transitions.
- Assert numerical bounds for adversarial settings/features, NaN, absent spectrum,
  stale sequences/generations, mute, cancellation and reconnect. Confirm output
  cannot reactivate from a stale packet and input cannot masquerade as output.
- Test envelope attack/release, spectral bands and phase-insensitive shape with
  synthetic silence/tones/transients. No microphone or provider is needed.
- Test portrait 360x640, small 640x480, desktop 1280x720 and 1920x1080: unclipped
  maximum extent, readable controls/transcript, body diameter .56 of the free
  rectangle's short side. No pointer/focus/scroll interference.
- Assert no React commits per animation frame, no steady-state allocations,
  <=4 draws, buffer/pixel caps and bounded repeated mount/dispose memory.
- Hidden/offscreen/stopped surfaces draw zero frames after their final state frame;
  resuming does not replay accumulated frames. Reduced motion has no continuous
  spatial animation and respects runtime OS preference changes.
- Inject WebGL absence, context loss/restoration and slow frames; verify Canvas,
  static fallback, hysteresis and no console errors. Shader build failures are
  recoverable diagnostics, not an application crash.
- Collect 30-second idle/active p95 timing against section 8 on desktop and one
  representative low-power/mobile device later. Tests on desktop alone do not
  establish mobile viability. Compare equivalent fixtures in browser and native
  WebView with matching DPR/quality; tolerate raster differences, not state drift.

For a frontend-only human preview, start the already-installed Vite toolchain
from `ui`:

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1420 --strictPort
```

Open `http://127.0.0.1:1420/?transport=demo` in the Codex built-in browser.
This demo needs no Sam core, model or audio service. Confirm
that the served `living-material.ts` is from the current checkout before trusting
the image. The ambient host exposes `data-sam-renderer="webgl2"` when the intended
shader is active; `canvas2d` or `static` and `data-sam-fallback-reason` mean the
older amber fallback is being shown. Shader-build failures also log their error
to the browser console. Dismiss the demo startup panel to inspect the Orb, and
stop the dev server when the preview is no longer needed. A screenshot or Canvas
fallback alone is not human acceptance of the WebGL Living Surface.

### B. Human visual acceptance (separate future session)

- Recognizably Sam's warm luminous identity, not a generic ball, particle cloud,
  logo animation or wrapped equalizer. Meaningful presence at every target size.
- Idle, Listening, Thinking and Speaking distinguishable without labels in silent
  fixtures (target >=80% correct across randomized observations); transcribing
  and interrupted feel coherent rather than errors or loading spinners.
- Audio response visibly follows articulation, remains elegant at strong levels,
  and completes at silence without jitter, clipping or sudden phase resets.
- Sustained idle is calm, not static; active geometry is alive without visual
  fatigue. Reduced motion preserves identity and understandable state.
- Transcript/controls remain readable and subordinate; no demand for fullscreen
  or hidden controls to make the artwork look good. Palette/lighting acceptance
  and real low-power performance remain validation tasks, not architecture choices.

## 13. Later implementation staging

| Stage | Deliverable / checkpoint | Work character |
| --- | --- | --- |
| A | Typed visual contract, current-state adapter, optional extractor + fixtures; envelope-only path first. | High-reasoning / short: correlation and numerical contract; routine test implementation. |
| B | Isolated WebGL lifecycle, sphere, lighting, layout and static fallback. | Implementation-heavy; bounded shader/resource review. |
| C | Fragmented rhumb-carrier peels, normals, bounded displacement, seeded lights/particles. | Implementation-heavy; high-reasoning / short mathematical verification. |
| D | Continuous state/audio evaluator, duplex composition, cancellation/expiry tests. | High-reasoning / short, then implementation-heavy wiring. |
| E | Validated visual config and existing-controls integration, documentation. | Routine/repetitive (low-reasoning) against this fixed contract. |
| F | Quality adaptation, Canvas fallback, reduced motion, loss/visibility cleanup. | Implementation-heavy; lifecycle edge cases require focused review. |
| G | Browser/native fixture, timing, resize and resource regression checks. | Routine/repetitive (low-reasoning) execution; escalate only measured failures. |
| H | Human visual acceptance and bounded parameter adjustments. | Human judgment; short high-reasoning interpretation, not an automatic pass. |

These A-H rows record the v1 implementation sequence, not the new Orb direction's
schedule. Use the existing React boundary for later work. The v1 geometry and
contract choices remain authoritative for current code; the proposed living field,
outer membrane and wider palette need a separate measured architecture decision
before implementation, as described in [Visual direction](VISUAL_DIRECTION.md#five-design-stages).

## 14. Future direction: audio-reactive embodiment and diagnostics

Status: moderately high-priority **future design direction**, not an implementation
commitment. This section extends rather than replaces sections 3-5: existing
independent input/output envelopes, low/mid/high bands, normalized autocorrelation
shape coefficients, expiry rules, visual bounds and fallbacks remain authoritative.
Exact mappings, constants, settings, transport fields and feature extraction choices
below require the separate design checkpoints in section 14.7 before implementation.
The [Orb direction](VISUAL_DIRECTION.md#audio-as-a-timely-disturbance) places these
features in one living surface/membrane system; this section keeps the engineering
constraints and alternative signal bases.

### 14.1 Purpose and authority boundary

The aim is one coherent procedural body that appears causally connected to what Sam
hears and actually plays. It should make speech expressive without becoming a generic
equalizer, and make abnormal behavior more visible during beta testing: persistent
energy after silence, noisy input, feedback-like duplex energy, stale output levels,
or a channel frozen above zero.

The visual layer remains an observer. It may render authoritative audio and runtime
features but must never classify speech, infer a turn/cancellation, decide microphone
state, alter VAD/STT/TTS behavior, or grant semantic authority to a visual pattern.
Diagnostics are evidence for a human observer, not a hidden reliability policy.

### 14.2 Compact feature direction

The existing `AudioFeatures` contract is the baseline. A later design pass may assess
the following additions only when their diagnostic or aesthetic value justifies their
cost. They are candidates, not a protocol change.

| Candidate feature | Candidate visual use | Constraint |
| --- | --- | --- |
| Independent RMS/envelope and peak | global breathing, glow and fast local articulation | input and output remain separately observable |
| Low/mid/high or small log-spaced bands | broad body structure, speech articulation and fine detail | do not map every FFT bin to a property |
| Spectral centroid/balance | subtle warm-tint, highlight and fine-vs-broad emphasis | never create a rainbow equalizer |
| Spectral flux/onset | a bounded travelling ridge, pulse or light excursion | impulse with decay, never a hard flash |
| Spectral flatness/noisiness | diagnostic contrast between voiced and keyboard/environmental activity | visual-only; never a speech classifier |
| Existing autocorrelation shape vector | phase/coherence of analytic travelling deformation | retain its phase-insensitive, noise-gated basis |
| Small Fourier/DCT, moments, or low-order directional modes | possible future alternative waveform bases | compare stability, aliasing and cost before selecting one |

The preferred path is a small feature vector, not raw PCM, a large learned embedding,
MFCC pipeline, pitch tracker, emotion model or per-bin geometry. Features should be
finite, normalized, smoothed and independently aged per channel. Missing remains
missing; it is never fabricated from RMS or interpreted as measured silence.

### 14.3 Coherent mapping families

Future work should propose two or three complete mapping families, not a grab-bag of
independent effects. Each family should start with two independently filtered channel
energies, `E_in` and `E_out`, then combine contributions by a deterministic bounded
rule. The existing `max(E_out, 0.55 * E_in)` global rule is a useful baseline, while
input still retains a visible receptive contribution in duplex operation.

Candidate input/output asymmetry is intentional: input can use inward, converging or
receptive motion; output can use outward, radiating or emissive motion. Related but
opposed peel phase drift, ripple propagation and light emphasis can make `input`,
`output` and `duplex` legible without a waveform HUD. Combining channels must not be
a naive unbounded sum.

**Envelope, RMS and peak.** Candidate uses include bounded global radius/breathing,
surface-displacement magnitude, peel lift, glow, luminance, specular intensity,
analytic light orbit/intensity and particle visibility. Attack should be quick enough
to follow articulation; release should be slower, graceful and phase-continuous. The
existing 35/220 ms envelope and 15/120 ms peak reference constants are starting
points for review, not a reason to reset an oscillator at a word boundary.

**Low band.** Bass should read as substantial mass: low-spatial-frequency radial
deformation, slow spheroid compression, broad peel separation, deeper curvature,
large light-orbit breathing or a low-order travelling mode. Moderate whole-object
vibration is a possible future candidate only if it cannot clip, collide with the UI,
or create hard-to-debug projection artifacts. It must remain bounded by section 5's
existing final body and peel extents.

**Mid band.** Speech-dominant energy is the primary articulation carrier. Candidate
uses are coordinated peel width/thickness/length, loxodromic pitch/twist, local lift,
relative orientation, ribbon phase velocity, broad ridges and structured surface
ripples. Warm hue, luminance and material variation may support this structure, but
must remain secondary to the existing copper/amber/gold identity.

**High band and spectral balance.** Treble may add small ripples, tighter highlights,
specular sparkle, compact particle visibility or fine peel modulation. Spectral
centroid/balance may shift the emphasis between broad and fine structure, highlight
position or specular tightness, with narrow warm palette variation only. High energy
must never turn the object into visual static.

**Flux and onsets.** Rapid change should create a decaying impulse: one travelling
ridge, small radial pulse, short peel phase displacement, brief light acceleration or
particle excitation. Use bounded attack/decay functions and existing anti-strobe and
luminance limits; no full-screen flash or hard discontinuity is permitted.

### 14.4 Waveform shape, surface and peels

The current normalized autocorrelation coefficients remain a valid waveform-shape
basis and must not be discarded. A later comparison may evaluate that basis against a
small Fourier/DCT vector, waveform moments, or a few directional/spherical-harmonic-
like modes. The decision criteria are perceptual usefulness, numerical stability,
noise behavior, shader operation count and spatial aliasing.

The preferred mathematical form is a very small, fixed, seeded mode set evaluated
analytically in the existing vertex shader or motion evaluator, for example:

```text
D(n,t) = sum_i a_i * sin(k_i * dot(d_i,n) + phase_i(t))
D(lambda,phi,t) = sum_m a_m * sin(m*lambda + omega_m*t + phase_m)
                  * g_m(phi)
```

Here `a_i` comes from bounded, smoothed feature coefficients; `d_i`, `k_i`,
`omega_i` and seeds are fixed; and phases remain continuous. This produces
spherically mapped travelling structure without PCM textures, dynamic meshes,
simulation state or per-frame geometry allocation.

Surface scales should remain coordinated: broad envelope/bass structure, medium
speech/mid ridges, small treble detail, and waveform coefficients shaping the pattern
rather than independently moving every vertex. Section 5's existing `[-0.04,0.04]`
radial displacement and final extent bounds remain controlling. Candidate ripples
therefore stay far below one radius, normally below a fifth and often below a tenth
of a radius even if a later bounded design changes their internal allocation.

Treat peels as the primary audio instrument rather than static decoration. Candidate
variables are width/thickness, radial lift, separation, loxodromic pitch, seeded tilt,
relative phase, drift direction/speed, local ridge strength, overlap emphasis and
modest warm luminance variation. Strong mid-band speech might slightly widen and lift
coordinated peels while a transient sends one ridge along them. Do not independently
randomize every property or make peels fly free; section 2's lift, tilt and horizon
constraints remain mandatory.

### 14.5 Silence, particles and lighting

Silence must retain Sam's contemplative idle identity: slow seeded light orbits,
tenuous warm color, quiet breathing and phase-continuous peels remain, but measured
audio energy decays strongly toward zero after confirmed under-threshold silence.
Audio-driven particles should fade to nearly imperceptible or absent; ripples settle;
audio peel deformation relaxes; and light parameters return toward their autonomous
idle level. Silence is not a black or frozen screen.

Particles remain deterministic seeded satellites, not a fountain. Candidate speech
response is bounded orbital-radius modulation, phase coherence, brightness, radial
drift and short transient excitation. Population/visibility may reflect high-band or
onset energy only within the existing fixed 12/24/40 quality budgets; confirmed
silence should reduce both visible and computational particle activity.

Audio affects the existing analytic light field rather than adding lights, passes or
bloom. Candidate controls are intensity, rim/specular response, orbit speed/radius,
travelling highlight position and a slight warm-tint shift. Envelope may influence
luminance, balance may influence material character, and transients may create a
short bounded highlight excursion. Existing light-count, speed-modulation and tone-
mapping bounds remain authoritative.

### 14.6 Efficiency, settings and diagnostic acceptance

Preserve the pipeline boundary:

```text
PCM boundary -> bounded extractor -> newest compact snapshot -> VisualInput
-> visual-rate interpolation -> existing shader uniforms
```

There is no second microphone, raw-audio persistence, raw PCM transport to React for
visuals, renderer-side FFT, unbounded queue, per-frame React state or per-frame
allocation. Prefer a 20-40 Hz extractor cadence with queue size one/newest-value
replacement and visual-rate interpolation. Reuse existing geometry, deterministic
seeds, analytic shader mathematics and draw calls.

The following v1 constraints remain non-negotiable: at most four draws; existing
`mobile_2020` geometry/profile caps; bounded DPR and FPS; no postprocess bloom,
feedback framebuffer, raymarching, compute/fluid/physics simulation, texture-driven
displacement or unbounded particles; and Canvas/static/reduced-motion fallbacks.
Techniques such as raymarching, feedback and multipass demoscene rendering may be
inspirational but are not automatically compatible with Sam's contract.

A later implementation may add a high-level `Audio embodiment` settings subpanel,
not raw shader controls. Candidate owner controls are enablement, overall reactivity,
input/output emphasis, structural/detail intensity and diagnostics visibility. It
should show resolved automatic capability/profile behavior honestly and choose a
conservative hardware-appropriate default before rendering a rich control surface.
Any setting remains optional, validated and subordinate to profile/reduced-motion
caps; it is not authorized by this document.

Future deterministic acceptance fixtures should let a human infer, with labels hidden
where practical: true silence, low ambient noise, continuous keyboard-like noise,
normal user speech, Sam output speech, duplex speech, a strong transient, stale
output energy after cancellation and a channel frozen nonzero. The renderer need not
diagnose cause; it should expose coherent evidence. Fixtures should include silence,
tones, speech-like spectra, impulses, noise and duplex combinations.

### 14.7 Required strong-model design checkpoints

Do not begin implementation automatically after this design record. A separate,
high-reasoning pass must leave written conclusions at each bounded checkpoint:

| Checkpoint | Required conclusion before continuing |
| --- | --- |
| A. Requirements and signals | Audit available PCM/telemetry; choose the smallest useful feature vector and reject features without clear value. |
| B. Mathematical mappings | Compare 2-3 coherent mapping families with equations, ranges, time constants, cross-channel composition and diagnostic legibility. |
| C. Demoscene/performance review | Estimate CPU extraction cost, shader operations, transport cadence, allocations, draw calls and `mobile_2020` impact; eliminate incompatible options. |
| D. Fixture prototype plan | Define deterministic synthetic audio and renderer tests before implementation, including silence, tones, speech-like spectra, impulses, noise and duplex. |
| E. Implementation slices | Sequence independently shippable commits: extractor/contract first, then one mapping family at a time. |
| F. Human acceptance | Request scarce native/acoustic/visual acceptance only after deterministic integration is stable. |

### 14.8 Research and licensing notes

The intended inspiration is constrained procedural practice: phase-coherent
oscillators, compact parameter spaces, analytic deformation, seeded deterministic
variation, reusable shader math and complex appearance from a few equations. NuSan/
Lev4k, *Drifting Shore*, *Hydrokinetics*, *Prismbeings*, compact single/few-draw-call
WebGL FFT visualizers, feature-to-visual mapping research such as Graf/Opara/Barthet,
and current real-time MIR visualization work are research prompts, not dependencies
or normative designs. Later research should prefer primary source code, original
productions and academic sources, then record accurate citations.

No code, assets, shader text, framework or production design may be copied from any
reference without a compatible license and explicit attribution in the relevant Sam
documentation. This direction adds no demoscene framework dependency.
