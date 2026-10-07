# Using Sam

## Personal memory (post-v0.2.3 development)

Open **Memory** in Sam's authenticated owner window to deliberately store a fact,
preference or project context. Inspect its source/review state, correct it, approve
a proposed claim or permanently delete it. Memory is separate from chat history.
Use Personal scope across workspaces, or This workspace for project context.
Stored credentials are prohibited. The plaintext local database is
`%LOCALAPPDATA%/Sam/memory.sqlite3` on Windows; back it up only according to your
privacy needs. Deletion removes live content, not external backups/provider copies.
Sam selectively recalls reviewed Personal/current-workspace entries for relevant
local questions; it does not dump every entry into each prompt. A model's proposal
first asks permission to hold an **unreviewed** candidate; use **Approve claim** or
correct it in Memory before recall may use it. Rejected/unreviewed claims do not
become personal facts. Question-level cloud opt-in does not export stored memory.
Memory uses lexical matching, so paraphrases may not find a relevant entry yet.
If storage fails, text remains usable. Repair/restore the database without deleting
it automatically, then **Search / refresh** retries opening it. `sam runtime
--no-memory` disables it for a standalone core session; `--memory-db PATH` supplies
an isolated development/test store. Use expected revisions/refresh after a conflict.
See [memory semantics and limits](MEMORY_FOUNDATION_I.md).

Start with [Getting started](GETTING_STARTED.md). On Windows, double-click
[`Start Sam.cmd`](../Start%20Sam.cmd) in a prepared checkout. For terminal/debug
use, run `uv run --no-sync sam-ambient`. The dedicated Sam window proves owner
authority through its private supervisor binding; an ordinary browser tab cannot
authenticate or read private core state.
The integrated, unreleased Tauri source provides an owned native window with the
same React UI and protocol. Closing that window invokes the same in-app Quit
confirmation; it does not bypass supervisor shutdown or capability revocation.
Future packaged Windows builds use the bundled Python companion boundary and will
not require user Python or a checkout. The development owner window uses installed
Edge/Chrome; ordinary browser mode is an unauthenticated debugging surface.
Provider/model and speech prerequisites remain external and are reported through
the existing readiness experience. Native
packaging, signing, security-software review, and combined human acceptance remain
release gates; do not bypass security alerts to run unsigned native artifacts.

## Owner Console and bounded page inspection (post-v0.2.3 dev)

Open **Console** in the authenticated Sam window. Choose directory listing,
bounded text-file reading or system information. Paths are relative to Sam's
configured workspace; absolute paths and escapes are rejected. This surface does
not run PowerShell, accept executable commands or write files. It displays action
identity, progress/terminal status, cancellation and independent scrolling output.
Completed output stays separate from conversation history. At most four actions
run concurrently; the last 64 entries remain visible without evicting active work.

**Open public HTTPS page** takes an exact public URL. It creates a separate,
temporary, scripts-disabled browser context: no personal cookies/profile, owner
binding, downloads, forms, uploads or arbitrary JavaScript. **Read current browser
page** returns bounded title/URL/text; **Close owned browser** releases its process.
Private/local addresses and cross-origin redirects are blocked. Script-heavy sites
may not work. This is page inspection, not a general autonomous browser agent.

Models can propose registered structured tools. Workspace reads use the existing
owner read policy; model-requested navigation requires exact owner approval. The
owner's manual navigation action supplies that approval itself. Model prose and
returned file/web content never grant permission or become executable commands.
Cancellation stops delivery of retired action results; tool failure does not block
a new typed conversation. See [capabilities](AGENCY_CAPABILITIES.md) and
[browser boundaries](OWNED_BROWSER.md) for policy, privacy and output limits.

## Five-minute Windows path

1. Install Python 3.12+, uv, and LM Studio. In LM Studio, download a conversational
   chat/instruct model that fits your machine; embedding models cannot answer. If it
   is not already ready, load it and start the localhost server from **Developer**, or
   follow the UI/CLI procedure in [Getting started](GETTING_STARTED.md).
2. From the Sam checkout run `uv sync --locked` once, then double-click
   `Start Sam.cmd`. The launcher does not install dependencies.
3. Let Sam use a valid remembered model or the sole installed conversational model.
   If the startup picker appears, choose a model. Use **Rescan** after changing LM
   Studio. Sam may load an existing model but never downloads one.
4. Open **Controls**. Type in **Text request** and press **Send**. Enable
   **Microphone** and **Voice** only after the separate speech setup is ready.
   Wait for the model to finish loading: a requested/pending model is not an
   available inference route. Missing speech leaves typed conversation available.
5. Adjust Sam input/output gain and basic visual/profile settings in Controls.
   Use **Reload interface** for the UI only, **Restart Sam** for managed components,
   and **Quit Sam → Confirm quit** to stop. The safe exit defaults keep local models
   and services available.

