<p align="center">
  <img src="sam-logo.png" alt="Sam" width="520">
</p>

# Sam

**An ambient AI presence for conversation, local intelligence and owner-controlled computing.**

Sam explores a computer you can work with through conversation: a living visual
presence, replaceable language and speech models, and capabilities governed by
trusted code. Its longer-term ambition is an AI-native interface to computing,
with the owner retaining control over data, actions and software changes.

**Published: [v0.2.5 experimental source/Python alpha](https://github.com/AlfonsoFR2020/sam-ambient/releases/tag/v0.2.5).**
The release contains a Python wheel, source archive and checksums. There is no
public Windows installer or signed native distribution. Windows is the principal
validated development/runtime path. Linux remains an important target: v0.2.5
passed its hosted Linux Python/package checks, while Linux desktop and physical
voice acceptance remain open. See the [release scope](docs/RELEASE_NOTES_0.2.5.md).

## What makes Sam different

- **A living presence.** The Orb combines evolving pigment, regional colour
  territories, flowing material, light and motion with real conversational
  signals. Reduced Motion, quality adaptation and Canvas/static recovery are
  part of the renderer's contract.
- **Local-first conversation.** Choose an exact provider and model. Each committed
  turn keeps its inference route; Sam does not silently substitute a cloud model
  or download models for you.
- **Conversation integrity.** Committed text, generation and spoken delivery have
  distinct lifetimes. Cancellation and recovery preserve completed answers, and
  typed input remains available when voice is unavailable.
- **Owner authority.** An authenticated private interface, capability policy,
  approvals and revocation govern bounded tools and Agency. A model does not own
  operating-system privileges or update authority.
- **Reviewed personal Memory.** Local, owner-managed entries have source/review
  information and correction/deletion controls. This is separate from operational
  recovery records and is not automatic retention of every conversation.
- **Recoverability.** A separate supervisor, durable committed text, diagnostics
  and staged update/rollback foundations keep the conversational runtime from
  becoming its own deployment authority.

![Sam system architecture: authenticated presentation, trusted core, services and private persistence](docs/diagrams/sam-system-architecture.svg)

*Control and authority use copper paths; data and presentation use blue paths.
The visual engine observes trusted state. It does not command models, devices or
tools. [Architecture and trust boundaries](docs/ARCHITECTURE.md) explain the
contracts; the [development lifecycle diagram](docs/diagrams/sam-conversation-lifecycle.svg)
shows recognition, committed turns and separate speech delivery.*

## Released, in development, and future

| Line | What it means |
| --- | --- |
| **Released · v0.2.5** | The published Python/source alpha: living pigment and six swept film sheets, authenticated owner window, local-provider management, conversation/cancellation foundations, reviewed Memory, bounded Agency and diagnostics. Voice input is experimental; typed use is the safest starting point. |
| **Development · v0.2.6+ on `dev`** | A connected parent skin, lifecycle expression, playback-boundary visual metering, conversation reliability repairs and recognition-integrity improvements. Deterministic tests and asset integration do not establish graphical, physical-audio or owner acceptance. |
| **Future** | Broader desktop agency, generative interfaces, expanded OS integration and controlled self-modification are roadmap ambitions, not completed product capabilities. |

The owner's positive assessment of the evolving swirls concerns the released
v0.2.5 renderer. The new connected skin still needs graphical and owner review.
Natural bilingual recognition, acoustic interruption/echo conditions and
real-session response latency also retain explicit acceptance limits. See the
[current state](docs/STATE.md), [roadmap](docs/ROADMAP.md) and
[known work](docs/BACKLOG.md).

## Try the published alpha on Windows

Use Python 3.12+, [uv](https://docs.astral.sh/uv/), Git and an installed Edge or
Chrome browser for Sam's isolated source application window. A local chat model
is required for answers; [LM Studio](https://lmstudio.ai/) is the principal
validated provider. Download a suitable chat/instruct model yourself, then follow
the [provider setup](docs/GETTING_STARTED.md#install-load-and-serve-a-model-with-lm-studio). No model is
bundled or downloaded automatically.

Pin the release rather than an unreleased development checkout:

```powershell
git clone --branch v0.2.5 https://github.com/AlfonsoFR2020/sam-ambient.git
cd sam-ambient
uv sync --locked
& ".\Start Sam.cmd" --no-voice --no-tts
```

This starts with typed interaction and speech disabled. The launcher uses the
prepared environment; it does not install dependencies. In **Controls →
Conversation**, use **Text request**. Check the selected model's actual readiness
before expecting an answer. Sam can prepare an installed, owner-selected local
model, and asks for a choice when several models are viable.

Sam opens a dedicated authenticated owner window. A localhost URL or ordinary
browser tab does not grant command authority. Closing that window stops Sam;
**Quit Sam** or **Ctrl+Q** requests graceful shutdown. See
[Getting started](docs/GETTING_STARTED.md), the [User guide](docs/USER_GUIDE.md) and
[owner authority](docs/OWNER_AUTHORITY.md) before enabling voice or tools.

| Provider path | Scope |
| --- | --- |
| **LM Studio / llmster** | Principal Windows validation path; explicit installed-model selection and bounded local preparation. |
| **Ollama** | Supported adapter and deterministic coverage; broader machine/runtime acceptance remains separate. |
| **OpenAI-compatible endpoint** | Explicit configuration only. Cloud use is opt-in; disabled fallback must not export local context. Reviewed Memory is not injected into cloud turns. |

Voice requires separately installed compatible whisper.cpp recognition and a
local speech backend. Windows uses installed System.Speech voices; Linux uses
eSpeak NG. English and Spanish recognition selections are explicit; real-world
mixed-language accuracy is not guaranteed. See
[speech prerequisites and limits](docs/GETTING_STARTED.md#voice-prerequisites)
and the [historical speech baseline](docs/SPEECH_BASELINE_2026-10-01.md).
For a content-free diagnostic launch, use
[`Diagnose Sam.cmd`](Diagnose%20Sam.cmd) and the
[diagnostic guide](docs/DIAGNOSTIC_LAUNCH.md).

## Explore and contribute

Node/pnpm is needed to rebuild the React frontend, not for ordinary use of
prepared assets. Native-shell development additionally needs Rust and the
platform toolchain; it does not imply a released native installer. Follow the
locked tool versions and commands in [Contributing](CONTRIBUTING.md) and the
[frontend guide](ui/README.md).

| Learn about | Start here |
| --- | --- |
| Setup, controls and recovery | [Getting started](docs/GETTING_STARTED.md) · [User guide](docs/USER_GUIDE.md) · [Troubleshooting](docs/TROUBLESHOOTING.md) |
| Architecture and ownership | [Architecture](docs/ARCHITECTURE.md) · [Owner authority](docs/OWNER_AUTHORITY.md) · [Editable diagrams](docs/diagrams/README.md) |
| Security and licensing | [Security](SECURITY.md) · [Third-party notices](THIRD_PARTY.md) |
| Development and configuration | [Contributing](CONTRIBUTING.md) · [Configuration example](config/sam.example.toml) · [Decisions](docs/DECISIONS.md) |
| Release and project direction | [v0.2.5 notes](docs/RELEASE_NOTES_0.2.5.md) · [Changelog](CHANGELOG.md) · [Roadmap](docs/ROADMAP.md) |

## License and attribution

Copyright 2026 Alfonso Ernesto de la Fuente Ruiz, PhD

Original Sam material is licensed under the Apache License, Version 2.0.
See [LICENSE](LICENSE), [NOTICE](NOTICE) and [THIRD_PARTY.md](THIRD_PARTY.md) for the
exact terms and retained third-party notices.

Sam is an independent project, inspired in part by the ambient-computing vision
portrayed in *Her*. It is not affiliated with the film or its creators.
