use crate::ipc::HopResponse;
use tokio::fs;

pub async fn read(path: &str) -> HopResponse {
    match fs::read_to_string(path).await {
        Ok(content) => HopResponse::FsRead { ok: true, content: Some(content), error: None },
        Err(e) => HopResponse::FsRead { ok: false, content: None, error: Some(e.to_string()) },
    }
}

pub async fn write(path: &str, content: String) -> HopResponse {
    match fs::write(path, content).await {
        Ok(_) => HopResponse::FsWrite { ok: true, error: None },
        Err(e) => HopResponse::FsWrite { ok: false, error: Some(e.to_string()) },
    }
}
