use crate::ipc::{HopResponse, WorkspaceEntry};
use std::path::Path;
use std::time::UNIX_EPOCH;
use tokio::fs;

pub async fn open(root: &str) -> HopResponse {
    let p = Path::new(root);
    match fs::metadata(p).await {
        Ok(meta) if meta.is_dir() => HopResponse::WorkspaceOpen {
            ok: true,
            workspace_root: Some(p.to_string_lossy().to_string()),
            error: None,
        },
        _ => HopResponse::WorkspaceOpen { ok: false, workspace_root: None, error: Some("Invalid workspace".into()) },
    }
}

pub async fn list(root: &str) -> HopResponse {
    let mut entries = Vec::new();
    match fs::read_dir(root).await {
        Ok(mut dir) => {
            loop {
                match dir.next_entry().await {
                    Ok(Some(entry)) => {
                        let meta_ok = entry.metadata().await.ok();
                        let file_type = meta_ok.as_ref().map(|m| m.file_type());
                        let kind = if let Some(ft) = file_type {
                            if ft.is_dir() {
                                "dir"
                            } else if ft.is_symlink() {
                                "symlink"
                            } else {
                                "file"
                            }
                        } else {
                            "file"
                        };
                        let size = meta_ok
                            .as_ref()
                            .and_then(|m| if m.is_file() { Some(m.len()) } else { None });
                        let modified_ms = meta_ok
                            .and_then(|m| m.modified().ok())
                            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                            .map(|dur| dur.as_millis() as i64);
                        entries.push(WorkspaceEntry {
                            path: entry.path().to_string_lossy().to_string(),
                            kind: kind.to_string(),
                            size,
                            modified_ms,
                        });
                    }
                    Ok(None) => break,
                    Err(e) => {
                        return HopResponse::WorkspaceList { ok: false, entries: None, error: Some(e.to_string()) }
                    }
                }
            }
            HopResponse::WorkspaceList { ok: true, entries: Some(entries), error: None }
        }
        Err(e) => HopResponse::WorkspaceList { ok: false, entries: None, error: Some(e.to_string()) },
    }
}
