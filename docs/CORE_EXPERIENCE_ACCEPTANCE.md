# Core Experience Consolidation I

This is the post-Memory Foundation baseline and evidence index for **Basics Before
Expansion**. Published v0.2.3 is unchanged. Automated evidence does not establish
human acoustic, voice-persona or visual acceptance. No human session is available.

## Baseline before consolidation (2026-10-01)

| Journey stage | Current implementation / evidence | Remaining or contradiction |
| --- | --- | --- |
| Start Sam | Source launcher → supervisor → private owner window; deterministic first-run/owner tests | Full current composition needs bounded smoke |
| Discover/select/load | Exact discovery, stale scan rejection, pinned routes, installed-model bootstrap; provider tests | Real current load/Rescan/outcome verification |
| Typed conversation | Retired generation ownership and independent pending-command release; multi-turn recovery tests | Current integrated runtime smoke |
| Capture/STT | Pull-based capture, bounded pre-roll, isolated health, local whisper.cpp | Automatic language preferences are not an explicit recognition language; base-model accuracy unaccepted |
| Voice/model turns | Commit-only transcripts, conservative pinned playback candidates, late-event rejection | Physical echo suppression/prompt barge-in remains unsolved |
| TTS/playback | Complete answer independent of delivery, separate health, iterator cleanup | Alphabetical language voice selection changes persona; inventory reports locale only |
| Orb response | Separate waveform levels → freshness adapter → AmbientReactivity → bounded form/light | Post-beta deterministic response exists; actual signal/render link and human acceptance are separate |
| Form/membrane/surface | High-tier smoothing, shared soft membrane field, evolving broad pigment territories | Human acceptance remains open; isolated performance only |
| Particles/Controls | Persisted particle amount scales quality budget; tab inventory/browser audit | Final authoritative speech/model state needs re-audit |
| Diagnostics/history | Independent wide-layout regions, hierarchy, bounded events; clean history/scroll | Preserve previous regressions |
| Unload/stop | Independent Sam-loaded/Sam-started ownership, runtime retirement before bounded cleanup | CLI exit status currently treated as success without a post-operation state probe |
| Exit | Idempotent runtime/capability/browser/memory retirement and supervised stop | Current composed shutdown/cleanup smoke |

## Scope and evidence rules

- Improve demonstrated defects in the existing journey; do not add agentic powers.
- Preserve conservative self-echo rejection and text as the recovery path.
- External providers/models remain external. Cleanup preferences authorize only
  Sam-owned resources; server stop does not mean closing LM Studio's desktop app.
- Real smoke uses installed components only, with isolated operational/memory data.
  Synthetic voice tests require no person or physical audio output.
- Park workspace mutation, richer browser automation, arbitrary shell, additional
  memory sophistication, profiles and multi-person integration until this matrix
  is sufficiently healthy.

Checkpoint results and final acceptance distinctions are appended here as evidence
is obtained, rather than inferring success from dispatched operations.

## Provider lifecycle checkpoint

- A new deterministic regression reproduced success reports when `lms` returned
  zero but the model/server remained present. Unload now re-probes the serving
  inventory; stop requires `lms server status` to confirm `running=false`.
  Missing/contradictory confirmation is a bounded failure, not success.
- 31 provider/bootstrap/route/discovery tests pass. Existing cleanup remains
  single-pass and ownership-scoped, with runtime retirement before cleanup.
- Real Windows check: LM Studio initially reported daemon/server stopped. Cold
  inventory first returned no model; a subsequent inventory exposed the existing
  `google/gemma-4-e2b` Q4_K_M. The normal Sam discovery/bootstrap loaded that exact
  model, a short text answer completed, and Rescan retained the exact route.
  Sam-loaded model unload was confirmed absent. Serving was already running at
  bootstrap, so server stop was correctly skipped; no external process was killed.
- The smoke's temporary-directory removal exposed a Windows operational-state
  SQLite handle still open after runtime close. Investigate in the shutdown
  checkpoint; this did not prevent generation, Rescan or model unload.

## Ordinary voice checkpoint

90 focused tests pass across capture/STT, conservative interruption, multi-turn
voice delivery, generation terminality and typed recovery. No new turn semantics
are required. Physical STT accuracy and early acoustic barge-in remain unproven;
the failed AEC prototype stays outside runtime.

## Recognition configuration checkpoint

`voice.stt_language` / `SAM_STT_LANGUAGE` / `--stt-language` now carry a validated
hard language (or default `auto`) through the normal supervisor and runtime to
the existing voice-stream context. Explicit en/es makes one forced whisper.cpp
request, with no automatic hypothesis or language retry. Preferences retain their
separate automatic-fallback meaning. Endpointing/base model are unchanged; the
beta's recognition accuracy cannot be attributed solely to configuration and
still needs a later physical evaluation after echo ownership is adequate.

## Voice-persona checkpoint

Windows inventory was read without speaking: Helena/es-ES female, David/en-US
male, Zira/en-US female, Hazel/en-GB female. Default selection now consistently
prefers the installed cross-language female persona; explicit configured IDs
remain honored and missing same-persona language support is reported. Existing
metadata without gender remains compatible. No synthetic voice claims timbre
or cadence equivalence. Actual synthesis selection is delivered reliably in the
first-PCM synthesis-health event (not a coalesced meter), with stale-delivery
rejection. 33 focused Python and 37 reducer tests pass; TypeScript and the shipped
frontend build pass. Physical listening/persona acceptance remains open.

## Embodiment connectivity checkpoint

No renderer/art-direction defect was demonstrated in this pass. Separate
`voice.level` / `tts.level` feed reducer metrics, independent freshness retirement,
AmbientReactivity, radial/material response and body/membrane shaders. The browser
regression now sends ordinary output RMS 0.04 through the actual reducer instead
of assigning a near-full-scale 0.7 sample directly to UI state.

At default audio reactivity, a fixed-camera Chrome/WebGL check measured 2,112
additional covered body pixels, mean central light gain 3.24 (8-bit channels),
radius change 0.017 Orb units and output pulse 0.212. An emphasis RMS 0.2 raised
the pulse to 0.445, still bounded. 80 focused visual/input/reactivity/quality tests
pass, including zero amount, separate receptive input, expiry/cancellation and
bounded values. These metrics do not prove perceptual acceptance.

High-tier fixed body/membrane coverage remained measurable: 3,317 changed pixels,
765 outside-body pixels, no WebGL error. Controls particle amount reached the
renderer and vertical interaction remained correct. Existing form/normal/shared
material representations are preserved; no geometry, shader/noise cost or palette
art-direction change was justified.

Seven bounded browser cases passed. Remaining fixed-orientation material checks
showed long-interval mean color change 29.57 versus adjacent-frame 1.20; membrane
tint agreement 0.985, palette delta 6.68, low/medium shader errors zero; particles
had exterior coverage without rear-body depth leaks. These establish continuity,
evolution and coherent shared rendering, not aesthetic success or low-power
full-app performance.
