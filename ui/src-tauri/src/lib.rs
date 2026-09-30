use std::{
    env, fs,
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use tauri::{Emitter, Manager};

static CLOSE_ALLOWED: AtomicBool = AtomicBool::new(false);

struct SupervisorChild(Mutex<Option<Child>>);

struct OwnerChannel {
    input: Mutex<ChildStdin>,
    responses: Mutex<mpsc::Receiver<String>>,
}

#[tauri::command]
fn owner_proof(
    window: tauri::WebviewWindow,
    channel: tauri::State<OwnerChannel>,
    challenge: serde_json::Value,
) -> Result<String, String> {
    let url = window.url().map_err(|_| "Owner proof unavailable")?;
    if window.label() != "main"
        || !matches!(
            (url.scheme(), url.host_str(), url.port()),
            ("tauri", Some("localhost"), None)
                | ("http", Some("tauri.localhost"), None)
                | ("http", Some("127.0.0.1"), Some(1420))
        )
    {
        return Err("Owner proof unavailable".into());
    }
    let id = challenge
        .get("nonce")
        .and_then(|v| v.as_str())
        .filter(|v| v.len() == 64 && v.bytes().all(|b| b.is_ascii_hexdigit()))
        .ok_or("Owner proof unavailable")?;
    let request = serde_json::json!({"id": id, "challenge": challenge}).to_string();
    if request.len() > 1024 {
        return Err("Owner proof unavailable".into());
    }
    let responses = channel
        .responses
        .lock()
        .map_err(|_| "Owner proof unavailable")?;
    {
        let mut input = channel
            .input
            .lock()
            .map_err(|_| "Owner proof unavailable")?;
        writeln!(input, "{request}").map_err(|_| "Owner proof unavailable")?;
        input.flush().map_err(|_| "Owner proof unavailable")?;
    }
    let deadline = Instant::now() + Duration::from_secs(4);
    while Instant::now() < deadline {
        let raw = responses
            .recv_timeout(deadline.saturating_duration_since(Instant::now()))
            .map_err(|_| "Owner proof unavailable")?;
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) {
            if value.get("id").and_then(|v| v.as_str()) == Some(id) {
                return value
                    .get("proof")
                    .and_then(|v| v.as_str())
                    .map(str::to_owned)
                    .ok_or("Owner proof unavailable".into());
            }
        }
    }
    Err("Owner proof unavailable".into())
}

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
            "--no-sync",
            "sam-supervisor",
            "--root",
            root.to_str()
                .ok_or("Sam repository path is not valid UTF-8")?,
            "--no-ui",
            "--native-owner-channel",
        ]);
        command.current_dir(&root);
        command
    } else {
        let directory = app
            .path()
            .resource_dir()
            .map_err(|error| format!("could not resolve Sam's resource directory: {error}"))?
            .join("companion");
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
        command
            .arg("--root")
            .arg(root)
            .arg("--no-ui")
            .arg("--native-owner-channel");
        command.current_dir(&directory);
        command
    };
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
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
        .invoke_handler(tauri::generate_handler![close_after_shutdown, owner_proof])
        .setup(|app| {
            let mut child = launch_supervisor(app.handle()).map_err(std::io::Error::other)?;
            let input = child.stdin.take().ok_or("Owner channel missing")?;
            let output = child.stdout.take().ok_or("Owner channel missing")?;
            let (sender, responses) = mpsc::sync_channel(8);
            thread::spawn(move || {
                let mut reader = BufReader::new(output);
                loop {
                    let mut line = String::new();
                    // Bounded read; malformed/overlong records terminate this private channel.
                    match reader.by_ref().take(2048).read_line(&mut line) {
                        Ok(0) | Err(_) => break,
                        Ok(_) if !line.ends_with('\n') => break,
                        _ => {
                            let _ = sender.try_send(line);
                        }
                    }
                }
            });
            app.manage(OwnerChannel {
                input: Mutex::new(input),
                responses: Mutex::new(responses),
            });
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
