# Diagnostic launch and conversation evidence

Implementation checkpoints 1–3 — 2026-10-13. No version bump or release publication.

## Owner launch

`Start Sam.cmd` remains the ordinary one-action prepared-checkout launch. It uses
its existing environment, supervisor and sandboxed authenticated owner window;
no dependency installation, provider download or persisted default change.

Double-click `Diagnose Sam.cmd` for diagnostic mode. It delegates to the same
launcher, opens the normal Sam window and leaves the console available after exit
or failure. From PowerShell: `& ".\Diagnose Sam.cmd" --keep-model`, or
`uv run --no-sync sam-ambient --diagnostic --keep-provider`.

- `--diagnostic`: content-free operational console/log records and final summary.
- `--keep-model`: retain Sam-loaded models for this session; also retain their
  serving endpoint so stopping the service cannot defeat model retention.
- `--keep-provider`: retain Sam-started serving endpoints; model cleanup still
  follows ordinary preferences unless `--keep-model` is present.
- No flags: existing persisted cleanup preferences remain authoritative.

Controls continues to show saved cleanup preferences; diagnostic startup and cleanup
records show the session override and effective policy. Flags never write configuration
or lifecycle preferences. They apply at final
cleanup after live preference changes. Existing external services/models remain
externally owned. Retaining LM Studio serving is distinct from its desktop app;
Sam does not terminate a pre-existing desktop application.

## Log contract

The console prints the resolved `<checkout>/.sam/diagnostics/session.jsonl` path
at startup and completion. UTF-8 JSON Lines contain UTC wall time and monotonic
milliseconds, stage, bounded numeric metrics, controlled status/category fields
and hashed correlation identities. One supervisor writer rotates at 1 MiB with
three backups (about 4 MiB total); append across sessions. At most 100 records per
second per process; dropped records are counted. The session summary reports
exit code, elapsed time, failures/warnings and dropped records.

The core/UI use bounded diagnostic records on the existing supervised stdout
pipe. Readiness, owner bootstrap and shutdown protocols remain distinct; raw
stdout is never relayed to the log. There is no new network endpoint or authority.

Positive field selection excludes raw transcripts, model/token text, tool/memory
content, credentials, proofs, provider response bodies and PCM. Raw warning/error
messages become logger identity and severity rather than copied text. Diagnostic
mode deliberately does not provide unrestricted DEBUG exception dumps. This is
operational metadata, not anonymity: review times/paths before sharing logs.

Startup failure still prints a short error and session summary when the diagnostic
file was opened. If the root/environment/log directory is unavailable, the launcher
keeps the error console open; a log cannot be promised for an unwritable location.

## Evidence

41 focused launcher/rotation/redaction, supervisor, first-run and composed cleanup
checks pass using temporary data. Existing sandbox/authentication code is unchanged.
Conversation timing/ownership projection and its composed scenario follow in the
next checkpoint; this does not claim the beta's intermittent stall is solved.


## Conversation timing and ownership

A bounded read-only event projection at the runtime records existing voice state,
first partial/final presence (never text), committed user turns, generation/stream
terminal events, candidate retirement, delivery and component health. Command
owners record queued → dispatch → acknowledged/rejected/cancelled; protocol sending
is separately visible. A queue wait is not a provider wait or a frontend-rendering
measurement. Replay and late terminal events cannot retire a different request.

Generation-local context correlates the real HTTP transport's accepted response
headers with request/first-token/stream-complete records. Fake/non-HTTP adapters
cannot establish HTTP acceptance, so that event is absent rather than invented.
STT finalization records elapsed time and whether meaningful final text exists;
playback screening records suspected known-output echo. This is not AEC or a
classifier for every plausible hallucinated final.

The core emits `conversation.summary` with longest first-token wait, full stream,
STT finalization, command and delivery durations; endpoint resumptions; bounded
pending/nonterminal entries, dropped trace entries and active generation/delivery/
task counts after shutdown. Up to eight nonterminal operations include age and
hashed identities. Ongoing waits contribute to maxima even if they never finish.
There is no magic stall-reset timer. Detailed history caps at 256 entries and
pending projection at 128; eviction/drops are explicit. Meters and token contents
are not dumped frame by frame. UTC timestamps describe supervisor receipt; child
`source_ms` and explicit elapsed values preserve source monotonic timing.

### Synthetic scope and findings

One continuous 20 ms PCM journey uses actual runtime, event/command owners,
SQLite history and safe fake capture/STT/TTS/playback/provider boundaries. It covers
successive typed and two voice turns, endpoint resumption, subminimum noise,
hallucination-like partial superseded by empty final, STT failure then typed recovery
and explicit microphone reentry, copied-output playback overlap, a provider ignoring
cancellation until released, immediate typed replacement, late data and shutdown.
The tested noise/empty/known-output cases do not create bogus committed turns;
replacement text and completed answers remain available and owners retire cleanly.

The trace exposed a fixture error: exhausted queued silence did not imply endpoint
retirement; the fixture now waits for actual listening state. Correlation mapping
also needed to link successful generation terminals back to their originating
command. These are observability/fixture repairs, not proof of a new production
stall cause. The beta's minutes-long stall and plausible wrong final transcripts
remain unresolved. Synthetic PCM is not real-room/accent or human acceptance.


## Isolated application verification and current limits

One real supervised source session uses a fake provider, temporary state/memory,
audio disabled and the shipped headless sandboxed owner UI. Passive observation
attaches before navigation/authentication, without reloading or replacing the
socket. Authentication precedes private readiness; owner typing completes, Quit
correlates and core/UI stop without forced termination. Child command, first-token,
model terminal, conversation summary, cleanup and final supervisor summary all
reach the same rotating file. The configured cleanup preferences stay unchanged;
`--keep-model` takes precedence at final cleanup. No external model/service is touched.

The actual Windows wrapper missing-environment path fails visibly and pauses,
without launching Sam or installing anything. Startup failure, duplicate-instance
log ownership, rotation/rate/history limits, redaction, malformed child records and
injected log-I/O failure have focused coverage. A log that cannot be created cannot
provide persisted evidence; its console gives a short actionable error. Changing
filesystem policy, credentials, devices or installed provider software is outside
this task. No additional full application launch, physical audio or frontend art pass.

### Next priorities

Intermittent latency/false turns remain the highest reliability concerns; use the
new operational evidence before changing ownership. Serious multilingual STT and
Orb/membrane/palette/voice embodiment remain dedicated high-priority efforts. Keep
Windows packaging/Cargo and deferred pytest/setuptools/Linux GLib advisories visible
as separate maintenance. Agency/memory/browser/profile expansion stays parked.
Numerical tests are not owner perceptual acceptance. No next workstream starts here.


Final focused gate: **187 tests passed** across launch/privacy/retention,
configuration, owner authentication, provider bootstrap/ownership, command
correlation, supervisor/first-run, paced conversation, voice and generation
terminality, and HTTP transport. The separate actual supervisor/owner-window
session passed once (about five seconds), and was not relaunched by the final
suite. Ruff lint/format, release-version consistency and local documentation links
pass. No frontend source changes, dependency updates, release build or GitHub work.

Normal mode creates no persistent diagnostic file. Diagnostic mode is available
in this updated source checkout; older installed/staged cores may not understand
new flags. Do not bypass trusted version activation/rollback to force compatibility.
Actual-room latency/noise, real provider long-stream behavior and owner speech/art
acceptance remain future evidence, not claims made from these fixtures.
