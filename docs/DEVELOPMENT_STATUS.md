# Release, development and future scope

2026-10-22 snapshot. This page separates the published source/Python alpha from
unreleased work; it does not change release artifacts, tags or version numbers.

## Published v0.2.5

Published commit: `dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`. The wheel, sdist and
checksums are the public artifacts. The released renderer has evolving regional
pigment and six attached swept sheets. Owner authentication, bounded capabilities,
reviewed local Memory, model/resource ownership, diagnostics and recovery foundations
are present. See [release notes](RELEASE_NOTES_0.2.5.md) and
[release evidence](RELEASE_READINESS_0.2.5.md).

Windows is the principal validated runtime path. Hosted Linux quality/package
checks passed, while Linux desktop/audio acceptance remains open. There is no
public Windows installer or signed native distribution. Typed interaction is the
safest starting route; real recognition, echo, interruption and response latency
retain disclosed limitations.

## Unreleased development

Verified pushed development snapshot: `2527ee278c0b12d4f05927495d4a9260d16b2b94`.
The v0.2.6+ label denotes an experimental development line, not a released version.
These implementation records live on `dev`, rather than being copied into the
released source tree as though the code shipped here:

- [Connected Visual Identity IV](https://github.com/AlfonsoFR2020/sam-ambient/blob/2527ee278c0b12d4f05927495d4a9260d16b2b94/docs/VISUAL_IDENTITY_IV.md)
  replaces the six sheets with a connected parent skin and three irregular openings.
  It is compiled and deterministically checked, but shader/rendered aesthetic,
  hardware cost and owner acceptance remain open. The owner saw v0.2.5 on October 21;
  praise of its swirls and criticism of its peels do not accept or reject IV-B.
- [Responsive Presence IV-C](https://github.com/AlfonsoFR2020/sam-ambient/blob/2527ee278c0b12d4f05927495d4a9260d16b2b94/docs/RESPONSIVE_PRESENCE_IVC.md)
  adds lifecycle expression, quieter startup/panels, Spoken replies wording and
  accepted-playback-write metering. PCM acceptance is not an acoustic timestamp.
  Layout, translation suppression and sustained physical speech response still
  need the appropriate evidence.
- [Conversation reliability V-A](https://github.com/AlfonsoFR2020/sam-ambient/blob/2527ee278c0b12d4f05927495d4a9260d16b2b94/docs/CONVERSATION_RELIABILITY_VA.md)
  protects typed waiting, cancellation, discovery retirement and pending delivery.
  Deterministic repairs do not establish the cause of real cold-start/typed stalls.

The ordinary source launcher serves the compiled assets of its checkout. Editing
frontend source alone does not rebuild them. A checkout pinned to v0.2.5 therefore
does not display the new parent skin or lifecycle UI.

## Recognition

v0.2.5 accepts explicit primary `en` / `es` or `auto`; preferred languages guide
uncertain automatic decoding and do not override a deliberate selection.
[V-B recognition integrity](https://github.com/AlfonsoFR2020/sam-ambient/blob/2527ee278c0b12d4f05927495d4a9260d16b2b94/docs/SPEECH_RECOGNITION_VB.md)
is unreleased. It seals utterances, retires PCM, rejects cancelled/foreign/provisional
results, bounds pre-roll by duration and safely normalizes common selectors such
as `en-GB` / `es-ES` / `es_ES` to primary codes. This does not select a regional
acoustic model or promise code-switch recognition. It does not replace whisper.cpp.

The historical generated-speech baseline's English 7.95% / Spanish 8.75% WER is
not natural owner speech. A later transcript-only re-score is not new decoding or
proof of V-B accuracy/latency gains. Real bilingual quality remains unresolved.

## Diagrams and acceptance

The [system diagram](diagrams/sam-system-architecture.svg) shows shared architectural
boundaries. The [development lifecycle](diagrams/sam-conversation-lifecycle.svg)
illustrates later implementation, including accepted-write visual observation.
Neither depicts LLM-owned OS/update privileges. ACK is not commitment/readiness;
completed text and optional delivery have separate lifetimes.

SVG/XML, generated-source agreement, links and source-level layout estimates can
be checked without rendering. These diagrams have not received rendered layout
or owner approval in this documentation pass. The new connected Orb also remains
graphically unverified. No beta is requested by publishing these explanations.

## Future direction

Broader OS/app integration, task delegation, generative interfaces, richer semantic
or multi-person context, alternative visual identities and controlled self-modification
remain future programmes. They require deliberate owner/policy/privacy design;
existing seams are not permission or claims of completed general desktop autonomy.
The original Sam identity and living-pigment direction remain the baseline.
