use std::{
    env, fs,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use tauri::{Emitter, Manager};

static CLOSE_ALLOWED: AtomicBool = AtomicBool::new(false);

struct SupervisorChild(Mutex<Option<Child>>);

#[tauri::command]
fn close_after_shutdown(window: tauri::WebviewWindow) -> Result<(), String> {
    CLOSE_ALLOWED.store(true, Ordering::SeqCst);
    window.close().map_err(|error| error.to_string())
}

fn repository_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .expect("src-tauri must remain below the Sam repository root")
        .to_path_buf()
}

fn launch_supervisor(app: &tauri::AppHandle) -> Result<Child, String> {
    let mut command = if cfg!(debug_assertions) {
        let root = repository_root();
        let mut command = Command::new("uv");
        command.args([
            "run",
            "sam-supervisor",
            "--root",
            root.to_str()
                .ok_or("Sam repository path is not valid UTF-8")?,
            "--no-ui",
        ]);
        command.current_dir(&root);
        command
    } else {
        let current = env::current_exe().map_err(|error| error.to_string())?;
        let directory = current
            .parent()
            .ok_or("native executable has no parent directory")?;
        let executable = if cfg!(windows) {
            directory.join("sam-supervisor.exe")
        } else {
            directory.join("sam-supervisor")
        };
        if !executable.is_file() {
            return Err(format!(
                "bundled Sam supervisor is missing: {}",
                executable.display()
            ));
        }
        let root = app
            .path()
            .app_local_data_dir()
            .map_err(|error| format!("could not resolve Sam's local data directory: {error}"))?;
        fs::create_dir_all(&root)
            .map_err(|error| format!("could not prepare Sam's local data directory: {error}"))?;
        let mut command = Command::new(executable);
        command.arg("--root").arg(root).arg("--no-ui");
        command.current_dir(directory);
        command
    };
    command
        .stdin(Stdio::null())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|error| format!("could not start sam-supervisor: {error}"))
}

fn stop_owned_supervisor(child: &SupervisorChild) {
    let Ok(mut guard) = child.0.lock() else {
        return;
    };
    let Some(mut process) = guard.take() else {
        return;
    };
    let deadline = Instant::now() + Duration::from_secs(5);
    while Instant::now() < deadline {
        match process.try_wait() {
            Ok(Some(_)) => return,
            Ok(None) => thread::sleep(Duration::from_millis(50)),
            Err(_) => break,
        }
    }
    // This is only the supervisor child created by this native process. Normal
    // UI Quit reaches the supervisor first; this is a bounded crash/exit fallback.
    let _ = process.kill();
    let _ = process.wait();
}

pub fn run() {
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    let app = builder
        .invoke_handler(tauri::generate_handler![close_after_shutdown])
        .setup(|app| {
            let child = launch_supervisor(app.handle()).map_err(std::io::Error::other)?;
            app.manage(SupervisorChild(Mutex::new(Some(child))));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build the Sam native shell");

    app.run(|app, event| match event {
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "main" && !CLOSE_ALLOWED.load(Ordering::SeqCst) => {
            api.prevent_close();
            let _ = app.emit_to("main", "sam://native-close-requested", ());
        }
        tauri::RunEvent::Exit => stop_owned_supervisor(&app.state::<SupervisorChild>()),
        _ => {}
    });
}
