use tauri::Manager;
use crate::ocr;

#[derive(serde::Serialize)]
pub struct UrlMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub image: Option<String>,
    pub og_title: Option<String>,
    pub og_description: Option<String>,
    pub og_site_name: Option<String>,
    pub keywords: Option<String>,
    pub author: Option<String>,
    pub canonical: Option<String>,
    pub favicon: Option<String>,
}

#[tauri::command]
pub async fn copy_to_system(content: String) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn copy_image_to_system(base64_data: String) -> Result<(), String> {
    use base64::{Engine as _, engine::general_purpose};
    let data = general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    let img = image::load_from_memory(&data).map_err(|e| format!("Failed to load image: {}", e))?;
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
    
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let image_data = arboard::ImageData {
        width: width as usize,
        height: height as usize,
        bytes: std::borrow::Cow::Owned(rgba.into_raw()),
    };
    
    clipboard.set_image(image_data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn validate_paths(content: String) -> Vec<(String, bool, bool)> {
    if let Ok(paths) = serde_json::from_str::<Vec<String>>(&content) {
        let mut results = Vec::new();
        for path in paths {
            let p = std::path::Path::new(&path);
            let exists = p.exists();
            let is_dir = p.is_dir();
            results.push((path, exists, is_dir));
        }
        return results;
    }
    let p = std::path::Path::new(&content);
    vec![(content.clone(), p.exists(), p.is_dir())]
}

#[tauri::command]
pub async fn paste_clip_to_system(app_handle: tauri::AppHandle, content: String, clip_type: String) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    
    if clip_type == "files" {
        #[cfg(target_os = "windows")]
        {
            use clipboard_rs::{Clipboard, ClipboardContext};
            if let Ok(paths) = serde_json::from_str::<Vec<String>>(&content) {
                let ctx = ClipboardContext::new().map_err(|e| e.to_string())?;
                ctx.set_files(paths).map_err(|e| e.to_string())?;
            } else {
                 return Err("Invalid file list format".to_string());
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
             return Err("File pasting not supported on this OS".to_string());
        }
    } else if clip_type == "image" {
        let img = image::open(&content).map_err(|e| format!("Failed to load image: {}", e))?;
        let rgba = img.to_rgba8();
        let (width, height) = rgba.dimensions();
        let image_data = arboard::ImageData {
            width: width as usize,
            height: height as usize,
            bytes: std::borrow::Cow::Owned(rgba.into_raw()),
        };
        clipboard.set_image(image_data).map_err(|e| e.to_string())?;
    } else if clip_type == "html" {
        #[cfg(target_os = "windows")]
        {
            use clipboard_rs::{Clipboard, ClipboardContext};
            let ctx = ClipboardContext::new().map_err(|e| e.to_string())?;
            let plain_text = html2text::from_read(content.as_bytes(), 80).unwrap_or(content.clone()); 
            ctx.set_text(plain_text.clone()).map_err(|e| e.to_string())?;
            ctx.set_html(content.clone()).map_err(|e| e.to_string())?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            let plain_text = html2text::from_read(content.as_bytes(), 80).unwrap_or(content); 
            clipboard.set_text(plain_text).map_err(|e| e.to_string())?;
        }
    } else {
        clipboard.set_text(content.clone()).map_err(|e| e.to_string())?;
    }

    if let Some(window) = app_handle.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        }
    }

    use enigo::{Enigo, Key, Keyboard, Settings, Direction};
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    std::thread::sleep(std::time::Duration::from_millis(200));
    
    #[cfg(target_os = "macos")]
    {
        let _ = enigo.key(Key::Meta, Direction::Press);
        std::thread::sleep(std::time::Duration::from_millis(20));
        let _ = enigo.key(Key::Unicode('v'), Direction::Click);
        std::thread::sleep(std::time::Duration::from_millis(20));
        let _ = enigo.key(Key::Meta, Direction::Release);
    }

    #[cfg(not(target_os = "macos"))]
    {
       let _ = enigo.key(Key::Control, Direction::Press);
       std::thread::sleep(std::time::Duration::from_millis(20));
       let _ = enigo.key(Key::Unicode('v'), Direction::Click);
       std::thread::sleep(std::time::Duration::from_millis(20));
       let _ = enigo.key(Key::Control, Direction::Release);
    }
    
    Ok(())
}

