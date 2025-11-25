use serde::{Deserialize, Serialize};

pub const HOP_IPC_VERSION: u8 = 1;
pub const HOP_EVENT_CHANNEL: &str = "hop://event";

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "kind")]
pub enum HopMessage {
    #[serde(rename = "request")]
    Request(HopRequestMessage),
    #[serde(rename = "response")]
    Response(HopResponseMessage),
    #[serde(rename = "notification")]
    Notification(HopNotificationMessage),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct HopRequestMessage {
    pub v: u8,
    pub id: String,
    pub request: HopRequest,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct HopResponseMessage {
    pub v: u8,
    pub id: String,
    pub response: HopResponse,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct HopNotificationMessage {
    pub v: u8,
    pub event: HopEvent,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum HopRequest {
    #[serde(rename = "fs.read")]
    FsRead { path: String, root: Option<String> },
    #[serde(rename = "fs.write")]
    FsWrite { path: String, content: String, root: Option<String> },
    #[serde(rename = "fs.delete")]
    FsDelete { path: String, root: Option<String> },
    #[serde(rename = "fs.search")]
    FsSearch { query: String, root: Option<String> },
    #[serde(rename = "workspace.open")]
    WorkspaceOpen { root: String },
    #[serde(rename = "workspace.list")]
    WorkspaceList { root: String },
    #[serde(rename = "terminal.spawn")]
    TerminalSpawn { id: String, shell: Option<String> },
    #[serde(rename = "terminal.write")]
    TerminalWrite { id: String, data: String },
    #[serde(rename = "terminal.resize")]
    TerminalResize { id: String, cols: u32, rows: u32 },
    #[serde(rename = "terminal.kill")]
    TerminalKill { id: String, signal: Option<String> },
    #[serde(rename = "lsp.request")]
    LspRequest { server: String, payload: serde_json::Value },
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum HopResponse {
    #[serde(rename = "fs.read")]
    FsRead { ok: bool, content: Option<String>, error: Option<String> },
    #[serde(rename = "fs.write")]
    FsWrite { ok: bool, error: Option<String> },
    #[serde(rename = "fs.delete")]
    FsDelete { ok: bool, error: Option<String> },
    #[serde(rename = "fs.search")]
    FsSearch { ok: bool, matches: Option<Vec<String>>, error: Option<String> },
    #[serde(rename = "workspace.open")]
    WorkspaceOpen { ok: bool, #[serde(rename = "workspaceRoot")] workspace_root: Option<String>, error: Option<String> },
    #[serde(rename = "workspace.list")]
    WorkspaceList { ok: bool, entries: Option<Vec<WorkspaceEntry>>, error: Option<String> },
    #[serde(rename = "terminal.spawn")]
    TerminalSpawn { ok: bool, pid: Option<u32>, error: Option<String> },
    #[serde(rename = "terminal.write")]
    TerminalWrite { ok: bool, error: Option<String> },
    #[serde(rename = "terminal.resize")]
    TerminalResize { ok: bool, error: Option<String> },
    #[serde(rename = "terminal.kill")]
    TerminalKill { ok: bool, error: Option<String> },
    #[serde(rename = "lsp.request")]
    LspRequest { ok: bool, result: Option<serde_json::Value>, error: Option<String> },
    #[serde(rename = "error")]
    Error { ok: bool, code: Option<String>, error: String },
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WorkspaceEntry {
    pub path: String,
    pub kind: String, // "file", "dir", or "symlink"
    pub size: Option<u64>,
    #[serde(rename = "modified_ms")]
    pub modified_ms: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum HopEvent {
    #[serde(rename = "terminal.data")]
    TerminalData { id: String, data: String },
    #[serde(rename = "terminal.exit")]
    TerminalExit { id: String, code: Option<i32>, signal: Option<String> },
    #[serde(rename = "lsp.message")]
    LspMessage { server: String, message: serde_json::Value },
    #[serde(rename = "log")]
    Log { level: String, message: String, scope: Option<String> },
}
