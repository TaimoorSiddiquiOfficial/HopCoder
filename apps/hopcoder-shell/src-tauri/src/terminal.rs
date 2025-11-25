use crate::ipc::{HopEvent, HopNotificationMessage, HopResponse, HOP_EVENT_CHANNEL, HOP_IPC_VERSION};
use dashmap::DashMap;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{async_runtime, Manager};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, Command},
    sync::Mutex,
};

#[derive(Default)]
pub struct TerminalManager {
    processes: DashMap<String, Arc<Mutex<Child>>>,
}

pub async fn spawn(
    app: &tauri::AppHandle,
    manager: &TerminalManager,
    id: String,
    shell: Option<String>,
) -> HopResponse {
    let sh = shell.unwrap_or_else(|| if cfg!(windows) { "powershell.exe".into() } else { "/bin/bash".into() });

    let mut child = match Command::new(sh)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => return HopResponse::TerminalSpawn { ok: false, pid: None, error: Some(e.to_string()) },
    };

    let pid = child.id().unwrap_or_default();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let handle = Arc::new(Mutex::new(child));
    manager.processes.insert(id.clone(), handle.clone());

    // Stream stdout
    if let Some(out) = stdout {
        let app_clone = app.clone();
        let id_clone = id.clone();
        async_runtime::spawn(async move {
            let reader = BufReader::new(out);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_clone.emit_all(
                    HOP_EVENT_CHANNEL,
                    HopNotificationMessage {
                        v: HOP_IPC_VERSION,
                        event: HopEvent::TerminalData { id: id_clone.clone(), data: format!("{line}\n") },
                    },
                );
            }
        });
    }

    // Stream stderr
    if let Some(err) = stderr {
        let app_clone = app.clone();
        let id_clone = id.clone();
        async_runtime::spawn(async move {
            let reader = BufReader::new(err);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_clone.emit_all(
                    HOP_EVENT_CHANNEL,
                    HopNotificationMessage {
                        v: HOP_IPC_VERSION,
                        event: HopEvent::TerminalData { id: id_clone.clone(), data: format!("{line}\n") },
                    },
                );
            }
        });
    }

    // Exit watcher
    {
        let app_clone = app.clone();
        let id_clone = id.clone();
        let handle_clone = handle.clone();
        async_runtime::spawn(async move {
            let status = {
                let mut child = handle_clone.lock().await;
                child.wait().await.ok()
            };
            let code = status.and_then(|s| s.code());
            let _ = app_clone.emit_all(
                HOP_EVENT_CHANNEL,
                HopNotificationMessage {
                    v: HOP_IPC_VERSION,
                    event: HopEvent::TerminalExit { id: id_clone, code, signal: None },
                },
            );
        });
    }

    HopResponse::TerminalSpawn { ok: true, pid: Some(pid), error: None }
}

pub async fn write(manager: &TerminalManager, id: &str, data: &str) -> HopResponse {
    if let Some(handle) = manager.processes.get(id) {
        let mut child = handle.value().lock().await;
        if let Some(stdin) = child.stdin.as_mut() {
            if let Err(e) = stdin.write_all(data.as_bytes()).await {
                return HopResponse::TerminalWrite { ok: false, error: Some(e.to_string()) };
            }
            let _ = stdin.flush().await;
            return HopResponse::TerminalWrite { ok: true, error: None };
        }
    }
    HopResponse::TerminalWrite { ok: false, error: Some("terminal not found".into()) }
}

pub async fn resize(_manager: &TerminalManager, _id: &str, _cols: u32, _rows: u32) -> HopResponse {
    // TODO: add PTY support and propagate resize
    HopResponse::TerminalResize { ok: true, error: None }
}

pub async fn kill(manager: &TerminalManager, id: &str, _signal: Option<String>) -> HopResponse {
    if let Some(handle) = manager.processes.remove(id) {
        let mut child = handle.1.lock().await;
        match child.kill().await {
            Ok(_) => HopResponse::TerminalKill { ok: true, error: None },
            Err(e) => HopResponse::TerminalKill { ok: false, error: Some(e.to_string()) },
        }
    } else {
        HopResponse::TerminalKill { ok: false, error: Some("terminal not found".into()) }
    }
}
