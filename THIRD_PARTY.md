# Third-party software

This inventory records dependencies, external services, and any copied code.
Versions are pinned by `uv.lock` or `ui/pnpm-lock.yaml` where applicable.

| Name | Version | License | Source | Purpose | Integration | Notices |
| --- | --- | --- | --- | --- | --- | --- |
| uv | 0.9.26 (bootstrap environment) | MIT OR Apache-2.0 | https://github.com/astral-sh/uv | Reproducible development environment | External developer tool | None |
| CPython | 3.12.11 / 3.14.2 available at bootstrap | Python-2.0 | https://www.python.org/ | Runtime/toolchain | External runtime | PSF license applies |
| HTTPX | 0.28.1 | BSD-3-Clause | https://github.com/encode/httpx | Async HTTP, streaming, timeouts, connection pooling | Runtime dependency | Retain BSD notice |
| websockets | 17.1 | BSD-3-Clause | https://github.com/python-websockets/websockets | Bounded localhost development bridge | Runtime dependency; no required transitive packages | Retain BSD notice |
| sounddevice | 0.5.6 | MIT | https://github.com/spatialaudio/python-sounddevice | Fixed-frame microphone capture and playback | Runtime dependency | Retain MIT notice; Windows wheel also contains PortAudio binaries |
| PortAudio | V19.7.0-devel in current Windows wheel | MIT | https://github.com/PortAudio/portaudio | Native audio device transport used by sounddevice | Transitive native runtime | Retain MIT notice |
| Steinberg ASIO SDK artifacts | Upstream sounddevice Windows wheel variants | Proprietary SDK terms | https://www.steinberg.net/developers/ | Optional ASIO-enabled PortAudio DLL variants | Inactive upstream wheel artifacts; Sam does not set `SD_ENABLE_ASIO` | Exclude from a redistributable Sam bundle unless separately reviewed and approved |
| webrtcvad-wheels | 2.0.14 | MIT wrapper; BSD-3-Clause WebRTC VAD | https://github.com/daanzu/py-webrtcvad-wheels | Proven local VAD | Runtime dependency with native extension | Retain MIT and embedded WebRTC BSD notices |
| CFFI | 2.1.1 | MIT-0 | https://github.com/python-cffi/cffi | sounddevice native binding | Transitive runtime dependency | Retain MIT-0 notice |
| pycparser | 3.0 | BSD-3-Clause | https://github.com/eliben/pycparser | CFFI parser support | Transitive runtime dependency | Retain BSD notice |
| AnyIO | 4.14.2 | MIT | https://github.com/agronholm/anyio | HTTPX async compatibility | Transitive runtime dependency | MIT notice |
| certifi | 2026.7.22 | MPL-2.0 | https://github.com/certifi/python-certifi | HTTPS CA bundle | Transitive runtime dependency | Include MPL-2.0 notice and source URL when redistributed; modifications remain MPL-2.0 |
| h11 | 0.16.0 | MIT | https://github.com/python-hyper/h11 | HTTP/1.1 protocol for HTTP Core | Transitive runtime dependency | MIT notice |
| HTTP Core | 1.0.9 | BSD-3-Clause | https://github.com/encode/httpcore | HTTPX transport/pooling | Transitive runtime dependency | Retain BSD notice |
| idna | 3.19 | BSD-3-Clause | https://github.com/kjd/idna | Internationalized domain names | Transitive runtime dependency | Retain BSD notice |
| typing-extensions | 4.16.0 | PSF-2.0 | https://github.com/python/typing_extensions | Runtime typing compatibility | Transitive runtime dependency | PSF notice |
| Hatchling | >=1.27,<2 | MIT | https://github.com/pypa/hatch | Python package builds | Build-time dependency | MIT notice |
| pytest | 8.4.2 | MIT | https://github.com/pytest-dev/pytest | Test runner | Development dependency | MIT notice |
| Ruff | 0.16.5 | MIT | https://github.com/astral-sh/ruff | Lint and formatting | Development dependency | MIT notice |
| Colorama | 0.4.6 | BSD-3-Clause | https://github.com/tartley/colorama | pytest Windows terminal support | Transitive development dependency | BSD notice |
| iniconfig | 2.3.0 | MIT | https://github.com/pytest-dev/iniconfig | pytest configuration parsing | Transitive development dependency | MIT notice |
| packaging | 26.3 | Apache-2.0 OR BSD-2-Clause | https://github.com/pypa/packaging | pytest version/marker handling | Transitive development dependency | License choice notices |
| pluggy | 1.6.0 | MIT | https://github.com/pytest-dev/pluggy | pytest plugin system | Transitive development dependency | MIT notice |
| Pygments | 2.21.0 | BSD-2-Clause | https://github.com/pygments/pygments | pytest failure highlighting | Transitive development dependency | BSD notice |
| whisper.cpp | External b4938 | MIT | https://github.com/ggml-org/whisper.cpp | Separately managed local STT server | Official Windows CPU archive installed locally for acceptance; not bundled with Sam | Model files are separate assets |
| Whisper base multilingual weights | ggml-base.bin | MIT | https://huggingface.co/ggerganov/whisper.cpp / https://github.com/openai/whisper/blob/main/LICENSE | Local speech recognition | Installed in ignored local runtime state, not redistributed | Model SHA-1: 465707469ff3a37a2b9b8d8f89f2f99de7299dac |
| Gemma 4 E2B weights | Existing Q4_K_M | Apache-2.0 | https://ai.google.dev/gemma/apache_2 | Live local conversation via LM Studio | Owner-installed model; not bundled | Runtime/vendor terms remain separate |
| lms CLI | Existing external installation | MIT | https://github.com/lmstudio-ai/lms/blob/main/LICENSE | Bounded read-only daemon/server status discovery | Fixed argv only; no source copied or bundled | License verified 2026-09-05 |
| LM Studio / llmster | Existing external installation | Vendor terms; separate from CLI/model licenses | https://lmstudio.ai/app-terms | Optional local inference through published HTTP APIs | Not installed, linked, copied, or redistributed by Sam | Model assets have separate licenses; CLI license does not license the application/runtime |
| Windows System.Speech | Windows OS component | Microsoft Windows terms | https://learn.microsoft.com/dotnet/api/system.speech.synthesis | Local MVP TTS on Windows | Invoked through a fixed bundled PowerShell adapter; no Windows runtime or voice asset redistributed | Available only where the Windows component/voices are installed |
| eSpeak / eSpeak NG | External/current | GPL-3.0-or-later | https://github.com/espeak-ng/espeak-ng | Optional local MVP TTS on Linux | Separately installed executable invoked with structured argv; not linked, copied, or bundled | Distribution remains the OS/vendor's responsibility; Sam contains no eSpeak code or voice data |
| Node.js | 24.19.0 (bundled development runtime) | MIT and bundled component notices | https://nodejs.org/ | Frontend development runtime | External developer tool | Retain upstream notices if redistributed |
| pnpm | 11.19.0 | MIT | https://pnpm.io/ | Lockfile-based frontend package manager | External developer tool | None |
| React / React DOM | 19.1.1 | MIT | https://react.dev/ | Ambient UI rendering | Frontend runtime dependency | Retain MIT notice |
| Vite / React plugin | 7.1.5 / 5.0.2 | MIT | https://vite.dev/ | Frontend development and production build | Development dependencies | Retain MIT notices |
| TypeScript | 5.9.2 | Apache-2.0 | https://www.typescriptlang.org/ | Typed frontend compilation | Development dependency | Retain Apache-2.0 notice |
| Vitest | 3.2.4 | MIT | https://vitest.dev/ | Deterministic frontend tests | Development dependency | Retain MIT notice |
| Biome | 2.2.3 | MIT OR Apache-2.0 | https://biomejs.dev/ | Frontend formatting and linting | Development dependency with native CLI | Retain selected license notice |
| esbuild / Rollup / Babel | 0.25.12 / 4.63.1 / 7.29.x | MIT | https://github.com/evanw/esbuild | Transpilation and bundling used by Vite/Vitest | Transitive development dependencies, including platform binaries | Retain MIT notices |
| caniuse-lite | 1.0.30001810 | CC-BY-4.0 | https://github.com/browserslist/caniuse-lite | Browser compatibility data used by build tooling | Transitive development data | Preserve attribution and CC-BY-4.0 notice |