Rust, Cargo, Tauri, Node, MSVC Build Tools, and the Windows SDK are development/build
requirements only. End users will not need them merely to run a packaged Sam build.

## Conversation and status

Open **Controls** for text input and settings. Type into **Text request** and
press Send once the local service reports an active conversational model. Send
stays unavailable while the service/model is unavailable; a current response
is not silently redirected to a different model during Rescan. Recent committed
turns survive reconnects/restarts. Transcript is
optional; final speech recognition remains provisional until Sam commits the
user turn. Interrupted assistant
content is marked rather than pretending all generated text was heard.

The discreet state label distinguishes Listening, Transcribing, Thinking and
Speaking. Microphone/Voice controls mute input/output. System-default devices
are used; voice requires the external speech dependencies described in Getting
started. Cancelling capture returns the listening state to idle; a speech-input
failure can be retried from **Conversation → Retry speech input** while an
already-running text response remains available. Real speaker-mode recognition and interruption reliability remain under
validation. Text mode remains useful when voice is unavailable.

Speech follows the assistant response language where there is enough text to
identify it; short ambiguous replies retain recent language context. Windows uses
installed voices only. The automatic persona prefers the installed gender with
the widest language coverage, then a matching locale/region. Explicit `tts_voice`
preferences are honored in their supported language and guide persona elsewhere;
missing persona/language fallbacks are reported. Missing language voices may use a different
language voice; nothing is installed automatically. INFO logs report the requested
language, selected voice/locale and fallback reason. eSpeak receives the requested
language; no cloud TTS service is connected.

**Conversation → Recognition language** saves Automatic / English / Spanish
locally. Change it while idle; an utterance or response in progress blocks changes.
The saved owner choice takes precedence over the launch default on later sessions.
Other language codes remain available through source configuration.
Recognition is independently configured: `[voice] stt_language = "es"` or `"en"`
forces that language through supervisor, capture/STT context and whisper.cpp.
The equivalent source-launch option is `--stt-language es`; `SAM_STT_LANGUAGE`
is available for session configuration. Default `"auto"` detects language;
`preferred_languages` only guides uncertain automatic decoding and is **not**
a hard language selection. This does not improve the capacity of the installed
base Whisper model or establish real Spanish transcription quality.

Open **Controls → System** for provider/model and STT/TTS status.
Speech health, recognition mode and the actual most recent voice are also shown
in **Conversation**. Enabled microphone/voice preferences do not prove that a
device/backend is working; degraded health is reported separately. Disconnected
status is explicitly last known.

Successful local
responses remember the provider/model in
`<root>/.sam/state.db`. Explicit CLI options override this preference; stale
preferences fall back deterministically. There is no model download or automatic
cloud switch. **Rescan providers/models** refreshes installed and loaded inventory
and can adopt a newly available configured/remembered model without restarting.
If several models are viable, the startup card asks for a provider/model choice
and can remember it after successful local use.
During Rescan, Sam shows that it is checking and temporarily disables another
Rescan. An empty or failed scan leaves the interface usable and offers a retry;
it does not silently keep a disappeared model selected. After disconnect, any
previously shown provider or model is labeled last known until the local service
reports fresh status.
Before core readiness, the main view says **Starting Sam**; after a core restart it
says **Reconnecting**. The startup card shows reported service, provider, model and
speech facts instead of a fixed progress checklist. The main view presents one
plain-language explanation; raw connection and setup errors are under **Technical
details** or **Diagnostics**. A render failure leaves a visible **Reload interface**
button. **System** keeps provider/model, speech, selected voice and privacy details.

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
the panel and returns focus. The **Conversation**, **Appearance**, **Device**,
**System** and **Diagnostics** categories keep voice interaction apart from visual
and performance settings. Transcript content scrolls within a bounded readable
region rather than covering the whole view. Expand provider details in **System**
for readiness and the last reported speech voice/locale, when core supplies it.
Reduced motion respects the OS preference (including changes while running) or the
local control. It freezes continuous geometry motion, retaining state/light feedback.

Development builds prefer a dedicated app window, separate from normal browsing.
Quit Sam or closing that dedicated window stops the application gracefully. On
other platforms or browser refusal, close the stopped page yourself. Closing a
normal `--ui-mode browser` tab does not stop Sam.

- **Microphone** controls listening; text input remains available while muted.
- **Voice** controls future spoken replies; text responses remain visible.
- **Stop speaking** is available during current speech and cancels only
  queued/current speech and playback.
- **Emergency stop** cancels current model, tools, queued speech and playback.
- **Disable all capabilities** revokes computer-action authority and pending
  approvals, preventing new tool execution. The model cannot restore authority.
