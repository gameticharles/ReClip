use tauri::{AppHandle, Manager};
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub url: String,
    pub notes: String,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    body: String,
    assets: Vec<GithubAsset>,
}

#[derive(Debug, Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
}

#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    let client = reqwest::Client::new();
    let res = client.get("https://api.github.com/repos/gameticharles/ReClip/releases/latest")
        .header("User-Agent", "ReClip-App")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch releases: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("GitHub API Error: {}", res.status()));
    }

    let release: GithubRelease = res.json().await.map_err(|e| format!("Failed to parse JSON: {}", e))?;
    
    let remote_version_str = release.tag_name.trim_start_matches('v');
    let current_version_str = app.package_info().version.to_string();

    if is_newer(remote_version_str, &current_version_str) {
        // Find suitable asset (.msi or .exe setup)
        let asset = release.assets.iter()
            .find(|a| a.name.ends_with(".msi") || (a.name.ends_with(".exe") && a.name.to_lowercase().contains("setup")))
            .ok_or("No suitable installer found in release assets")?;

        Ok(Some(UpdateInfo {
            version: release.tag_name,
            url: asset.browser_download_url.clone(),
            notes: release.body,
        }))
    } else {
        Ok(None)
    }
}

fn is_newer(remote: &str, current: &str) -> bool {
    // Simple naive semantic version check (assumes x.y.z)
    let parse = |v: &str| -> Vec<u32> {
        v.split('.')
         .filter_map(|s| s.parse::<u32>().ok())
         .collect()
    };
    
    let r_parts = parse(remote);
    let c_parts = parse(current);
    
    for i in 0..std::cmp::max(r_parts.len(), c_parts.len()) {
        let r = *r_parts.get(i).unwrap_or(&0);
        let c = *c_parts.get(i).unwrap_or(&0);
        if r > c { return true; }
        if r < c { return false; }
    }
    false
}

#[tauri::command]
#[allow(unused_variables)]
pub async fn install_update(url: String) -> Result<(), String> {
    let client = reqwest::Client::new();
    let res = client.get(&url)
        .header("User-Agent", "ReClip-App")
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    let bytes = res.bytes().await.map_err(|e| format!("Failed to read body: {}", e))?;
    
    let temp_dir = std::env::temp_dir();
    let file_name = url.split('/').last().unwrap_or("reclip_update.exe");
    let file_path = temp_dir.join(file_name);

    {
        let mut file = File::create(&file_path).map_err(|e| format!("Failed to create file: {}", e))?;
        file.write_all(&bytes).map_err(|e| format!("Failed to write file: {}", e))?;
    }

    // Run installer
    // Use shell or Command. Command is direct.
    // Detach process so app can close?
    // Actually, installer usually complains if app is running.
    // We should launch it and probably exit.
    
    #[cfg(target_os = "windows")]
    {
        Command::new("powershell")
            .args(["-Command", &format!("Start-Process -FilePath '{}'", file_path.display())])
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;
    }

    // Attempt to quit app? Or let user do it?
    // The installer usually prompts "Close Application".
    // Or we can just exit.
    // std::process::exit(0); // abrupt.
    // Better to let frontend handle exit.
    
    Ok(())
}