No third-party source has been manually copied or adapted. The compiled static
frontend incorporates React, React DOM and Scheduler under MIT (notice below).
Dependency wheels may carry the native components inventoried above; no model
or voice asset is stored in the repository. Apache-2.0 applies to original Sam
material only, not to these dependencies or external runtimes.

All resolved Python runtime and development package versions above are
hash-pinned in `uv.lock`. Frontend packages are pinned in `ui/pnpm-lock.yaml`;
the resolved license set was checked from installed pnpm metadata and contains
only MIT, MIT/Apache-2.0, Apache-2.0, BSD-3-Clause, ISC, and CC-BY-4.0 terms.
Python dependencies are linked/imported packages, not copied project code.

## Bundled frontend notice

React, React DOM and Scheduler (from the React project), included in the compiled UI:

```text
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Response-language detection

- `langdetect` 1.0.9: local response-language detection, including packaged language
  profiles; Apache-2.0 per the distributed LICENSE and NOTICE (the package's MIT
  metadata is inconsistent with those files). Copyright 2014–2015 Michal "Mimino"
  Danilak; upstream language-detection Copyright 2010–2014 Cybozu Labs, Inc.
  [LICENSE](https://github.com/Mimino666/langdetect/blob/master/LICENSE) /
  [NOTICE](https://github.com/Mimino666/langdetect/blob/master/NOTICE).
  Runtime dependency `six` 1.17.0 is MIT, Copyright 2010–2024 Benjamin Peterson
  ([license](https://github.com/benjaminp/six/blob/main/LICENSE)). Verified against
  upstream and installed distribution notices on 2026-09-08. These dependencies
  retain their own distributed notices; no source is copied into Sam.

## Architectural references (no source reuse)

- Historical Zev (`https://github.com/marqbritt/zev`) was inspected at project
  bootstrap. Its repository states MIT, but no source was copied or adapted.
  Sam uses an independently structured provider-neutral core.
- AGPL/GPL reference projects named by the specification are not dependencies
  and no code from them is included.
- `kokoro-onnx` was evaluated but not included. Its current Python dependency
  route pulls `phonemizer-fork`/eSpeak-NG under GPL-3.0-family terms. No Kokoro
  runtime, phonemizer, binary, model, or voice asset is present. MVP speech uses
  an OS/external-process adapter instead.
- Pelorus (`https://github.com/linuxserver/pelorus`) is a Phase 6B architecture
  reference only; its current license must be verified before any source reuse.
  Nidara Desktop (`https://github.com/nidara-project/nidara-desktop`) is GPL-3.0
  and is likewise conceptual reference material only. No source from either
  project is present.
