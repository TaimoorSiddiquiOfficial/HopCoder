use crate::ipc::{HopEvent, HopNotificationMessage, HopResponse, HOP_EVENT_CHANNEL, HOP_IPC_VERSION};
use dashmap::DashMap;
use serde_json::Value;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

#[derive(Default)]
pub struct LspManager {
    servers: DashMap<String, Arc<Mutex<Child>>>,
}

impl LspManager {
    pub async fn start_server(&self, app: AppHandle, server_id: String, cmd: String, args: Vec<String>) -> Result<(), String> {
        let mut child = Command::new(cmd)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?;

        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to open stderr")?;
        
        let server_id_clone = server_id.clone();
        let app_clone = app.clone();

        // Stdout reader (JSON-RPC)
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            loop {
                // 1. Read headers
                let mut content_length = 0;
                let mut line = String::new();
                
                loop {
                    line.clear();
                    if reader.read_line(&mut line).await.unwrap_or(0) == 0 {
                        return; // EOF
                    }
                    if line == "\r\n" {
                        break; // End of headers
                    }
                    if line.to_lowercase().starts_with("content-length:") {
                        if let Ok(len) = line.trim_start_matches("Content-Length:").trim().parse::<usize>() {
                            content_length = len;
                        }
                    }
                }

                if content_length > 0 {
                    // 2. Read body
                    let mut buffer = vec![0; content_length];
                    if reader.read_exact(&mut buffer).await.is_ok() {
                        if let Ok(json_str) = String::from_utf8(buffer) {
                            if let Ok(json_val) = serde_json::from_str::<Value>(&json_str) {
                                // Emit event to frontend
                                let _ = app_clone.emit_all(
                                    HOP_EVENT_CHANNEL,
                                    HopNotificationMessage {
                                        v: HOP_IPC_VERSION,
                                        event: HopEvent::LspMessage {
                                            server: server_id_clone.clone(),
                                            message: json_val,
                                        },
                                    },
                                );
                            }
                        }
                    }
                }
            }
        });

        // Stderr reader (Logs)
        let server_id_log = server_id.clone();
        let app_log = app.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_log.emit_all(
                    HOP_EVENT_CHANNEL,
                    HopNotificationMessage {
                        v: HOP_IPC_VERSION,
                        event: HopEvent::Log {
                            level: "info".into(),
                            message: format!("[LSP:{}] {}", server_id_log, line),
                            scope: Some("lsp".into()),
                        },
                    },
                );
            }
        });

        self.servers.insert(server_id, Arc::new(Mutex::new(child)));
        Ok(())
    }

    pub async fn send_payload(&self, server_id: &str, payload: Value) -> Result<(), String> {
        if let Some(server) = self.servers.get(server_id) {
            let mut child = server.lock().await;
            if let Some(stdin) = child.stdin.as_mut() {
                let json = payload.to_string();
                let message = format!("Content-Length: {}\r\n\r\n{}", json.len(), json);
                stdin.write_all(message.as_bytes()).await.map_err(|e| e.to_string())?;
                stdin.flush().await.map_err(|e| e.to_string())?;
                return Ok(());
            }
        }
        Err("Server not found or stdin closed".into())
    }
}

pub async fn dispatch(
    app: &AppHandle,
    manager: &LspManager,
    server: &str,
    payload: Value,
) -> HopResponse {
    // Special "initialize" payload to start the server if not running?
    // For now, let's assume we have a separate "start" command or we auto-start.
    // Let's add a hack: if payload has "method": "initialize", we try to start it.
    
    if let Some(method) = payload.get("method").and_then(|m| m.as_str()) {
        if method == "initialize" && !manager.servers.contains_key(server) {
            // TODO: Map server ID to actual binary. Hardcoded for now.
            let (cmd, args) = match server {
                "rust" => ("rust-analyzer".to_string(), vec![]),
                "typescript" => {
                    #[cfg(target_os = "windows")]
                    let cmd = "npx.cmd".to_string();
                    #[cfg(not(target_os = "windows"))]
                    let cmd = "npx".to_string();
                    
                    (cmd, vec!["typescript-language-server".into(), "--stdio".into()])
                },
                _ => return HopResponse::LspRequest { ok: false, result: None, error: Some("Unknown server type".into()) },
            };
            
            if let Err(e) = manager.start_server(app.clone(), server.to_string(), cmd, args).await {
                return HopResponse::LspRequest { ok: false, result: None, error: Some(format!("Failed to start server: {}", e)) };
            }
        }
    }

    match manager.send_payload(server, payload).await {
        Ok(_) => HopResponse::LspRequest { ok: true, result: None, error: None },
        Err(e) => HopResponse::LspRequest { ok: false, result: None, error: Some(e) },
    }
}