#[tauri::command]
pub async fn get_app_data_path(app: tauri::AppHandle) -> Result<String, String> {
    app.path().app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_system_accent_color() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let dwm = hkcu.open_subkey("Software\\Microsoft\\Windows\\DWM").map_err(|e| format!("Failed to open registry key: {}", e))?;
        let val: u32 = match dwm.get_value("AccentColor") {
            Ok(v) => v,
            Err(_) => dwm.get_value("ColorizationColor").unwrap_or(0xFF4F46E5),
        };
        let r = (val) & 0xFF;
        let g = (val >> 8) & 0xFF;
        let b = (val >> 16) & 0xFF;
        Ok(format!("#{:02x}{:02x}{:02x}", r, g, b))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok("#4f46e5".to_string())
    }
}

#[tauri::command]
pub async fn get_file_size(path: String) -> Result<u64, String> {
    std::fs::metadata(&path).map(|m| m.len()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_image(source_path: String, target_path: String) -> Result<(), String> {
    let img = image::open(&source_path).map_err(|e| e.to_string())?;
    img.save(&target_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_url_metadata(url: String) -> Result<UrlMetadata, String> {
    if !url.starts_with("http") {
         return Err("Invalid URL".to_string());
    }
    let client = reqwest::Client::new();
    let res = client.get(&url).header("User-Agent", "ReClip/1.0 (Mozilla/5.0 compatible)").timeout(std::time::Duration::from_secs(5)).send().await.map_err(|e| e.to_string())?;
    let text = res.text().await.map_err(|e| e.to_string())?;
    let extract_meta = |name: &str, attr: &str| -> Option<String> {
        let pattern = format!(r#"(?i)<meta\s+{}=[\"']{}[\"']\s+content=[\"']([^\"']*)[\"']"#, attr, name);
        regex::Regex::new(&pattern).ok().and_then(|re| re.captures(&text)).map(|c| c.get(1).unwrap().as_str().trim().to_string()).or_else(|| {
            let pattern2 = format!(r#"(?i)<meta\s+content=[\"']([^\"']*)[\"']\s+{}=[\"']{}[\"']"#, attr, name);
            regex::Regex::new(&pattern2).ok().and_then(|re| re.captures(&text)).map(|c| c.get(1).unwrap().as_str().trim().to_string())
        })
    };
    if text.contains("Just a moment") || text.contains("cf-browser-verification") || text.contains("challenge-platform") || text.contains("Checking your browser") {
        if let Ok(parsed) = reqwest::Url::parse(&url) {
            return Ok(UrlMetadata { title: Some(format!("🔒 {}", parsed.host_str().unwrap_or("Protected Site"))), description: Some("This site uses bot protection. Preview not available.".to_string()), image: None, og_title: None, og_description: None, og_site_name: None, keywords: None, author: None, canonical: None, favicon: None });
        }
    }
    let title = regex::Regex::new(r"(?i)<title>([^<]*)</title>").ok().and_then(|re| re.captures(&text)).map(|c| c.get(1).unwrap().as_str().trim().to_string()).filter(|t| !t.is_empty() && !t.to_lowercase().contains("just a moment"));
    let favicon = regex::Regex::new(r#"(?i)<link[^>]+rel=[\"'](?:shortcut\s+)?icon[\"'][^>]+href=[\"']([^\"']*)[\"']"#).ok().and_then(|re| re.captures(&text)).map(|c| {
        let href = c.get(1).unwrap().as_str().trim().to_string();
        if href.starts_with("http") { href } else if href.starts_with("//") { format!("https:{}", href) } else if href.starts_with("/") { if let Ok(parsed) = reqwest::Url::parse(&url) { format!("{}://{}{}", parsed.scheme(), parsed.host_str().unwrap_or(""), href) } else { href } } else { href }
    });
    Ok(UrlMetadata { title, description: extract_meta("description", "name"), image: extract_meta("og:image", "property"), og_title: extract_meta("og:title", "property"), og_description: extract_meta("og:description", "property"), og_site_name: extract_meta("og:site_name", "property"), keywords: extract_meta("keywords", "name"), author: extract_meta("author", "name"), canonical: regex::Regex::new(r#"(?i)<link\s+rel=[\"']canonical[\"']\s+href=[\"']([^\"']*)[\"']"#).ok().and_then(|re| re.captures(&text)).map(|c| c.get(1).unwrap().as_str().trim().to_string()), favicon })
}

#[tauri::command]
pub async fn run_ocr(path: String) -> Result<String, String> {
    ocr::extract_text_from_image(&path).await
}
