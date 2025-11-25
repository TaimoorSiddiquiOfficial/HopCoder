use crate::ipc::HopResponse;
use tokio::fs;

fn validate_path(path: &str, root: Option<&str>) -> Result<(), String> {
    if let Some(root) = root {
        // Basic security check: prevent path traversal and ensure path is within root
        if path.contains("..") {
             return Err("Path traversal detected".to_string());
        }
        
        // Normalize separators for comparison if needed, but assuming consistent usage from frontend
        if !path.starts_with(root) {
             return Err("Access denied: Path is outside workspace root".to_string());
        }
    }
    Ok(())
}

pub async fn read(path: &str, root: Option<&str>) -> HopResponse {
    if let Err(e) = validate_path(path, root) {
        return HopResponse::FsRead { ok: false, content: None, error: Some(e) };
    }

    match fs::read_to_string(path).await {
        Ok(content) => HopResponse::FsRead { ok: true, content: Some(content), error: None },
        Err(e) => HopResponse::FsRead { ok: false, content: None, error: Some(e.to_string()) },
    }
}

pub async fn write(path: &str, content: String, root: Option<&str>) -> HopResponse {
    if let Err(e) = validate_path(path, root) {
        return HopResponse::FsWrite { ok: false, error: Some(e) };
    }

    match fs::write(path, content).await {
        Ok(_) => HopResponse::FsWrite { ok: true, error: None },
        Err(e) => HopResponse::FsWrite { ok: false, error: Some(e.to_string()) },
    }
}

pub async fn delete(path: &str, root: Option<&str>) -> HopResponse {
    if let Err(e) = validate_path(path, root) {
        return HopResponse::FsDelete { ok: false, error: Some(e) };
    }

    let p = std::path::Path::new(path);
    let res = if p.is_dir() {
        fs::remove_dir_all(path).await
    } else {
        fs::remove_file(path).await
    };

    match res {
        Ok(_) => HopResponse::FsDelete { ok: true, error: None },
        Err(e) => HopResponse::FsDelete { ok: false, error: Some(e.to_string()) },
    }
}
