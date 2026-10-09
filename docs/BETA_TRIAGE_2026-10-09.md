# October 9 owner beta — v0.2.4 closure triage

Source: complete HQ attachment `Texto pegado.txt`, its diagnostics/event dump and
the supplied Edge/Controls/history screenshot. No personal audio or full chat dump
is checked in. October 8 headless correctness was not physical/perceptual acceptance.
No second beta is available now; no release approval is inferred.

## Stage 1 — conversation and delivery

Three defects were reproduced and repaired:

1. **Unverified VAD cancelled generation:** THINKING allowed binary VAD to cancel
   a model without STT evidence, unlike SPEAKING. A deterministic candidate without
   any transcript reproduced cancellation. Both states now require credible
   transcript evidence; explicit Stop/cancel remains immediate. This can explain
   disrupted typed work but does not establish every reported stall's cause.
2. **Empty final commitment:** whitespace-only final STT could emit `turn.committed`.
   Paced speech-sized input + silence reproduced it. Empty finals now retire capture
   without committing, also at the existing maximum-duration boundary.
3. **Literal formatting / echo-screen evasion:** synthesis received Markdown, and
   repeated “asterisk” tokens evaded the known-output overlap guard. Delivery-owned
   `speech_text` removes common headings, emphasis, list/quote syntax, link targets
   and fence tags; history retains original formatting. The conservative screen
   also recognizes legacy spoken-formatting echo against a Markdown answer.

Endpoint/STT timing adds turn/cancellation identity and nonempty status, never
transcript content. Existing provider/first-output/completion/TTS timings remain.
No new arbitrary deadline, global microphone disable, raw PCM storage or AEC.
Focused regressions retain sequential turns, Stop/full answer, typed recovery,
short/sparse-noise rejection and bounded endpoint behavior. General plausible STT
hallucinations/typing noise and the minutes-long beta stall are **unresolved**:
the supplied LISTENING snapshot had no generation/zero pending commands, and lacks
correlated recognition/model/delivery timings. Do not claim those symptoms solved.

## Complete finding inventory

| Beta finding | Classification / bounded response |
| --- | --- |
| Edge chrome/translate UI, `--no-sandbox` | Confirmed source-launch security/presentation blocker; Stage 2 |
| Load ETA, off-centre card, brief startup motion pause | Deferred UX/performance; no fabricated ETA |
| Dynamic but polygonal/dull Orb, absent peels, abrupt breathing | Visual human acceptance failed; deferred visual pass, no retuning here |
| Typing/noise opens voice, unsolicited monologue | Unverified VAD cancellation fixed; plausible wrong STT commitment remains unresolved |
| Console/Memory appearance, sparse memory | Deferred; sparse reviewed memory is intentional, no automatic chat learning |
| Language confusion/errors | Real-speech/base-model limitation; explicit en/es retained; major STT work deferred |
| Recognition dropdown/label unusable | Confirmed screenshot presentation defect; Stage 2 |
| Spoken “asterisk” and self-transcription | Formatting and demonstrated screen evasion fixed; not AEC |
| Long reply stops, typed/voice delay then recovery | VAD cancellation fixed; exact stall/delivery cause unresolved |
| Gemma self-identity, proposed persona/system-prompt editor | Deferred product identity/context work; no new editor |
| Controls tabs/scrollbar | Confirmed presentation defect; bounded sticky navigation/style repair |
| Fullscreen and resize blank space | Owner-browser app/fixed-viewport investigation; not shader tuning |
| Slider ranges, palette/bulginess/wireframe/tooltips/tab grouping | Deferred visual/UX; no new shader controls |
| Reload Interface erases chat | Unresolved session/presentation observation; no speculative store rewrite |
| Detached voice embodiment | Human acceptance failed; retain numerical evidence only |
| Diagnostics access/layout awkward but useful | Deferred polish; repeated endpoint transitions do not alone identify noise or STT delay |
| Three attempts for spoken interruption | Known conservative alpha limitation; acoustic research parked |
| Quit ejects model, LM Studio remains | Model cleanup physically confirmed; distinguish desktop app from serving endpoint/ownership |

## Closure boundary

Conversation integrity and launcher security are not waivable alpha polish.
Version stays 0.2.3 pending essential gates. Native authenticated smoke, actual
driver/notices, installed SQLite/upgrade behavior, hosted gates and signing remain
independent requirements. Further stage evidence follows here; historical beta and
negative acoustic records remain. [Release decision](RELEASE_READINESS_0.2.4.md),
[acceptance matrix](CORE_EXPERIENCE_ACCEPTANCE.md) and [roadmap](ROADMAP.md) own scope.
