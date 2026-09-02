# Sam UI

The browser-testable React/TypeScript frontend consumes protocol v1 events
through `ProtocolTransport`; presentation code has no direct Tauri dependency.
`TauriLocalTransport` accepts a small native event-source bridge that the future
Tauri host will inject.

Development uses the deterministic demo transport:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

The default is the in-memory demo. To exercise the real localhost WebSocket
boundary against the Python deterministic core producer, run from the project
root:

```powershell
scripts/ui-dev.ps1
```

or `scripts/ui-dev.sh`. This starts `sam bridge --demo` and Vite together; the
frontend still receives ordinary production protocol events and sends ordinary
versioned control commands. `?transport=core` selects the bridge manually.

The native Tauri host metadata is intentionally only a scaffold until Rust and
the target platform build prerequisites are available.
