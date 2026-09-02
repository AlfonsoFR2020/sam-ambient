# Native host scaffold

`tauri.conf.json` pins the intended Tauri 2 application identity and frontend
commands. Cargo/Rust source and the concrete `NativeEventSource` bridge will be
added only when the target native toolchain is selected. Phase 5A does not
attempt or claim a native build.
