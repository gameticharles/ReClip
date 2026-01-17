use std::thread;
use std::time::Duration;
use std::sync::atomic::{AtomicBool, Ordering};
use arboard::Clipboard;
use sqlx::{Pool, Sqlite};
use log::{info, error};
use tauri::{Manager, Emitter};

use crate::db::insert_clip;

// Global incognito mode flag
pub static INCOGNITO_MODE: AtomicBool = AtomicBool::new(false);

pub fn set_incognito(enabled: bool) {
    INCOGNITO_MODE.store(enabled, Ordering::SeqCst);
    if enabled {
        info!("Incognito mode enabled - clipboard capture paused");
    } else {
        info!("Incognito mode disabled - clipboard capture resumed");
    }
}

pub fn is_incognito() -> bool {
    INCOGNITO_MODE.load(Ordering::SeqCst)
}

use x_win::get_active_window;
use regex::Regex;

// ... (existing imports, but make sure to include them if not present)

pub fn start_clipboard_listener<R: tauri::Runtime>(app: &tauri::AppHandle<R>, pool: Pool<Sqlite>) {
    let pool = pool.clone();
    let app_handle = app.clone();
    
    thread::spawn(move || {
        let mut clipboard = match Clipboard::new() {
            Ok(cb) => cb,
            Err(e) => {
                error!("Failed to initialize clipboard: {}", e);
                return;
            }
        };

        let mut last_hash = String::new();

        loop {
            // Skip capture if incognito mode is enabled
            if is_incognito() {
                thread::sleep(Duration::from_millis(1000));
                continue;
            }
            
            // Get Active Window (Sync)
            let active_window = get_active_window().ok();

            // Helper to process text
            let text_result = clipboard.get_text();
            if let Ok(text) = text_result {
                if !text.trim().is_empty() {
                    let hash = blake3::hash(text.as_bytes()).to_string();
                    if hash != last_hash {
                        let pool_clone = pool.clone();
                        let text_clone = text.clone();
                        let hash_clone = hash.clone();
                        let app_handle_clone = app_handle.clone();
                        let active_window_clone = active_window.clone();
                        
                        // Async Processing for DB
                        tauri::async_runtime::spawn(async move {
                            // Fetch Privacy Rules
                            let rules = crate::db::get_privacy_rules(&pool_clone).await.unwrap_or_default();
                            let mut ignored = false;
                            
                            // Check App Ignore Rules
                            if let Some(aw) = &active_window_clone {
                                let app_name = aw.info.name.to_lowercase();
                                let title = aw.title.to_lowercase();
                                for rule in &rules {
                                    if rule.rule_type == "APP_IGNORE" {
                                        let val = rule.value.to_lowercase();
                                        if !val.is_empty() && (app_name.contains(&val) || title.contains(&val)) {
                                            ignored = true;
                                            info!("Ignored clip: matches app rule '{}' (App: {}, Title: {})", rule.value, app_name, title);
                                            break;
                                        }
                                    }
                                }
                            }
                            if ignored { return; }

                            // Check Privacy Filters (Regex)
                            for rule in &rules {
                                if rule.rule_type == "REGEX_MASK" {
                                    if let Ok(re) = Regex::new(&rule.value) {
                                        if re.is_match(&text_clone) {
                                            ignored = true;
                                            info!("Ignored clip: matches regex rule '{}'", rule.value);
                                            break;
                                        }
                                    }
                                }
                            }
                            if ignored { return; }
                            
                            // Last Hash Update is technically needed in the main loop to prevent re-triggering?
                            // Wait, if I update last_hash in main loop, I prevent re-triggering.
                            // But if I ignore it here, I haven't updated last_hash in main loop?
                            // Issue: Main loop updates `last_hash` (line 55 in original code).
                            // If I ignore it in async block, Main loop ALREADY updated last_hash, so it won't retry.
                            // This is Good behavior (we saw it, we ignored it, we move on).
                            
                           // Detect if content is a file path
                           let is_file_path = crate::clipboard::is_file_path(&text_clone);
                           let clip_type = if is_file_path { "file" } else { "text" };
                           
                           if is_file_path {
                               info!("New file path clip detected");
                           } else {
                               info!("New text clip detected");
                           }
                           
                           let tags = if is_file_path {
                               Some(serde_json::to_string(&vec!["#file"]).unwrap_or_default())
                           } else {
                               crate::clipboard::detect_tags(&text_clone)
                           };
                           
                           match insert_clip(&pool_clone, text_clone, clip_type.to_string(), hash_clone, tags).await {
                               Ok(id) => {
                                   let _ = app_handle_clone.emit("clip-created", id);
                               },
                               Err(e) => error!("Failed to insert clip: {}", e),
                           }
                        });
                        
                        // Update hash in main loop (sync)
                        last_hash = hash;
                    }
                }
            }

            // Process Images
            if let Ok(image) = clipboard.get_image() {
                 let hash = blake3::hash(&image.bytes).to_string();
                 if hash != last_hash {
                    info!("New image clip detected");
                    last_hash = hash.clone();

                    let width = image.width;
                    let height = image.height;
                    let bytes = image.bytes.into_owned();
                    
                    let pool_clone = pool.clone();
                    let hash_clone = hash.clone();
                    let app_handle_clone = app_handle.clone();

                    tauri::async_runtime::spawn(async move {
                         let app_dir = app_handle_clone.path().app_data_dir().unwrap();
                         let img_path = app_dir.join("images").join(format!("{}.png", hash_clone));
                         
                         if let Some(parent) = img_path.parent() {
                             let _ = std::fs::create_dir_all(parent);
                         }

                         // Save as PNG
                         // arboard returns Rgba8
                         match image::save_buffer(
                             &img_path,
                             &bytes,
                             width as u32,
                             height as u32,
                             image::ColorType::Rgba8
                         ) {
                             Ok(_) => {
                                 let content_path = img_path.to_string_lossy().to_string();
                                 match insert_clip(&pool_clone, content_path, "image".to_string(), hash_clone, None).await {
                                     Ok(id) => {
                                         let _ = app_handle_clone.emit("clip-created", id);
                                     },
                                     Err(e) => error!("Failed to insert image clip: {}", e),
                                 }
                             },
                             Err(e) => error!("Failed to save image to disk: {}", e)
                         }
                    });
                 }
            }
            
            thread::sleep(Duration::from_millis(1000));
        }
    });
}

