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

The integrated Tauri host is development source. Native packaging, signing,
security-software review and combined acceptance remain release gates.

The canonical production frontend command is `pnpm build` from `ui`. It runs
TypeScript and Vite, replacing `src/sam_ambient/static`; `Start Sam.cmd` privately
serves those compiled assets and never rebuilds them. The IV-D build adds Vite's
`.vite/manifest.json`, `assets/sam-build.json`, an HTML source fingerprint and DOM
source/commit markers. The SHA-256 inventory covers frontend source and build
inputs, normalizing text line endings. Git commit/dirty metadata is supplementary;
Git-less archives retain the content fingerprint. These markers grant no authority.

After building, `python scripts/check_frontend_assets.py` from the repository root
checks source/HTML/manifest/bundle coherence without starting the application.
`--output <repository-path.json>` optionally records artifact hashes. Build and
file checks do not compile WebGL shaders or establish graphical acceptance.
