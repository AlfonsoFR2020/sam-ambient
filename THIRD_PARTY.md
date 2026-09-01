# Third-party software

This inventory records dependencies, external services, and any copied code.
Versions are pinned by `uv.lock` where applicable.

| Name | Version | License | Source | Purpose | Integration | Notices |
| --- | --- | --- | --- | --- | --- | --- |
| uv | 0.9.26 (bootstrap environment) | MIT OR Apache-2.0 | https://github.com/astral-sh/uv | Reproducible development environment | External developer tool | None |
| CPython | 3.12.11 / 3.14.2 available at bootstrap | Python-2.0 | https://www.python.org/ | Runtime/toolchain | External runtime | PSF license applies |
| Hatchling | >=1.27,<2 | MIT | https://github.com/pypa/hatch | Python package builds | Build-time dependency | MIT notice |
| pytest | 8.4.2 | MIT | https://github.com/pytest-dev/pytest | Test runner | Development dependency | MIT notice |
| Ruff | 0.16.5 | MIT | https://github.com/astral-sh/ruff | Lint and formatting | Development dependency | MIT notice |
| Colorama | 0.4.6 | BSD-3-Clause | https://github.com/tartley/colorama | pytest Windows terminal support | Transitive development dependency | BSD notice |
| iniconfig | 2.3.0 | MIT | https://github.com/pytest-dev/iniconfig | pytest configuration parsing | Transitive development dependency | MIT notice |
| packaging | 26.3 | Apache-2.0 OR BSD-2-Clause | https://github.com/pypa/packaging | pytest version/marker handling | Transitive development dependency | License choice notices |
| pluggy | 1.6.0 | MIT | https://github.com/pytest-dev/pluggy | pytest plugin system | Transitive development dependency | MIT notice |
| Pygments | 2.21.0 | BSD-2-Clause | https://github.com/pygments/pygments | pytest failure highlighting | Transitive development dependency | BSD notice |

No third-party source has been copied or vendored.

All Python development package versions above were resolved and hash-pinned in
`uv.lock`; licenses were checked from installed package metadata before use.

## References not reused

- Historical Zev (`https://github.com/marqbritt/zev`) was inspected at project
  bootstrap. Its repository states MIT, but no source was copied or adapted.
  Sam uses an independently structured provider-neutral core.
- AGPL/GPL reference projects named by the specification are not dependencies
  and no code from them is included.
