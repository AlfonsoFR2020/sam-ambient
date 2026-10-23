# Orb appearance foundation — V-F1

2026-10-23. Isolated `feature/orb-appearance-foundation`, based on clean dev
`cc69bc2b90eac4068c929af4beb1bb95705b14af`. CPU/source engineering only; no
shader execution, rendering, performance or owner acceptance.

## Starting audit and compatibility checkpoint

V-E closure contains only its intended docs/evidence/assets. All 68 final source
inputs and five artifacts match its recorded clean `d8c376e` build. No source input
changed after that build. No V-E omission is established. Local `origin/dev` matches
`cc69bc2`; no remote query or mutation is needed for this assignment.

Before changing the renderer, a CPU test captures SHA-256 snapshots of the five
exported body/skin/particle-vertex shader strings, all tier skin arrays, ranges,
boundaries and packed descriptors at seed `0x5a17`. The initial capture referenced
a non-exported particle fragment by mistake; the fixture was corrected before any
renderer edit, and only the successful baseline capture is evidence.

`appearance.ts` owns closed, typed appearance/material definitions. `skin-strategy.ts`
owns a setup-only geometry/descriptors/equations/contact contract plus a CPU reference.
WebGL still owns programs, buffers, draws and cleanup. `VisualEngineOptions.appearance`
is an internal engineering seam, carried through quality rebuilds, with no saved
setting or owner selector. Unknown IDs fail explicitly; Canvas/static are shared
recovery, not an experimental-shape emulation. Diagnostics distinguish that path.

The default `living-connected` delegates existing connected skin mechanics without
changing equations, seed, topology, offsets, material or motion. The snapshot passes
after modularization. The initial focused batch has 26 passing compatibility,
engine/fallback and mock-resource cases; mock GL is not shader execution.

## Experimental scope

The next checkpoint implements one connected radial-sector skin, retaining broad
polar attachment and meridional bridges, irregular sector windows and a bounded
outward curl. It shares the displaced body and unit object-direction pigment space.
It remains internally selectable and is not the ordinary default. Final geometry,
resource arithmetic, regression results and known limitations follow on completion.
