# Responsive Presence IV-C

2026-10-21. In progress; source and focused non-graphical evidence only.

## Provenance and permission

- Starting `dev`: `99751258bbea30c03c7bb0f82021140364906cec`, clean,
  five commits ahead of cached `origin/dev`; no fetch or remote mutation.
- Released v0.2.5: `dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`.
- `Start Sam.cmd` runs the existing editable `.venv` launcher. The installed
  `_editable_impl_sam_ambient.pth` points to this checkout's `src` directory.
  `OwnerWindow` privately fulfills `src/sam_ambient/static` assets. Neither the
  launcher nor that window builds frontend source.
- The checked-in static tree is identical to v0.2.5. Its last change is
  `9c5bce8c63cb90bd008571e4c4b3a03f9663b1af`; `index.html` selects
  `index-DPoRgsL3.js` and `index-D5fV1sLu.css`. A normal source launcher run
  therefore displays the released renderer, not IV-B.
- `scripts/ui-dev.ps1` / `.sh` use Vite source. Tauri development uses Vite;
  Tauri packaging explicitly builds the static frontend. Either a development
  launch or an intervening frontend rebuild could display IV-B. The owner's
  actual beta launch path is unknown. Their observations cannot yet be
  attributed to IV-B.
- IV-C explicitly permits short, sequential focused tests and static lint at
  low scheduling priority. No Sam/application launch, provider/model, browser,
  GPU, audio hardware, full build/suite, packaging or network operations.

## Owner observations (not established root causes)

Preserve the attractive evolving colourful swirls. Peels appeared questionable,
with inward curls; the desired concept is radial shells cropped by radial
sectors. Particles appeared dirty; reflections/lighting were promising.
Preparation, typed requests, unloading and quitting lacked sustained expressive
feedback. Startup was intrusive; Memory/Console presentation and Console wiring
needed review. Startup speech appeared unresponsive and typed responses could be
slow. Speech-driven motion/light stopped briefly into continuing spoken output.
Quit guidance was weak, Voice Off ambiguous, and Chromium offered translation.

This assignment does not rewrite membrane topology, redesign particles, change
palette/Flow, modernize STT/AEC or tune provider timeouts.

## Initial source validation

Executed with bundled Node, Vitest's Node environment, one worker, no file
parallelism, BelowNormal process priority. No graphical/audio fixtures:

- Four IV-B topology/deformation/contact/quality files: **20 tests passed**.
- Continuity, living-field/mock-resource and visual-input files: **24 passed**.
- The first Node shim invocation failed before test execution because no active
  nvm version was configured. The existing bundled runtime needed no install.

These checks do not compile GLSL or establish rendered quality, hardware cost or
owner acceptance. IV-B's historical source manifest remains unchanged.

## Implementation and deferred evidence

To be completed with source changes, focused regression results, limitations and
the next authorized graphical/diagnostic verification sequence.
