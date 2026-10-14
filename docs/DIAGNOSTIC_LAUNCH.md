# Diagnostic launch and conversation evidence

Implementation checkpoints 1–3 — 2026-10-13. No version bump or release publication.

## Unified owner launch (2026-10-14 development)

`Start Sam.cmd` is the single prepared-checkout launch path: ordinary double-click
uses existing preferences, supervisor and sandboxed authenticated window, without
installing dependencies. Successful normal exit closes its console as before.
`Diagnose Sam.cmd` is only a tail-delegating `--diagnostic` preset. Both invoke the
same Python parser and supervisor; no first-argument inspection or duplicated
startup/option logic. Tail delegation avoids CALL's extra argument expansion.

| Flag | Exact session semantics |
| --- | --- |
| `--help` / `-h` | Print shared options; no configuration load, service or UI startup. |
| `--verbose` | Extra allowlisted operational console records and Sam logger severity/category metadata; no raw DEBUG message dumps and no file implied. |
| `--keep-console` | Wait for Enter after an interactive launch finishes, independent of verbosity/file logging. Piped/noninteractive input never blocks. |
| `--no-keep-console` | Override diagnostic preset's successful-exit hold. Windows wrapper failures still pause so errors remain readable. |
| `--log-file PATH` | Enable rotating JSONL at that file without implying verbosity or a successful-exit hold. Relative paths resolve against effective Sam root, not the log's parent. |
| `--diagnostic` | Preset: bounded operational evidence, default `<root>/.sam/diagnostics/session.jsonl`, and an interactive console hold unless explicitly overridden. |
| `--keep-model` | Keep Sam-loaded models for this session; imply endpoint retention so model retention is not defeated by shutdown. |
| `--keep-provider` | Keep Sam-started serving endpoints; model cleanup independently follows saved/live preferences. |

Examples from PowerShell (quotes also work in Command Prompt):

```powershell
& ".\Start Sam.cmd" --verbose --keep-console
& ".\Start Sam.cmd" --keep-model --verbose --log-file ".sam\diagnostics\session.jsonl"
& ".\Start Sam.cmd" --keep-provider --keep-console
& ".\Start Sam.cmd" --log-file "logs with spaces\session.jsonl"
& ".\Diagnose Sam.cmd" --verbose --keep-provider
& ".\Start Sam.cmd" --diagnostic --no-keep-console
& ".\Start Sam.cmd" --help
```

`sam-ambient` and `sam-supervisor` use the same options. Flags can occur in any order.
The mutually exclusive console switches reject contradictory input; unknown and
abbreviated flags, missing/empty paths and directory targets fail with guidance.
Repeated value options use argparse's last value. Required operational INFO records
remain available in bounded diagnostic mode; `--verbose` adds category metadata
and takes precedence over `--log-level`. Normal mode retains its existing log level.

### Precedence, ownership and console failure behavior

For supported application/provider settings: explicit CLI > environment > explicit
TOML > project TOML > user TOML > defaults, as before. Launcher-only switches have
no saved-setting/environment counterpart. Explicit `--log-file` overrides the
preset's path; explicit console choice overrides the diagnostic preset. No logging
flag implies retention. At final cleanup, retention flags override the current
saved/live cleanup policy without rewriting it. `--keep-model` implies provider
retention; the converse is false. Controls still describes persisted preferences.

An endpoint is distinct from the LM Studio desktop application. Existing external
model/service ownership is unchanged. These flags do not authorize killing an
external process or keeping a service's desktop application alive by force.

The Python path owns success/explicit-console holding. `Start Sam.cmd` owns error
pausing, including missing environments/executable failures. A scoped internal
`SAM_CMD_WRAPPER=1` marker prevents a double pause; it is not a saved preference.
Direct Python/console entry points honor `--keep-console` on runtime failure when
interactive. Windows wrapper parse/startup failures remain readable regardless of
flag order. Ctrl+C/EOF at the final prompt exits without restarting anything.

## Log contract

The console prints the resolved default or explicit JSONL path
at startup and completion. UTF-8 JSON Lines contain UTC wall time and monotonic
milliseconds, stage, bounded numeric metrics, controlled status/category fields
and hashed correlation identities. One supervisor writer rotates at 1 MiB with
three backups (about 4 MiB total); append across sessions. At most 100 records per
second per process; dropped records are counted. An OS-released sidecar lock guards
each file against a second writer; a stale lock file cannot block a later session.
The session summary reports
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

Normal and verbose-only modes create no persistent diagnostic file. Diagnostic mode is available
in this updated source checkout; older installed/staged cores may not understand
new flags. Do not bypass trusted version activation/rollback to force compatibility.
Actual-room latency/noise, real provider long-stream behavior and owner speech/art
acceptance remain future evidence, not claims made from these fixtures.

## 2026-10-14 composable implementation checkpoint

55 focused argument/console/precedence/retention, diagnostic privacy/rotation and
first-run checks pass, plus changed-source Ruff lint/format and Git whitespace.
Windows wrapper execution and the broader focused authority/process/cleanup gate
follow as the independent verification checkpoint. No real provider/audio/UI run
is needed for argument composition. Existing earlier real evidence above is historical.

## 2026-10-14 verification closure — source launcher ready for v0.2.5

**152 focused tests pass** across composable flags, Windows wrappers, diagnostic
logging/privacy/rotation, configuration precedence, first-run, provider bootstrap
and owner model lifecycle, process supervision/failure injection, owner authority
and authenticated WebSocket admission/replay/revocation. Changed-source Ruff
lint/format, local documentation links and Git whitespace checks pass.

Five actual Windows CMD checks use temporary checkouts with spaces, the existing
console entry point, a minimal non-secret environment and an injected fake
`_run_locked`. Every invocation also includes `--status`, so even a missing test
hook cannot launch components. CREATE_NO_WINDOW keeps them invisible. They verify
both launchers, reordered/composed flags, model names and log paths containing
spaces, quoted ampersands, private startup failure summaries, unknown arguments
and failure-console retention. The first test-harness quoting attempt failed
before invoking the launcher; correcting Windows CreateProcess/CMD quoting made
the tests pass, without changing working product logic for that harness failure.

Controlled TTY unit cases verify successful/direct-failure holds, diagnostic
preset override and noninteractive behavior. These do not claim visual observation
of an interactive Explorer double-click. No Sam window, real model/provider,
STT/TTS/audio/device, native package or release build was launched. Existing owner
sandbox/bootstrap and shutdown mechanisms are covered by focused regressions;
no new visible owner-window smoke was necessary for this CLI-only slice.

The explicit log file is owned by the parent, children receive only bounded pipe
flags, and log creation failure releases both locks before components start.
Rotation/rate/record limits remain; verbose cannot copy private DEBUG messages or
HTTP bodies into the log. Option-looking values do not accidentally enable modes.
Retention cases preserve existing external resources and independent model/service
cleanup; settings source bytes remain unchanged. No beta reliability defect or
Windows installer/toolchain problem is declared fixed by launcher validation.

Ready for inclusion in the next v0.2.5 development/source increment. No version
metadata or release artifacts changed. Packaged/older staged components were not
rebuilt; use coherent trusted component versions, not an activation bypass. Security
maintenance, v0.2.5 release preparation, STT and reference-led visual work stay
separate. All commits from this launcher task remain local.
