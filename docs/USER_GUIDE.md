# Using Sam

Start with [Getting started](GETTING_STARTED.md). Launch from your workspace using
`uv run sam-ambient`; the browser is only a client, not the application's owner.
The integrated, unreleased Tauri source provides an owned native window with the
same React UI and protocol. Closing that window invokes the same in-app Quit
confirmation; it does not bypass supervisor shutdown or capability revocation.
Future packaged Windows builds use the bundled Python companion boundary and will
not require user Python or a checkout. Browser mode remains a supported fallback.
Provider/model and speech prerequisites remain external and are reported through
the existing readiness experience. Native
packaging, signing, security-software review, and combined human acceptance remain
release gates; use the supported browser mode rather than bypassing a security alert.

## Five-minute Windows path

1. Install Python 3.12+, uv, and LM Studio. In LM Studio, download a conversational
   chat/instruct model that fits your machine; embedding models cannot answer. If it
   is not already ready, load it and start the localhost server from **Developer**, or
   follow the UI/CLI procedure in [Getting started](GETTING_STARTED.md).
2. From the Sam checkout run `uv sync --locked`, then `uv run sam-ambient`.
3. Let Sam use a valid remembered model or the sole installed conversational model.
   If the startup picker appears, choose a model. Use **Rescan** after changing LM
   Studio. Sam may load an existing model but never downloads one.
4. Open **Controls**. Type in **Text request** and press **Send**. Enable
   **Microphone** and **Voice** only after the separate speech setup is ready.
5. Adjust Sam input/output gain and basic visual/profile settings in Controls.
   Use **Reload interface** for the UI only, **Restart Sam** for managed components,
   and **Quit Sam → Confirm quit** to stop. The safe exit defaults keep local models
   and services available.

Rust, Cargo, Tauri, Node, MSVC Build Tools, and the Windows SDK are development/build
requirements only. End users will not need them merely to run a packaged Sam build.

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
cloud switch. **Rescan providers/models** refreshes installed and loaded inventory
and can adopt a newly available configured/remembered model without restarting.
If several models are viable, the startup card asks for a provider/model choice
and can remember it after successful local use.
Before core readiness, the main view says **Starting Sam**; after a core restart it
says **Reconnecting**. Degraded notices state what remains usable. Controls keeps
the detailed provider/model, speech input, spoken output, selected voice, and
local/cloud policy so the main ambient view stays quiet.

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

The warm light field is the main view. Listening opens its shape; transcription
gathers it; thinking uses folded motion; speaking responds to output amplitude.
The discreet text label remains the authoritative accessible state indication.
Controls recede at the lower edge but remain visible and focusable; Escape closes
the panel and returns focus. Transcript content scrolls within a bounded readable
region rather than covering the whole view. Expand provider details inside Controls
for readiness and the last reported speech voice/locale, when core supplies it.
Reduced motion respects the OS preference (including changes while running) or the
local control. It freezes continuous geometry motion, retaining state/light feedback.

Development builds prefer a dedicated app window, separate from normal browsing.
Quit Sam or closing that dedicated window stops the application gracefully. On
other platforms or browser refusal, close the stopped page yourself. Closing a
normal `--ui-mode browser` tab does not stop Sam.

- **Microphone** controls listening; text input remains available while muted.
- **Voice** controls future spoken replies; text responses remain visible.
- **Stop speaking** cancels only queued/current speech and playback.
- **Emergency stop** cancels current model, tools, queued speech and playback.
- **Disable all capabilities** revokes computer-action authority and pending
  approvals, preventing new tool execution. The model cannot restore authority.
- **Rescan providers/models** reruns bounded local discovery and model readiness.
- **Restart Sam** asks for confirmation, revokes/cancels active work, and restarts
  managed Sam components without stopping externally owned model services.
- **Quit Sam** in Controls (or Ctrl+Q) asks for confirmation, then shuts down
  the application. Cancel/Escape backs out; keyboard focus starts on Cancel.
  After acknowledgement the page says **Sam has stopped** and does not reconnect.
  Closing a fallback browser tab alone leaves Sam running; Ctrl+C stops it.
- **Transcript**, **Reduced motion**, **Intensity**, and fullscreen are local
  presentation preferences, not permissions for the model.

The **Display** controls also provide visual quality, a performance profile,
motion, audio reactivity, and particle amount. **2020 smartphone** deliberately
uses Sam's low-power mobile budget even on a desktop; **Auto** starts conservatively
and adapts only from measured render cost. These owner preferences survive interface
reload and Sam restart, while automatic quality decisions do not. Drag the orb with
a mouse or one finger to reorient it; reduced motion keeps direct reorientation but
suppresses inertial and autonomous movement.

The **Conversation & voice** controls include **Microphone sensitivity** and
**Output volume**, each from 0-200% with 100% as the default. They adjust Sam's
application PCM signal, not the operating-system microphone or master-volume mixer.
Changes are committed when a pointer drag or keyboard adjustment finishes and persist
across interface reload and Sam restart.

The **Application** controls also define what happens to local AI resources on a
graceful Quit. Both defaults are **Keep**. **Unload if Sam loaded it** applies only
to a model Sam successfully loaded during the current runtime scope and only where
the provider exposes a safe unload operation (currently LM Studio). **Stop if Sam
started it** applies only to a local service Sam successfully started. Existing,
shared, rescanned, remote, and merely selected resources are left alone. These are
best-effort bounded Quit actions: Restart and Emergency Stop never trigger them, and
a hard process crash cannot guarantee cleanup.

Keyboard: **Ctrl+M** toggles the microphone outside text fields;
**Ctrl+Shift+X** performs Emergency stop even while a text field is focused;
**Ctrl+Q** opens quit confirmation even while a text field is focused; **Ctrl+R**
reloads only the interface and reconnects to the running core; **Escape** closes
the current Controls/dialog surface or exits fullscreen, never Sam. Reload does
not restart Sam or its model provider.

File access is constrained to authorized roots (`--root` selects the workspace).
Writes additionally need `--allow-workspace-write` and approval. Process requests
require approval and are **not an OS sandbox**. Review the tool, target/command,
working directory and risk before Allow; Deny/no response never authorizes it.
Configured local MCP tools follow the same rule: their server is an executor,
not an authority, and returned content is untrusted data. Emergency Stop and
capability revocation cancel or block external calls just like native tools.
See [Security](../SECURITY.md). Capabilities remain revoked after crash recovery
or safe mode; model text cannot override this.

## When something fails

Read the startup console or run `uv run sam doctor --root .`. For more detail,
launch with `--verbose`. Missing voice dependencies leave text input/output;
missing a usable model prevents answers but not the UI and diagnostics.
See [Troubleshooting](TROUBLESHOOTING.md). Do not post sensitive conversation,
configuration or runtime database contents in public bug reports.
