mod ipc;
mod fs_handlers;
mod terminal;
mod workspace;
mod lsp;
mod memory_store;

use ipc::*;
use memory_store::{MemoryItem, MemoryStore};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Manager, State};

#[tauri::command]
async fn hop_ipc(
    app: tauri::AppHandle,
    message: HopRequestMessage,
    term_state: State<'_, terminal::TerminalManager>,
    lsp_state: State<'_, lsp::LspManager>,
) -> Result<HopResponseMessage, String> {
    if message.v != HOP_IPC_VERSION {
        return Ok(HopResponseMessage {
            v: HOP_IPC_VERSION,
            id: message.id,
            response: HopResponse::Error {
                ok: false,
                code: Some("version_mismatch".into()),
                error: "IPC version mismatch".into(),
            },
        });
    }

    let resp = match message.request {
        HopRequest::FsRead { path, root } => fs_handlers::read(&path, root.as_deref()).await,
        HopRequest::FsWrite { path, content, root } => fs_handlers::write(&path, content, root.as_deref()).await,
        HopRequest::FsDelete { path, root } => fs_handlers::delete(&path, root.as_deref()).await,
        HopRequest::WorkspaceOpen { root } => workspace::open(&root).await,
        HopRequest::WorkspaceList { root } => workspace::list(&root).await,
        HopRequest::TerminalSpawn { id, shell } => {
            terminal::spawn(&app, &term_state, id, shell).await
        }
        HopRequest::TerminalWrite { id, data } => terminal::write(&term_state, &id, &data).await,
        HopRequest::TerminalResize { id, cols, rows } => terminal::resize(&term_state, &id, cols, rows).await,
        HopRequest::TerminalKill { id, signal } => terminal::kill(&term_state, &id, signal).await,
        HopRequest::LspRequest { server, payload } => lsp::dispatch(&app, &lsp_state, &server, payload).await,
    };

    Ok(HopResponseMessage { v: HOP_IPC_VERSION, id: message.id, response: resp })
}

struct MemoryState {
    store: Mutex<MemoryStore>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveMemoryArgs {
    kind: String,
    project_id: Option<String>,
    session_id: Option<String>,
    key: String,
    value: serde_json::Value,
    ttl_seconds: Option<i64>,
}

#[derive(Debug, Serialize)]
struct SaveMemoryResult {
    id: String,
}

#[tauri::command]
fn hop_memory_save(
    state: State<MemoryState>,
    args: SaveMemoryArgs,
) -> Result<SaveMemoryResult, String> {
    let expires_at = args.ttl_seconds.map(|ttl| chrono::Utc::now().timestamp() + ttl);
    let json = serde_json::to_string(&args.value).map_err(|e| e.to_string())?;
    let store = state.store.lock().map_err(|_| "Memory store poisoned".to_string())?;
    let id = store
        .save(
            &args.kind,
            args.project_id.as_deref(),
            args.session_id.as_deref(),
            &args.key,
            &json,
            expires_at,
        )
        .map_err(|e| e.to_string())?;
    Ok(SaveMemoryResult { id })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoadProjectArgs {
    project_id: String,
}

#[tauri::command]
fn hop_memory_load_project(
    state: State<MemoryState>,
    args: LoadProjectArgs,
) -> Result<Vec<MemoryItem>, String> {
    let store = state.store.lock().map_err(|_| "Memory store poisoned".to_string())?;
    store.load_for_project(&args.project_id).map_err(|e| e.to_string())
}

fn main() {
    println!("Starting HopCoder...");
    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app
                .path_resolver()
                .app_data_dir()
                .ok_or_else(|| "failed to resolve app data dir")?;
            std::fs::create_dir_all(&app_dir)?;

            let db_path = app_dir.join("hopcoder_memory.sqlite3");
            let db_path_str = db_path
                .to_str()
                .ok_or_else(|| "invalid db path")?;
            
            let store = MemoryStore::new(db_path_str)?;

            app.manage(MemoryState {
                store: Mutex::new(store),
            });

            Ok(())
        })
        .manage(terminal::TerminalManager::default())
        .manage(lsp::LspManager::default())
        .invoke_handler(tauri::generate_handler![
            hop_ipc,
            hop_memory_save,
            hop_memory_load_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
