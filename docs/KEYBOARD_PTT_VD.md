# V-D closure — public documentation and deliberate keyboard input

2026-10-23. Unreleased development; source/deterministic closure, not physical,
graphical or owner acceptance. This records the completed V-D scope and the final
cutoff recovery. It does not authorize another assignment.

## Git and recoverability

| Context | Starting state | Verified result |
| --- | --- | --- |
| Original checkout, `dev` | Clean `fdb371457d8d2b9494bebd52771d3afba32586cc` | Source at `231fb7da26b5d777cf50b65c5fe8e6df3285eb08`; closure commit adds this report, evidence and production assets |
| Existing public-docs worktree | Clean `74ab076b479380e97016c6a46e9c45c51f6a69e0` | Clean `50470506277b23324c5793e3ff0b920a6f7df21e`, pushed, draft PR open |
| Published `main` | v0.2.5, `dc64c5d180fb44cf7a29bf4d0d1ae2f853347709` | Same remote tip; no merge, version or release operation |

Dev recovery commits:

- `95882fa49f3f9e358b823cb9c69a6a115dce5511`: authenticated held-input ownership,
  final-recognition commitment and core regression foundation; diagram sync.
- `aca1977804e30cebfd366ac9807a5f399cc9e311`: opt-in F8 UI, capture cleanup lease,
  keyboard/focus tests, current contracts and requirement/backlog reconciliation.
- `231fb7da26b5d777cf50b65c5fe8e6df3285eb08`: retain cancellation ownership after
  release; quarantine presentation survives mute/unmute; final focused regressions.
- The subsequent closure commit contains generated assets and this evidence only;
  its hash is supplied by the final Git handoff rather than embedded in itself.

Remote `dev` was read-only verified at `2527ee278c0b12d4f05927495d4a9260d16b2b94`.
V-D does not push dev. The original checkout remains on dev throughout. The public
worktree remains separate; no public-docs merge/cherry-pick enters dev history.

The cutoff audit found dev at `aca1977`, with the release/blur patch and capture
quarantine assertion still uncommitted, and the first build's assets unstaged.
The preceding 83-test keyboard/client/reducer run had completed. Those edits were
reviewed, formatted and rechecked before `231fb7d`; the replacement build follows
that commit. No partial source edit or omitted intended file remains. Local Git
connectivity validation passes; both worktrees are checked clean at final handoff.

## Public diagrams, release claims and draft publication

The generator and both SVGs retain their graphite design and functional colours.
Corrections are semantic and bounded:

- Reviewed Personal Memory has a bidirectional dashed data connection to the
  trusted runtime for reviewed/scoped recall. Stored claims confer no authority.
  Operational Store remains separate; durable-history routing ends at that node.
- Runtime-to-voice synthesis/delivery and voice-to-runtime capture/STT evidence
  have distinct directed connections. Local speech input and output are separate.
- Provisional STT, response-stream and playback exceptions have dashed rose arrows
  into matching-work retirement, with distinct terminal ports. They do not join
  normal processing or confer a newer turn's ownership.
- Playback observations travel through the right gutter into Living Presence from
  above. The caption is outside that path. Crossings are not junctions.
- Stable node/edge identities and declared source/target endpoints support finite,
  orthogonal path, bounds and unrelated-node-intersection checks. Arrow markers use
  correct reversed start orientation for bidirectional edges.

Editable source: [generator](../scripts/generate_architecture_diagrams.py).
Outputs: [system architecture](diagrams/sam-system-architecture.svg) and
[conversation lifecycle](diagrams/sam-conversation-lifecycle.svg).
The lifecycle explicitly describes unreleased dev behavior; accepted PCM writes
are not physical acoustic presentation timestamps. No model-to-OS authority exists.

The release's actual `quality.ts` confirms **12 / 24 / 64** particle caps; the old
40-particle guide statement was corrected. The historical engineering specification
now explicitly defers its old source-of-truth/Linux-primary assertions to current
release/architecture records. Pinned development references are labelled historical
snapshots. Released v0.2.5, development v0.2.6+ and future ambitions stay distinct.
Original logo, Apache attribution, LICENSE, NOTICE and third-party notices are intact.

Public commits after V-C are `f82ad552de89cd8c61e0248f84292bd02eb5197f` (arrows and
release context) and `50470506277b23324c5793e3ff0b920a6f7df21e` (checker lint).
The latter is an ordinary follow-up, not rewritten history. From released main the
branch has three linear commits and **15 documentation/tooling paths**, individually
allowlisted. No runtime, UI, dependency, workflow, generated frontend or version
change is present. [Exact branch/file/CI proof](evidence/ptt-vd/public-docs-branch.json).

