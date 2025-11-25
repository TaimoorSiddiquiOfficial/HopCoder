use crate::ipc::{HopResponse, WorkspaceEntry};
use std::path::Path;
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
                        let kind = if meta_ok.as_ref().map(|m| m.is_dir()).unwrap_or(false) {
                            "dir"
                        } else {
                            "file"
                        };
                        entries.push(WorkspaceEntry {
                            path: entry.path().to_string_lossy().to_string(),
                            kind: kind.to_string(),
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
