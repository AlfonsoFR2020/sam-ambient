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

## Controls checkpoint

The existing tab inventory remains intact: Conversation (text, microphone,
speech output, Stop speaking, gains, transcript), Appearance (intensity, motion,
reactivity, particle amount, reduced motion, fullscreen), Device (quality/profile),
System (exact provider/model, Rescan, restart, ownership-scoped exit preferences,
Quit), Diagnostics (opening status). Agency/Memory surfaces are preserved without
expansion. Recognition/effective voice/health are now also visible in Conversation
using the same core-confirmed fields as System. An enabled capture preference is
not presented as proof of functioning hardware; disconnected facts are last known.
Recognition language and voice preference remain normal source configuration,
not new live-setting commands. 65 focused frontend tests and one new Chrome status
case pass, including STT failure with typed Send still enabled.

## Startup/shutdown checkpoint

The real smoke exposed an operational conversation-state handle leak:
`sqlite3.Connection` context exit commits/rolls back but does not close. Short
SQLiteSessionStore operations now explicitly close on both success and exception,
without waiting for garbage collection/process exit. A failing regression held
strong references to every connection; after repair they are closed, rollback
preserves prior state, and Windows can remove the database immediately. 54
focused state/context/provider/generation/first-run shutdown tests pass.
Durable memory already uses per-operation closed connections; no memory features
or schemas changed. Runtime still revokes authority, retires active work and
closes speech/browser/bridge/provider resources before configured provider cleanup.

## Composed core-experience simulator

One real runtime/owner WebSocket/voice pipeline/PCM output/state/memory-init path
now exercises typed → voice → STT failure → typed recovery → Rescan → Quit.
Only the external provider, capture, recognizer, synthesis and output device are
synthetic; microphone frames remain continuous and paced, including silence.
Three complete answers retain clean user/assistant roles. Shutdown is idempotent,
revokes the owner, closes speech/output tasks, then confirms model unload before
provider stop through the existing cleanup adapter.

The same emitted core events pass through the actual frontend reducer, Controls,
history and AmbientReactivity in isolated Chrome. Output pulse is nonzero/bounded,
effective voice and degraded STT are visible, and all six committed history items
retain separate roles and content. The mounted WebGL renderer remains alive; the
separate fixed-camera regression establishes geometry/light response. No physical
audio, real inference or advanced agency/memory behavior is used by this simulator.

## Normal integrated runtime checkpoint

The normal supervisor launched its real core/UI subprocesses and private owner
window, with isolated state and app-data memory. The existing LM Studio server
was running with no loaded model; normal bootstrap loaded `google/gemma-4-e2b`.
Three short typed turns completed (request-to-completion approximately 1.39 s,
1.28 s and 0.16 s; not a benchmark). Rescan reached terminal state with that exact
route, all three committed answers remained, and no page exception occurred.
Quit returned zero, closed the owner browser/revoked authority, and confirmed the
Sam-loaded model absent. The pre-existing serving process was correctly preserved.
No provider stop of an externally owned resource was attempted.

The first smoke attempts exposed a real snapshot defect: a configured model was
reported as current while its unavailable reason still blocked generation. Ready
snapshots now report no available model/provider until bootstrap confirms them;
requested/loading identity remains separate. A parameterized regression includes
the explicit configured-model case previously absent from the pending-model test.
The smoke also reproduced the operational SQLite handle leak in SupervisorStore;
it now explicitly closes short transactions, preserving rollback. A fixture selector
error was corrected without changing product behavior. The corrected session passed
and removed its isolated temporary state without a Windows sharing violation.

Microphone and physical playback were disabled for this normal session. Separately,
actual System.Speech generated 87 PCM frames per short en/es phrase; metered peaks
were 0.702/0.771, with Hazel/en-GB and Helena/es-ES (both female). PCM was consumed
without sending it to speakers. This proves synthesis initialization/selection and
nonzero waveform, not capture/STT accuracy, sound timing or persona quality. Normal
speech event-to-render behavior is protected by the composed synthetic/browser path.

Two older Quit regressions still assumed the pre-owner-proof protocol. The final
gate exposed their missing handshake and outdated consumer signature. Fixtures
now authenticate through the shared helper and supply an OwnerConnection; 33
first-run/authority tests pass. Product authorization was not weakened or changed.
