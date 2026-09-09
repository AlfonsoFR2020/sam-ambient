# Using Sam

Start with [Getting started](GETTING_STARTED.md). Launch from your workspace using
`uv run sam-ambient`; the browser is only a client, not the application's owner.

## Conversation and status

Open **Controls** for text input and settings. Type into **Text request** and
press Send. Recent committed turns survive reconnects/restarts. Transcript is
optional; provisional text differs from committed text and interrupted assistant
content is marked rather than pretending all generated text was heard.

The discreet state label distinguishes Listening, Transcribing, Thinking and
Speaking. Microphone/Voice controls mute input/output. System-default devices
are used; voice requires the external speech dependencies described in Getting
started. Real speaker-mode recognition and interruption reliability remain under
validation. Text mode remains useful when voice is unavailable.

Speech follows the assistant response language where there is enough text to
identify it; short ambiguous replies retain recent language context. Windows uses
installed voices only: exact locale, same-language regional fallback, then a
configured/system voice. Missing language voices may therefore use a different
language voice; nothing is installed automatically. INFO logs report the requested
language, selected voice/locale and fallback reason. eSpeak receives the requested
language; no cloud TTS service is connected.

Expand the provider/model line for selection reason and STT/TTS status, also
shown in Controls. Successful local responses remember the provider/model in
`<root>/.sam/state.db`. Explicit CLI options override this preference; stale
preferences fall back deterministically. There is no model download or automatic
cloud switch. Restart Sam after changing external services.

## Configuration and readiness

The supported TOML locations and precedence are documented in
[Getting started](GETTING_STARTED.md); CLI options win over environment,
workspace, user, and built-in values. Keep secrets out of TOML. Configuration is
user intent, while `.sam/state.db` contains learned last-good selection and
operational state. Run `sam doctor --root .` first when setup changes. READY means
usable now, AVAILABLE means Sam can use or start an existing local component,
and ACTION NEEDED identifies a concrete prerequisite. Voice failures may leave
text conversation usable, which doctor reports as degraded rather than fatal.

## Controls and safety

- **Stop speaking** requests cancellation of queued speech and playback.
- **Emergency stop** cancels current model, tools, queued speech and playback.
- **Disable all capabilities** revokes computer-action authority and pending
  approvals, preventing new tool execution. The model cannot restore authority.
- **Quit Sam** in the header or Controls asks for confirmation, then shuts down
  the application. Cancel/Escape backs out; keyboard focus starts on Cancel.
  After acknowledgement the page says **Sam has stopped** and does not reconnect.
  Closing the browser alone leaves Sam running; Ctrl+C in the console stops it.
- **Transcript**, **Reduced motion**, **Intensity**, and fullscreen are local
  presentation preferences, not permissions for the model.

Keyboard: **M** toggles microphone outside text fields; **Ctrl+Shift+X** emergency
stop; **Ctrl+Q** quit confirmation; **Escape** closes the overlay/fullscreen.

File access is constrained to authorized roots (`--root` selects the workspace).
Writes additionally need `--allow-workspace-write` and approval. Process requests
require approval and are **not an OS sandbox**. Review the tool, target/command,
working directory and risk before Allow; Deny/no response never authorizes it.
See [Security](../SECURITY.md). Capabilities remain revoked after crash recovery
or safe mode; model text cannot override this.

## When something fails

Read the startup console or run `uv run sam doctor --root .`. For more detail,
launch with `--verbose`. Missing voice dependencies leave text input/output;
missing a usable model prevents answers but not the UI and diagnostics.
See [Troubleshooting](TROUBLESHOOTING.md). Do not post sensitive conversation,
configuration or runtime database contents in public bug reports.
