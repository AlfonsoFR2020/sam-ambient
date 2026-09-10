# Native host

This Tauri 2 crate is a thin lifecycle and packaging shell. In development it
starts `uv run sam-supervisor --no-ui`; the React application continues to use
Sam's loopback WebSocket protocol. The single-instance plugin focuses an existing
Sam window instead of starting another runtime.

Normal window close asks the existing React Quit confirmation to shut down the
trusted Python runtime. Rust exposes only `close_after_shutdown`, which cannot
launch tools or bypass Sam policy. Release builds expect a separately packaged
`sam-supervisor[.exe]` beside the native executable; producing that companion is
the remaining installer/bootstrap boundary.