[Draft PR #7](https://github.com/AlfonsoFR2020/sam-ambient/pull/7) is pushed and open
against main at `5047050`. It is **not merge-ready**: Ubuntu quality fails unchanged
v0.2.5 test `test_committed_voice_turn_replaces_generation_waiting_for_first_output`
when a fast completed generation has already retired the live pointer. The failed
hosted run reports 1 failed / 657 passed / 44 skipped; these are not local counts.
Windows quality/native and CodeQL passed; package smoke was skipped. Dev's test
asserts the single correlated completed event instead. That test repair is not
ported to this documentation-only branch. No CI bypass, workflow change or rerun
campaign is used. The PR remains draft for owner review and separate CI resolution;
no additional publication command is needed. About/topics remain unchanged.

## PTT vertical slice and trust boundaries

[UX-11 contract](KEYBOARD_PTT.md): owner selects **Keyboard push-to-talk**, enables
the microphone separately, then **holds F8 and releases F8 to finish**. Default
ordinary input is preserved. F8 is window-local, avoids normal typing and existing
Sam shortcuts, and is blocked in editable/interactive fields, IME, hidden/unfocused
windows and modal operations. The Controls fieldset is focusable; status is text
and an accessibility announcement. Actual focus/assistive use remains unaccepted.

`disabled`, `ordinary`, `armed`, `starting`, `capturing`, `finalizing`, `submitted`,
`cancelled`, `failed` and `unavailable` project authoritative core state. Capture is
claimed only after actual PCM reaches the matching STT stream; command ACK is not
capture or recognition readiness. Fast release before confirmation cancels input.

Additive protocol-v1 mode/gesture commands use the existing private authenticated
dispatcher, current owner connection and session, exact payloads, canonical gesture
UUIDs, cancellation tokens and generation epochs. Preference is private metadata,
independent of microphone enablement; no schema migration or local-storage authority.
Thirty-two retired gestures and 30-second hold/finalization deadlines bound logical
input ownership. There is one capture lease and no extra audio stream or polling.

Release closes capture before final recognition. Pauses do not VAD-finalize a hold.
Only final nonempty matching recognition reaches TurnManager commitment; the route
freezes there. Ownership transfers before publisher backpressure and an expected
generation epoch prevents delayed handoff from replacing newer typing. Cancelled,
foreign and late recognition cannot commit; text recovery stays available.

Blur, visibility/focus loss, mode/language/mute changes, Escape, unmount, disconnect,
Emergency Stop, shutdown and superseding typed work discard unfinished input.
Post-release gesture tracking closes the release-to-finalizing gap: blur revokes a
queued finish or cancels pending final recognition. Exact rejected start admission
retires the hold without repeat-driven restart; old ACKs cannot retire a new gesture.

Repeated cancellation cannot let capture cleanup release its lease before the
existing sounddevice close worker finishes. Noncooperative retirement reports
unavailable even after rapid mute/unmute, blocks new capture and leaves typing usable.
Already committed text/response ownership is separate and is not undone by focus loss.
PTT during generation/playback is conservatively blocked; held-mode answers do not
open the ordinary barge-in microphone monitor. No AEC/full-duplex/acoustic privacy,
recognition-accuracy or physical-stop timing claim follows from these tests.

## Exact implementation areas

- `core/voice/push_to_talk.py`: single held-input capture/STT lifetime and finality.
- `runtime.py`: input ownership, authenticated command integration, cancellation,
  projection/leases and frozen generation handoff.
- `core/protocol/{models,control}.py`: additive typed commands/events and owner proof.
- `core/storage/sqlite.py`: validated private mode preference; no schema/dependency change.
- `core/turns/state_machine.py`: explicit LISTENING-to-COMMITTING final PTT transition.
- `adapters/audio/sounddevice.py`: retain close-worker ownership through repeated cancel.
- `ui/src/controls/push-to-talk.ts`: deliberate key lifetime, focus and terminal tracking.
- `ui/src/{App.tsx,styles.css}`, `controls/model.ts`, `protocol/types.ts`,
  `state/reducer.ts`: Controls, commands and authoritative projections.
- `tests/unit/{test_push_to_talk,test_sounddevice_audio,test_public_docs_checker}.py`,
  `tests/integration/test_voice_stream_lifecycle.py`, `ui/tests/push-to-talk.test.ts`:
  focused new tests and the event-based lifecycle assertion correction.

No geometry, material, palette, particle, shader or provider-routing algorithm changes
were made. The integrated connected skin/IV-C remain graphically unverified.

## Executed checks, failures and final assets

[Checks and per-file counts](evidence/ptt-vd/checks.json) record **189 distinct Python
passes** (174 core/adjacent/requirements/checker plus 15 disjoint original public-doc
cases) and **165 frontend passes** in 13 Node test files. Focused and release-profile
repeats are not added. All final cases passed, none skipped. The latest core batch
took 6.63 seconds; UI batch 6.81 seconds; one worker/process at a time, BelowNormal.
Ruff lint/format pass for 13 changed Python files, Biome for seven frontend files,
and `tsc -b --pretty false` passes. No full project suite was run locally.

Coverage includes en/es forwarding, fast release, duplicate finish, repeat, focus,
IME, mute, mode return, unavailable capture, owner/session replacement, exact command
rejection, bounded expiry, shutdown, cancellation and stale/noncooperative finals,
typed supersession/recovery, final-text commitment and immutable route handoff.
Fake PCM/STT outputs establish ownership behavior, not natural speech accuracy.

Reproductions caught missing PTT state transition, close-worker retirement, and
release/blur ordering defects; all received corrections and affected green reruns.
Setup-only failures included sandbox temporary-directory access, initial Node
temporary rename, nested Biome configuration when invoked from root, direct-script
instead of module invocation for the docs checker, and an inactive pnpm Node shim.
The final link check also caught the renamed backlog index anchor; the current
link was updated and the old anchor retained for historical links.
These were resolved using existing tools and repository-local process temporary
directories, with no install, OS setting, permission weakening or false pass count.

Two actual canonical production builds completed. The first at `aca1977` was
superseded after the final focus regression was reproduced; its hash proof is
[preserved](evidence/ptt-vd/frontend-assets-pre-focus-fix.json). The necessary second
build executes unchanged package script `tsc -b && vite build` with installed tools
and network disabled. No package-manager shim/toolchain is installed or reconfigured.
It completed in 3.77 seconds including type/build steps; Vite transformed 84 modules
in 761 ms without warnings. [Current asset proof](evidence/ptt-vd/frontend-assets.json):

- Source commit `231fb7da26b5d777cf50b65c5fe8e6df3285eb08`, source dirty **false**.
- 66 inputs, LF digest `01243fcf5ddd6a78656e629b8cce3b246242ba677e3743d00f5ecb71130127f9`.
- JS `index-Bi8MHRrM.js` (397.34 kB / 119.26 kB gzip), CSS `index-Nh1JMxRB.css`
  (20.22 kB / 5.32 kB gzip); generated manifest, HTML and build identity match.

The ordinary launcher still serves `src/sam_ambient/static`; it now includes PTT.
The shim failure compiled nothing. No build ran Sam, a provider, audio or browser.
The closure changes only documents/assets after that build, not its source inputs.

Release-profile audit resolves 102 local links in 18 pages and confirms the 15-path
release diff; its 14 checker tests pass again in the public worktree (not additional
distinct cases). The [final integrity proof](evidence/ptt-vd/closure-integrity.json)
checks 21 prominent dev pages plus five closure/contract pages. Both SVGs
match the generator byte-for-byte after LF normalization; XML, metadata, IDs, bounds,
directed endpoints, intersections and minimum declared contrast (6.64:1) pass.
SVG hashes are in the public branch proof. No font measurement, raster/layout
inspection or visual acceptance is claimed. External URL availability is not tested
by the file-only link checker; GitHub branch/PR facts were checked read-only.

## Retained requirements and next scope

All **66 identifiers**, all eleven future styles and original priorities remain.
UX-11 is implemented/deterministically verified, with physical/focus/accessibility
and owner acceptance open. CONV-08 remains separate future owner-selectable
aggressive/balanced/conservative policy; PTT neither exposes it nor changes acoustic
thresholds. The contract records only a possible reuse of preference/authority seams.

Next occupied-PC-safe candidate: a separately authorized **UX-08 session/resume/history
continuity** slice with deterministic reload/reconnect/failure coverage and explicit
preference semantics. Do not start it here. Future radial-shell topology stays a
separate recoverable feature-branch proposal; no branch or style engine is started.

Remaining v0.2.6 gates: compiled shader/visual and radial-shell/colour/pose proof,
UI/SVG and PTT key/focus acceptance, real devices/natural bilingual speech, provider
latency attribution, full delivery/interruption timing, representative cost and
inference coexistence, scarce owner acceptance and separately authorized release/
distribution checks. No graphical/provider/audio/human success, production readiness,
About/topics change, release, version bump, dev push or merge is implied.
