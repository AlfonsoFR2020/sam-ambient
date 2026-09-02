# Sam UI

Phase 5A is a browser-testable React/TypeScript frontend. It consumes protocol
v1 events through `ProtocolTransport`; presentation code has no direct Tauri
dependency. `TauriLocalTransport` accepts a small native event-source bridge
that the future Tauri host will inject.

Development uses the deterministic demo transport:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

The native Tauri host metadata is intentionally only a scaffold until Rust and
the target platform build prerequisites are available.
