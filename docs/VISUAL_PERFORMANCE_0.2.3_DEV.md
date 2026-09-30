# Post-v0.2.3 visual performance sample

This is one isolated Chrome/WebGL2 measurement on the Windows development
desktop, after the speech, membrane and Living Surface changes. It is a cost
check, not a full Sam or representative mobile benchmark. No provider, model,
microphone, STT or TTS ran. Diagnostics was closed.

The opt-in browser harness in `ui/tests/browser/visual-performance.spec.ts`
can be run from `ui` by setting `SAM_VISUAL_PERF=1` for the focused Playwright
test. It stays out of the normal browser gate because timing is machine-specific.
The harness
renders 720×720 CSS pixels at each tier's DPR: 720² low, 1080² medium and
1440² high backing pixels. It warms for 20 frames, samples 70 requestAnimationFrame
draws per mode, and uses `EXT_disjoint_timer_query_webgl2` where available for
roughly 12 draw-time queries per mode. The extension was available and did not
report a disjoint result. The 8 ms median animation callback interval reflected
the host browser cadence, **not** Sam's own 24/30/60 FPS pacing policy.

| Mode | GPU draw median | CPU submission median / p90 |
| --- | ---: | ---: |
| Low | 0.045 ms | <0.1 / 0.1 ms |
| Medium | 0.179 ms | <0.1 / 0.1 ms |
| High | 1.815 ms | <0.1 / 0.1 ms |
| High, 24 membrane edge samples | 2.039 ms | <0.1 / 0.1 ms |
| High, body without membrane | 1.399 ms | 0.1 / 0.2 ms |
| High, synthetic output speech | 1.864 ms | 0.1 / 0.2 ms |
| High, synthetic input speech | 1.652 ms | 0.1 / 0.2 ms |

The browser's CPU timer was quantized near 0.1 ms, so these submission numbers
cannot establish finer JS cost. The GPU query covers this backend's commands,
not whole-app compositing or inference competition. Mode order, driver state and
short duration also limit close comparisons. The 24-sample variant uses the
**current** shader and is not a full pre-change build baseline. The measured
high membrane increment was about 0.4 ms against body-only; its extra edge
vertices were not an obvious regression. Audio modulation did not add a large
draw-time penalty. Low and medium remained much cheaper at their intended
detail and pixel budgets. All modes rendered without a WebGL error.

The existing v1 design target of under 4 ms desktop GPU work remains a useful
investigation guardrail, not a portable automated FPS assertion. A repeatable
isolated high-tier reading above roughly 3 ms, a several-fold membrane increment,
or audio states taking around 1.5× quiet high cost would warrant profiling
before further richness is added. Keep the tier budgets, four draws and noise
sample caps intact. Representative low-power hardware, sustained thermal load,
full-app contention and human visual acceptance remain unmeasured.