fn detect_tags(content: &str) -> Option<String> {
    let mut tags = Vec::new();

    // Check for URL
    if content.starts_with("http://") || content.starts_with("https://") {
        tags.push("#url".to_string());
    }
    
    // Check for Email (simple heuristic)
    if content.contains("@") && content.contains(".") && !content.contains(" ") {
        tags.push("#email".to_string());
    }

    // Check for Color
    if content.starts_with("#") && (content.len() == 4 || content.len() == 7) {
        if content[1..].chars().all(|c| c.is_ascii_hexdigit()) {
             tags.push("#color".to_string());
        }
    }

    // Check for Code (simple heuristic)
    if content.contains("{") && content.contains("}") && (content.contains(";") || content.contains("fn ") || content.contains("def ")) {
        tags.push("#code".to_string());
    }

    if tags.is_empty() {
        None
    } else {
        Some(serde_json::to_string(&tags).unwrap_or_default())
    }
}

/// Check if content looks like a file path
fn is_file_path(content: &str) -> bool {
    let trimmed = content.trim();
    
    // Skip if it contains newlines (multiple lines)
    if trimmed.contains('\n') {
        return false;
    }
    
    // Windows absolute path (C:\..., D:\...)
    if trimmed.len() >= 3 && trimmed.chars().next().unwrap().is_ascii_alphabetic() 
        && trimmed.chars().nth(1) == Some(':') 
        && (trimmed.chars().nth(2) == Some('\\') || trimmed.chars().nth(2) == Some('/'))
    {
        return std::path::Path::new(trimmed).exists();
    }
    
    // Unix absolute path (/home/...)
    if trimmed.starts_with('/') && !trimmed.starts_with("//") {
        return std::path::Path::new(trimmed).exists();
    }
    
    false
}
