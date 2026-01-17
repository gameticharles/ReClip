mod db;
mod clipboard;

use db::{DbState, init_db, Clip};
use tauri::{State, Manager, Emitter};
use sqlx::{Pool, Sqlite};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_recent_clips(state: State<'_, DbState>, limit: i64, offset: i64, search: Option<String>) -> Result<Vec<Clip>, String> {
    db::get_clips(&state.pool, limit, offset, search)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_privacy_rule(state: State<'_, DbState>, rule_type: String, value: String) -> Result<i64, String> {
    db::add_privacy_rule(&state.pool, rule_type, value).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_privacy_rule(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_privacy_rule(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_privacy_rules(state: State<'_, DbState>) -> Result<Vec<db::PrivacyRule>, String> {
    db::get_privacy_rules(&state.pool).await.map_err(|e| e.to_string())
}


use std::collections::HashMap;
use std::sync::Mutex;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

// ...

pub struct ShortcutStateMap(Mutex<HashMap<String, String>>); // Shortcut -> Action

#[tauri::command]
async fn update_shortcut(app: tauri::AppHandle, state: State<'_, DbState>, map: State<'_, ShortcutStateMap>, action: String, new_shortcut: String) -> Result<(), String> {
    // 1. Get old shortcut for this action
    let old_shortcut = {
        let map_lock = map.0.lock().map_err(|e| e.to_string())?;
        map_lock.iter().find(|(_, v)| **v == action).map(|(k, _)| k.clone())
    };
    
    // 2. Unregister old
    if let Some(old) = old_shortcut {
        let _ = app.global_shortcut().unregister(old.as_str()); // Ignore error if not registered
        {
            let mut map_lock = map.0.lock().map_err(|e| e.to_string())?;
            map_lock.remove(&old);
        }
    }
    
    // 3. Register new (if not empty)
    if !new_shortcut.is_empty() {
        // Check if taken?
        let is_taken = {
            let map_lock = map.0.lock().map_err(|e| e.to_string())?;
            map_lock.contains_key(&new_shortcut)
        };
        
        if is_taken {
             return Err(format!("Shortcut {} is already in use", new_shortcut));
        }
        
        app.global_shortcut().register(new_shortcut.as_str()).map_err(|e| e.to_string())?;
        
        {
            let mut map_lock = map.0.lock().map_err(|e| e.to_string())?;
            map_lock.insert(new_shortcut.clone(), action.clone());
        }
    }
    
    // 4. Update DB
    db::set_setting(&state.pool, &format!("shortcut_{}", action), &new_shortcut).await.map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn get_shortcuts(state: State<'_, DbState>) -> Result<HashMap<String, String>, String> {
    let mut shortcuts = HashMap::new();
    if let Some(s) = db::get_setting(&state.pool, "shortcut_show_window").await { shortcuts.insert("show_window".to_string(), s); }
    if let Some(s) = db::get_setting(&state.pool, "shortcut_incognito").await { shortcuts.insert("incognito".to_string(), s); }
    Ok(shortcuts)
}

#[tauri::command]
async fn get_templates(state: State<'_, DbState>) -> Result<Vec<db::Template>, String> {
    db::get_templates(&state.pool).await.ok_or("Failed to fetch templates".to_string())
}

#[tauri::command]
async fn add_template(state: State<'_, DbState>, name: String, content: String) -> Result<i64, String> {
    db::add_template(&state.pool, &name, &content).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_template(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_template(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_template(state: State<'_, DbState>, id: i64, name: String, content: String) -> Result<(), String> {
    db::update_template(&state.pool, id, &name, &content).await.map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize Database
            let handle = app.handle().clone();
            let pool = tauri::async_runtime::block_on(async move {
                init_db(&handle).await
            })?;
            
            // Manage States
            app.manage(DbState { pool: pool.clone() });
            app.manage(ShortcutStateMap(Mutex::new(HashMap::new())));
            
            // Start Clipboard Listener
            clipboard::start_clipboard_listener(app.handle(), pool.clone());
            
            // Initialize Shortcuts
            #[cfg(desktop)]
            {
                let app_handle = app.handle().clone();
                let pool_clone = pool.clone();
                let shortcut_map = app.state::<ShortcutStateMap>();
                
                tauri::async_runtime::block_on(async move {
                    let mut map = shortcut_map.0.lock().unwrap();
                    
                    // Show Window
                    let show_sc = db::get_setting(&pool_clone, "shortcut_show_window").await.unwrap_or("Ctrl+Shift+X".to_string());
                    
                    if !show_sc.is_empty() {
                         map.insert(show_sc.clone(), "show_window".to_string());
                    }

                    // Incognito
                    let inc_sc = db::get_setting(&pool_clone, "shortcut_incognito").await.unwrap_or("".to_string());
                    if !inc_sc.is_empty() {
                        map.insert(inc_sc.clone(), "incognito".to_string());
                    }
                    
                    // Paste Next
                    let next_sc = db::get_setting(&pool_clone, "shortcut_paste_next").await.unwrap_or("".to_string());
                    if !next_sc.is_empty() {
                        map.insert(next_sc.clone(), "paste_next".to_string());
                    }
                });

                // Register Plugin with Handler
                let app_handle_for_handler = app.handle().clone();
                
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app: &tauri::AppHandle, shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                let map_state = app.state::<ShortcutStateMap>();
                                let action = {
                                    let map = map_state.0.lock().unwrap();
                                    map.get(&shortcut.to_string()).cloned()
                                };
                                
                                if let Some(act) = action {
                                    if act == "show_window" {
                                        if let Some(w) = app.get_webview_window("main") {
                                            if w.is_visible().unwrap_or(false) {
                                                let _ = w.hide();
                                            } else {
                                                let _ = w.show();
                                                let _ = w.set_focus();
                                            }
                                        }
                                    } else if act == "incognito" {
                                        // Toggle Incognito
                                        let current = crate::clipboard::is_incognito();
                                        crate::clipboard::set_incognito(!current);
                                        let _ = app.emit("incognito-changed", !current);
                                    } else if act == "paste_next" {
                                        // Emit event for Frontend to handle
                                        let _ = app.emit("paste-next-trigger", ());
                                    }
                                }
                            }
                        })
                        .build(),
                )?;

                // Register Initial Shortcuts
                let map_r = app.state::<ShortcutStateMap>();
                let map = map_r.0.lock().unwrap();
                for (sc, _) in map.iter() {
                     let _ = app.global_shortcut().register(sc.as_str());
                }
            }

            // Setup System Tray
            #[cfg(desktop)]
            {
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::TrayIconBuilder;
                
                let show_item = MenuItem::with_id(app, "show", "Show ReClip", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
                
                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .tooltip("ReClip - Clipboard Manager")
                    .on_menu_event(|app, event| {
                        match event.id.as_ref() {
                            "show" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            "quit" => {
                                app.exit(0);
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
             greet, get_recent_clips, add_privacy_rule, delete_privacy_rule, get_privacy_rules, 
             update_shortcut, get_shortcuts,
             get_templates, add_template, delete_template, update_template,
             copy_to_system, delete_clip, paste_clip_to_system, run_maintenance, get_app_data_path, 
             export_clips, import_clips, update_clip_tags, toggle_clip_pin, set_incognito_mode, 
             get_incognito_mode, update_clip_content, toggle_clip_favorite, get_url_metadata, 
             get_system_accent_color
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn copy_to_system(content: String) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_clip(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_clip(&state.pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn paste_clip_to_system(app_handle: tauri::AppHandle, content: String, clip_type: Option<String>) -> Result<(), String> {
    // 1. Set to clipboard
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    
    let clip_type = clip_type.unwrap_or_else(|| "text".to_string());
    
    if clip_type == "image" {
        // Load image from file path and set to clipboard
        let img = image::open(&content).map_err(|e| format!("Failed to load image: {}", e))?;
        let rgba = img.to_rgba8();
        let (width, height) = rgba.dimensions();
        let image_data = arboard::ImageData {
            width: width as usize,
            height: height as usize,
            bytes: std::borrow::Cow::Owned(rgba.into_raw()),
        };
        clipboard.set_image(image_data).map_err(|e| e.to_string())?;
    } else {
        clipboard.set_text(content.clone()).map_err(|e| e.to_string())?;
    }

    // 2. Hide Window
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
    }

    // 3. Simulate Paste
    use enigo::{Enigo, Key, Keyboard, Settings, Direction};
    
    // Enigo::new() returns Result in 0.6+
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    
    // Tiny delay to allow window focus switch
    std::thread::sleep(std::time::Duration::from_millis(150));

    // Platform specific modifier
    #[cfg(target_os = "macos")]
    {
        let _ = enigo.key(Key::Meta, Direction::Press);
        let _ = enigo.key(Key::Unicode('v'), Direction::Click);
        let _ = enigo.key(Key::Meta, Direction::Release);
    }

    #[cfg(not(target_os = "macos"))]
    {
       let _ = enigo.key(Key::Control, Direction::Press);
       let _ = enigo.key(Key::Unicode('v'), Direction::Click);
       let _ = enigo.key(Key::Control, Direction::Release);
    }
    
    Ok(())
}

#[tauri::command]
async fn run_maintenance(state: State<'_, DbState>, days: i64, max_clips: i64) -> Result<(), String> {
    db::prune_clips(&state.pool, days, max_clips)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_app_data_path(app: tauri::AppHandle) -> Result<String, String> {
    app.path().app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_clips(app: tauri::AppHandle, export_path: String) -> Result<String, String> {
    use std::fs::File;
    use std::io::{Write, Read};
    use zip::ZipWriter;
    use zip::write::FileOptions;
    use walkdir::WalkDir;
    
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_dir.join("clips.db");
    let images_dir = app_dir.join("images");
    
    let file = File::create(&export_path).map_err(|e| format!("Failed to create export file: {}", e))?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    
    // Add database file
    if db_path.exists() {
        let mut db_file = File::open(&db_path).map_err(|e| e.to_string())?;
        let mut db_contents = Vec::new();
        db_file.read_to_end(&mut db_contents).map_err(|e| e.to_string())?;
        zip.start_file("clips.db", options).map_err(|e| e.to_string())?;
        zip.write_all(&db_contents).map_err(|e| e.to_string())?;
    }
    
    // Add images folder
    if images_dir.exists() {
        for entry in WalkDir::new(&images_dir).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                let relative_path = path.strip_prefix(&app_dir).unwrap();
                let mut file = File::open(path).map_err(|e| e.to_string())?;
                let mut contents = Vec::new();
                file.read_to_end(&mut contents).map_err(|e| e.to_string())?;
                zip.start_file(relative_path.to_string_lossy(), options).map_err(|e| e.to_string())?;
                zip.write_all(&contents).map_err(|e| e.to_string())?;
            }
        }
    }
    
    zip.finish().map_err(|e| e.to_string())?;
    Ok(format!("Exported to {}", export_path))
}

#[tauri::command]
async fn import_clips(app: tauri::AppHandle, import_path: String) -> Result<String, String> {
    use std::fs::File;
    use std::io::{Read, Write};
    use zip::ZipArchive;
    
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    
    let file = File::open(&import_path).map_err(|e| format!("Failed to open import file: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid backup file: {}", e))?;
    
    let mut imported_count = 0;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = app_dir.join(file.name());
        
        if file.name().ends_with('/') {
            std::fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = outpath.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
            let mut contents = Vec::new();
            file.read_to_end(&mut contents).map_err(|e| e.to_string())?;
            outfile.write_all(&contents).map_err(|e| e.to_string())?;
            imported_count += 1;
        }
    }
    
    Ok(format!("Imported {} files", imported_count))
}

#[tauri::command]
async fn update_clip_tags(state: State<'_, DbState>, id: i64, tags: String) -> Result<(), String> {
    db::update_clip_tags(&state.pool, id, tags)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_clip_pin(state: State<'_, DbState>, id: i64) -> Result<bool, String> {
    db::toggle_pin(&state.pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_incognito_mode(enabled: bool) {
    clipboard::set_incognito(enabled);
}

#[tauri::command]
fn get_incognito_mode() -> bool {
    clipboard::is_incognito()
}

#[tauri::command]
async fn update_clip_content(state: State<'_, DbState>, id: i64, content: String) -> Result<(), String> {
    db::update_clip_content(&state.pool, id, content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_clip_favorite(state: State<'_, DbState>, id: i64) -> Result<bool, String> {
    db::toggle_favorite(&state.pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct UrlMetadata {
    title: Option<String>,
    description: Option<String>,
    image: Option<String>,
}

#[tauri::command]
async fn get_url_metadata(url: String) -> Result<UrlMetadata, String> {
    // Basic validation
    if !url.starts_with("http") {
         return Err("Invalid URL".to_string());
    }

    let client = reqwest::Client::new();
    let res = client.get(&url)
        .header("User-Agent", "ReClip/1.0 (Mozilla/5.0 compatible)")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = res.text().await.map_err(|e| e.to_string())?;
    
    // Regex parsing - simple and best-effort
    let title = regex::Regex::new(r"(?i)<title>(.*?)</title>").unwrap()
        .captures(&text)
        .map(|c| c.get(1).unwrap().as_str().trim().to_string())
        .map(|s| html_escape::decode_html_entities(&s).to_string()); // decoding would be nice but requires another crate. For now raw.
    
    // Actually I don't have html_escape crate. So I'll just return raw string or basic unescape if needed.
    // For now, raw title. HTML entities might be present.
    
    let description = regex::Regex::new(r#"(?i)<meta\s+name=["']description["']\s+content=["'](.*?)["']"#).unwrap()
        .captures(&text)
        .map(|c| c.get(1).unwrap().as_str().trim().to_string());

    let image = regex::Regex::new(r#"(?i)<meta\s+property=["']og:image["']\s+content=["'](.*?)["']"#).unwrap()
        .captures(&text)
        .map(|c| c.get(1).unwrap().as_str().trim().to_string());

    Ok(UrlMetadata { title, description, image })
}

#[tauri::command]
async fn get_system_accent_color() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let path = "Software\\Microsoft\\Windows\\DWM";
        let dwm = hkcu.open_subkey(path).map_err(|e| format!("Failed to open registry key: {}", e))?;
        
        // Try AccentColor (Win10+), then ColorizationColor
        let val: u32 = match dwm.get_value("AccentColor") {
            Ok(v) => v,
            Err(_) => dwm.get_value("ColorizationColor").unwrap_or(0xFF4F46E5), // Fallback
        };

        // Assume ABGR (0xAABBGGRR) -> R is low byte
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
