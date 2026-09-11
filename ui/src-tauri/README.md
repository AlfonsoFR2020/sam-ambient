# Native host

This Tauri 2 crate is a thin lifecycle and packaging shell. In development it
starts `uv run sam-supervisor --no-ui`; the React application continues to use
Sam's loopback WebSocket protocol. The single-instance plugin focuses an existing
Sam window instead of starting another runtime.

Normal window close asks the existing React Quit confirmation to shut down the
trusted Python runtime. Rust exposes only `close_after_shutdown`, which cannot
launch tools or bypass Sam policy. Release builds resolve the fixed
`companion/sam-supervisor.exe` from Tauri resources and pass it a per-user local
data root. The cx_Freeze directory contains CPython, Sam, dependencies, static
resources, VC runtime files, and notices; it contains no provider runtime, model,
or Whisper weights.

Build the Windows per-user NSIS package from the repository root with
`scripts/package_native.ps1 -BuildRoot PATH -AllowUnsignedDevelopmentBuild`,
where `PATH` is a unique directory outside the checkout created for that
invocation. The explicit flag marks output as non-publishable: Norton reported
`IDP.Generic` on the unsigned cx_Freeze launcher, so antivirus review and trusted
code signing are release gates. Rust, Cargo, MSVC, Windows SDK,
Python, uv, and cx_Freeze are build requirements only. Installed Sam uses system
WebView2. Browser mode remains the development/fallback shell.
