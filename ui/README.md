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
boundary against the composed Python runtime, run from the project root:

```powershell
scripts/ui-dev.ps1
```

or `scripts/ui-dev.sh`. This starts `sam runtime --root <project>` and Vite
together; the frontend receives production protocol/tool events and sends
versioned controls, including exact-invocation approval and global capability
revocation. `?transport=core` selects the bridge manually.

The native Tauri host metadata is intentionally only a scaffold until Rust and
the target platform build prerequisites are available.