- **Rescan providers/models** reruns bounded local discovery and model readiness.
  If LM Studio is running but its inventory temporarily fails, Sam makes at most
  four attempts with short backoff. Controls says it is waiting, rather than claiming
  no model is installed. Rescan can replace that recovery; Quit is always available.
  A successfully empty inventory is not retried automatically. A requested model
  becomes active only after the serving endpoint confirms it is loaded.
- **Restart Sam** asks for confirmation, revokes/cancels active work, and restarts
  managed Sam components without stopping externally owned model services.
- **Quit Sam** in Controls (or Ctrl+Q) asks for confirmation, then shuts down
  the application. Cancel/Escape backs out; keyboard focus starts on Cancel.
  After acknowledgement the page says **Sam has stopped** and does not reconnect.
  Closing a fallback browser tab alone leaves Sam running; Ctrl+C stops it.
- **Transcript**, **Reduced motion**, **Intensity**, and fullscreen are local
  presentation preferences, not permissions for the model.

**Appearance** provides motion, Surface Flow, visual intensity, audio reactivity, particle amount,
reduced motion and fullscreen. **Device** provides quality and performance profile.
**Particle amount** changes the visible share of particles in WebGL; the resolved
quality tier caps the budget at 12, 24 or 40. The Canvas fallback has no particles.
The Motion speed upper range is faster while its default is unchanged. It scales
several autonomous motions; Sam internally slows surface circulation while you
drag the Orb and eases it back afterward. **Surface Flow** separately moves and
deforms pigment territories; zero pauses transport while breathing, lights and
rotation continue. Default 60 retains the previous default circulation. Old saved
settings inherit their prior Motion speed once; reduced motion freezes both.
**2020 smartphone** deliberately
uses Sam's low-power mobile budget even on a desktop; **Auto** starts conservatively
and adapts only from measured render cost. These owner preferences survive interface
reload and Sam restart, while automatic quality decisions do not. Drag the orb with
a mouse or one finger to reorient it; reduced motion keeps direct reorientation but
suppresses inertial and autonomous movement.

In **System**, **Unload active model** releases the exact confirmed LM Studio
model while Sam is idle. Wait for confirmed completion; its service remains running.
The selected model is retained for **Load selected model**, which becomes active
only after provider confirmation. Explicit unload is your deliberate instruction
even for a preloaded model; automatic exit cleanup still affects only resources
Sam owns. Other adapters show this operation as unsupported. **Rescan** retains
normal bootstrap behavior and may reload the desired installed model.

The **Conversation** controls include **Microphone sensitivity** and
**Output volume**, each from 0-200% with 100% as the default. They adjust Sam's
application PCM signal, not the operating-system microphone or master-volume mixer.
Changes are committed when a pointer drag or keyboard adjustment finishes and persist
across interface reload and Sam restart.

The **System** controls also define what happens to local AI resources on a
graceful Quit. Both defaults are **Keep**. **Unload if Sam loaded it** applies only
to a model Sam successfully loaded during the current runtime scope and only where
the provider exposes a safe unload operation (currently LM Studio). **Stop if Sam
started it** applies only to a local service Sam successfully started. Existing,
shared, remote, and merely selected resources are left alone; rescanning does not
discard Sam's ownership of a resource it started or loaded. These are
best-effort bounded Quit actions: Restart and Emergency Stop never trigger them, and
a hard process crash cannot guarantee cleanup.
Controls and the Quit confirmation show whether the selected service/model is
eligible right now. If LM Studio and its model were already running when Sam
arrived, choosing both conditional options still leaves them running; close or
unload them in LM Studio yourself. Where eligible, Sam requests model unload
before stopping the service. A failed or unsupported cleanup does not hold Sam
open. “Stop” targets the LM Studio serving endpoint, not its desktop window.

Keyboard: **Ctrl+M** toggles the microphone outside text fields;
**Ctrl+Shift+X** performs Emergency stop even while a text field is focused;
**Ctrl+Q** opens quit confirmation even while a text field is focused; **Ctrl+R**
reloads only the interface and reconnects to the running core; **Escape** closes
the current Controls/dialog surface or exits fullscreen, never Sam. Reload does
not restart Sam or its model provider.

**Controls → Diagnostics** opens a scrollable status panel with the current core
connection, reported provider/model/STT/TTS/microphone state, speech-input health,
active turn/generation identity, renderer, quality,
frame estimate, visual phases, audio envelopes and recent events. Current health
and errors appear first; conversation and voice details follow, with renderer
details and the bounded event history available in disclosure sections. On wide
windows the history and diagnostics use separate independently scrolling regions;
on narrow windows diagnostics remains an overlay. It has a Close button and
closes when Controls opens. Ctrl+Alt+V is an
optional desktop shortcut. Missing readings are shown as unreported; this panel
does not measure server health, model memory or detailed audio spectra. When open,
meaningful events also appear in the browser/shell console without per-frame logs.

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
