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

pub async fn search(query: &str, root: Option<&str>) -> HopResponse {
    let root_path = match root {
        Some(r) => r,
        None => return HopResponse::FsSearch { ok: false, matches: None, error: Some("Root required".to_string()) },
    };

    if let Err(e) = validate_path(root_path, Some(root_path)) {
        return HopResponse::FsSearch { ok: false, matches: None, error: Some(e) };
    }

    let mut matches = Vec::new();
    let mut dirs = vec![std::path::PathBuf::from(root_path)];
    let query_lower = query.to_lowercase();

    // Limit search depth/count to prevent hanging
    let mut count = 0;
    const MAX_FILES: usize = 10000;

    while let Some(dir) = dirs.pop() {
        let mut entries = match fs::read_dir(&dir).await {
            Ok(e) => e,
            Err(_) => continue,
        };

        while let Ok(Some(entry)) = entries.next_entry().await {
            count += 1;
            if count > MAX_FILES {
                break;
            }

            let path = entry.path();
            let path_str = path.to_string_lossy().to_string();
            
            // Skip node_modules, .git, target, etc.
            if path_str.contains("node_modules") || path_str.contains(".git") || path_str.contains("target") {
                continue;
            }

            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name.to_lowercase().contains(&query_lower) {
                matches.push(path_str.clone());
            }

            if path.is_dir() {
                dirs.push(path);
            }
        }
        if count > MAX_FILES {
            break;
        }
    }

    HopResponse::FsSearch { ok: true, matches: Some(matches), error: None }
}
