# Third-party software

This inventory records dependencies, external services, and any copied code.
Versions are pinned by `uv.lock` where applicable.

| Name | Version | License | Source | Purpose | Integration | Notices |
| --- | --- | --- | --- | --- | --- | --- |
| uv | 0.9.26 (bootstrap environment) | MIT OR Apache-2.0 | https://github.com/astral-sh/uv | Reproducible development environment | External developer tool | None |
| CPython | 3.12.11 / 3.14.2 available at bootstrap | Python-2.0 | https://www.python.org/ | Runtime/toolchain | External runtime | PSF license applies |
| HTTPX | 0.28.1 | BSD-3-Clause | https://github.com/encode/httpx | Async HTTP, streaming, timeouts, connection pooling | Runtime dependency | Retain BSD notice |
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

No third-party source has been copied or vendored.

All resolved Python runtime and development package versions above are
hash-pinned in `uv.lock`; licenses were checked from installed package metadata
before use. Dependencies are linked/imported packages, not copied project code.

## References not reused

- Historical Zev (`https://github.com/marqbritt/zev`) was inspected at project
  bootstrap. Its repository states MIT, but no source was copied or adapted.
  Sam uses an independently structured provider-neutral core.
- AGPL/GPL reference projects named by the specification are not dependencies
  and no code from them is included.
