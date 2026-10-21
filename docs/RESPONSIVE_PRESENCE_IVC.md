# Responsive Presence IV-C

2026-10-21. In progress; source and focused non-graphical evidence only.

## Provenance and permission

- Starting `dev`: `99751258bbea30c03c7bb0f82021140364906cec`, clean,
  five commits ahead of cached `origin/dev`; no fetch or remote mutation.
- Released v0.2.5: `dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`.
- `Start Sam.cmd` runs the existing editable `.venv` launcher. The installed
  `_editable_impl_sam_ambient.pth` points to this checkout's `src` directory.
  `OwnerWindow` privately fulfills `src/sam_ambient/static` assets. Neither the
  launcher nor that window builds frontend source.
- The checked-in static tree is identical to v0.2.5. Its last change is
  `9c5bce8c63cb90bd008571e4c4b3a03f9663b1af`; `index.html` selects
  `index-DPoRgsL3.js` and `index-D5fV1sLu.css`. A normal source launcher run
  therefore displays the released renderer, not IV-B.
- `scripts/ui-dev.ps1` / `.sh` use Vite source. Tauri development uses Vite;
  Tauri packaging explicitly builds the static frontend. Either a development
  launch or an intervening frontend rebuild could display IV-B. The owner's
  actual beta launch path is unknown. Their observations cannot yet be
  attributed to IV-B.
- IV-C explicitly permits short, sequential focused tests and static lint at
  low scheduling priority. No Sam/application launch, provider/model, browser,
  GPU, audio hardware, full build/suite, packaging or network operations.

## Owner observations (not established root causes)

Preserve the attractive evolving colourful swirls. Peels appeared questionable,
with inward curls; the desired concept is radial shells cropped by radial
sectors. Particles appeared dirty; reflections/lighting were promising.
Preparation, typed requests, unloading and quitting lacked sustained expressive
feedback. Startup was intrusive; Memory/Console presentation and Console wiring
needed review. Startup speech appeared unresponsive and typed responses could be
slow. Speech-driven motion/light stopped briefly into continuing spoken output.
Quit guidance was weak, Voice Off ambiguous, and Chromium offered translation.

This assignment does not rewrite membrane topology, redesign particles, change
palette/Flow, modernize STT/AEC or tune provider timeouts.

## Initial source validation

Executed with bundled Node, Vitest's Node environment, one worker, no file
parallelism, BelowNormal process priority. No graphical/audio fixtures:

- Four IV-B topology/deformation/contact/quality files: **20 tests passed**.
- Continuity, living-field/mock-resource and visual-input files: **24 passed**.
- The first Node shim invocation failed before test execution because no active
  nvm version was configured. The existing bundled runtime needed no install.

These checks do not compile GLSL or establish rendered quality, hardware cost or
owner acceptance. IV-B's historical source manifest remains unchanged.

## Playback boundary implementation

Output accepts at-most-20-ms PCM writes before an optional trusted observer
publishes correlated RMS/peak. The runtime no longer meters synthesis ahead of
that boundary; it marks delivery playing on the first accepted write. Output
drain remains distinct from model completion and final delivery completion.
Cancellation, active-generation and active-playback gates reject retained late
callbacks. Observer failures disable optional metering without failing speech.

The UI now tracks playback identity separately from conversational state. Source
inspection identified a concrete presentation gap: `RECOVERING` after
`INTERRUPTION_CANDIDATE` failed the old `prior === SPEAKING` predicate even with
ongoing delivery. Fresh real levels remain eligible through tentative input
recovery; cancellation, completion, failure, offline and successor turns retire
them. This establishes a software defect, not attribution of the owner's run.

Executed sequentially, BelowNormal, with no real services/devices:

- Three new adapter regressions failed before implementation; all **14** adapter
  tests pass afterward (mock streams only).
- **2** new fake-runtime tests pass: delayed acceptance, 180 pre-buffered PCM
  blocks including silence/quieter syllables, drain, late callback and Stop.
- **40** existing generation/voice-stream lifecycle regressions pass.
- **54** frontend reducer/input/reactivity tests pass, including zero reactivity
  and the new six-second delivery/recovery/quiet-syllable case.
- Targeted Ruff and Biome checks/formatting pass for these changed source/tests.

No physical speaker alignment is claimed: blocking PortAudio acceptance can lead
actual playback by device latency. Hardware timing, acoustic behavior and the
specific owner incident remain deferred. No arbitrary sustained visual envelope,
new PCM queue, raw-audio UI transport or provider timeout change was introduced.

## Lifecycle, controls and deferred evidence

To be completed with the remaining implementation and verification sequence.
