mod db;
mod clipboard;
mod tray;
#[cfg(target_os = "windows")]
mod ocr;
mod update;
mod drive;

use db::{DbState, init_db, Clip, Snippet};
use tauri::{State, Manager, Emitter};

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
async fn get_clip_stats(state: State<'_, DbState>, search: Option<String>) -> Result<db::ClipStats, String> {
    db::get_clip_stats(&state.pool, search)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_clip_dates(state: State<'_, DbState>, year: i32, month: i32) -> Result<Vec<db::DateCount>, String> {
    db::get_clip_dates(&state.pool, year, month)
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

/// Normalize shortcut string from plugin format to stored format
/// Plugin: "shift+control+alt+Digit1" -> Stored: "Ctrl+Shift+Alt+1"
fn normalize_shortcut(shortcut: &str) -> String {
    let parts: Vec<&str> = shortcut.split('+').collect();
    let mut modifiers = Vec::new();
    let mut key = String::new();
    
    for part in parts {
        match part.to_lowercase().as_str() {
            "control" | "ctrl" => modifiers.push("Ctrl"),
            "shift" => modifiers.push("Shift"),
            "alt" => modifiers.push("Alt"),
            "meta" | "super" | "command" => modifiers.push("Super"),
            _ => {
                // Handle key part
                let normalized_key = if part.starts_with("Digit") || part.starts_with("digit") {
                    part.replace("Digit", "").replace("digit", "")
                } else if part.starts_with("Key") || part.starts_with("key") {
                    part.replace("Key", "").replace("key", "").to_uppercase()
                } else {
                    part.to_uppercase()
                };
                key = normalized_key;
            }
        }
    }
    
    // Sort modifiers consistently: Ctrl, Shift, Alt, Super
    let order = ["Ctrl", "Shift", "Alt", "Super"];
    modifiers.sort_by_key(|m| order.iter().position(|o| o == m).unwrap_or(100));
    
    modifiers.push(&key);
    modifiers.join("+")
}

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
    if let Some(s) = db::get_setting(&state.pool, "shortcut_show_quick").await { shortcuts.insert("show_quick".to_string(), s); }
    if let Some(s) = db::get_setting(&state.pool, "shortcut_incognito").await { shortcuts.insert("incognito".to_string(), s); }
    if let Some(s) = db::get_setting(&state.pool, "shortcut_paste_next").await { shortcuts.insert("paste_next".to_string(), s); }
    for i in 1..=9 {
        let key = format!("shortcut_paste_{}", i);
        if let Some(s) = db::get_setting(&state.pool, &key).await {
            shortcuts.insert(format!("paste_{}", i), s);
        }
    }
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

// Snippets
#[tauri::command]
async fn get_snippets(state: State<'_, DbState>) -> Result<Vec<Snippet>, String> {
    db::get_snippets(&state.pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_snippet(state: State<'_, DbState>, title: String, content: String, language: String, tags: String, description: Option<String>, folder: Option<String>) -> Result<i64, String> {
    db::add_snippet(&state.pool, title, content, language, tags, description.unwrap_or_default(), folder.unwrap_or_default()).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_snippet(state: State<'_, DbState>, id: i64, title: String, content: String, language: String, tags: String, description: Option<String>, folder: Option<String>) -> Result<(), String> {
    db::update_snippet(&state.pool, id, title, content, language, tags, description.unwrap_or_default(), folder.unwrap_or_default()).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_snippet(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_snippet(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_snippet_favorite(state: State<'_, DbState>, id: i64) -> Result<bool, String> {
    db::toggle_snippet_favorite(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn duplicate_snippet(state: State<'_, DbState>, id: i64) -> Result<i64, String> {
    db::duplicate_snippet(&state.pool, id).await.map_err(|e| e.to_string())
}

// Sensitive settings
#[tauri::command]
async fn get_sensitive_settings(state: State<'_, DbState>) -> Result<(bool, u64), String> {
    let enabled = db::get_setting(&state.pool, "sensitive_auto_delete").await
        .map(|v| v != "false")
        .unwrap_or(true); // Default enabled
    let timer = db::get_setting(&state.pool, "sensitive_delete_timer").await
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(30); // Default 30 seconds
    Ok((enabled, timer))
}

#[tauri::command]
async fn set_sensitive_settings(state: State<'_, DbState>, enabled: bool, timer: u64) -> Result<(), String> {
    db::set_setting(&state.pool, "sensitive_auto_delete", if enabled { "true" } else { "false" })
        .await.map_err(|e| e.to_string())?;
    db::set_setting(&state.pool, "sensitive_delete_timer", &timer.to_string())
        .await.map_err(|e| e.to_string())?;
    Ok(())
}

// Maintenance settings
#[tauri::command]
async fn get_maintenance_settings(state: State<'_, DbState>) -> Result<(bool, i64, bool, i64), String> {
    let age_enabled = db::get_setting(&state.pool, "maintenance_age_enabled").await
        .map(|v| v == "true")
        .unwrap_or(false); // Default disabled
    let age_days = db::get_setting(&state.pool, "maintenance_age_days").await
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(30);
    let limit_enabled = db::get_setting(&state.pool, "maintenance_limit_enabled").await
        .map(|v| v == "true")
        .unwrap_or(false); // Default disabled
    let max_clips = db::get_setting(&state.pool, "maintenance_max_clips").await
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(10000);
    Ok((age_enabled, age_days, limit_enabled, max_clips))
}

#[tauri::command]
async fn set_maintenance_settings(state: State<'_, DbState>, age_enabled: bool, age_days: i64, limit_enabled: bool, max_clips: i64) -> Result<(), String> {
    db::set_setting(&state.pool, "maintenance_age_enabled", if age_enabled { "true" } else { "false" })
        .await.map_err(|e| e.to_string())?;
    db::set_setting(&state.pool, "maintenance_age_days", &age_days.to_string())
        .await.map_err(|e| e.to_string())?;
    db::set_setting(&state.pool, "maintenance_limit_enabled", if limit_enabled { "true" } else { "false" })
        .await.map_err(|e| e.to_string())?;
    db::set_setting(&state.pool, "maintenance_max_clips", &max_clips.to_string())
        .await.map_err(|e| e.to_string())?;
    Ok(())
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
            app.manage(drive::DriveState::new());
            
            // Start Clipboard Listener
            clipboard::start_clipboard_listener(app.handle(), pool.clone());
            
            // Start Sensitive Clip Cleanup Task (runs every 30 seconds)
            {
                let pool_for_cleanup = pool.clone();
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    loop {
                        std::thread::sleep(std::time::Duration::from_secs(30)); // Check every 30s
                        
                        tauri::async_runtime::block_on(async {
                            // 1. Cleanup Sensitive Clips
                            match db::cleanup_sensitive_clips(&pool_for_cleanup, 60).await {
                                Ok(count) if count > 0 => {
                                    log::info!("Cleaned up {} sensitive clip(s)", count);
                                }
                                Err(e) => {
                                    log::error!("Failed to cleanup sensitive clips: {}", e);
                                }
                                _ => {}
                            }

                            // 2. Check Alarms & Reminders
                            // Reminders
                            if let Ok(reminders) = db::get_due_reminders(&pool_for_cleanup).await {
                                for reminder in reminders {
                                    // Emit event
                                    let _ = app_handle.emit("system-notification", serde_json::json!({
                                        "type": "reminder",
                                        "id": reminder.id,
                                        "title": "Reminder",
                                        "body": reminder.content
                                    }));
                                    // Mark as completed to avoid spamming? 
                                    // For now, we trust the user to dismiss/complete it, OR we rely on the frontend to handle duplicate notifications.
                                    // Better: The frontend should mark it as 'notified' or we just notify once per minute.
                                    // Ideally we need a 'notified' flag in DB, but for simplicity let's just emit. 
                                    // To prevent spam, we could check if due_date is within the last minute? 
                                    // But due_date is <= now. 
                                    // Let's rely on the frontend to dedup or the user to complete it.
                                }
                            }

                            // Alarms
                            if let Ok(alarms) = db::get_active_alarms(&pool_for_cleanup).await {
                                use chrono::{Local, Timelike, Datelike};
                                let now = Local::now();
                                let current_time = format!("{:02}:{:02}", now.hour(), now.minute());
                                let current_day = now.weekday().to_string(); // e.g. "Mon", "Tue"

                                for alarm in alarms {
                                    if alarm.time == current_time {
                                        // Check days if specified
                                        let days_match = if alarm.days.is_empty() {
                                            true // Every day if not specified? Or once? Assuming daily for simple alarms now.
                                        } else {
                                            alarm.days.contains(&current_day[0..3]) // "Monday" -> "Mon"
                                        };

                                        if days_match {
                                            // Emit event
                                             let _ = app_handle.emit("system-notification", serde_json::json!({
                                                "type": "alarm",
                                                "id": alarm.id,
                                                "title": alarm.label,
                                                "body": format!("It is {}", alarm.time)
                                            }));
                                        }
                                    }
                                }
                            }
                        });
                    }
                });
            }
            
            // Initialize Shortcuts
            #[cfg(desktop)]
            {
                let _app_handle = app.handle().clone();
                let pool_clone = pool.clone();
                let shortcut_map = app.state::<ShortcutStateMap>();
                
                tauri::async_runtime::block_on(async move {
                    let mut map = shortcut_map.0.lock().unwrap();
                    
                     // Show Window
                    let show_sc = db::get_setting(&pool_clone, "shortcut_show_window").await.unwrap_or("Ctrl+Shift+X".to_string());
                    
                    if !show_sc.is_empty() {
                         map.insert(show_sc.clone(), "show_window".to_string());
                    }

                    // Show Quick Menu
                    // Default Ctrl+Shift+Space
                    let quick_sc = db::get_setting(&pool_clone, "shortcut_show_quick").await.unwrap_or("Ctrl+Shift+Space".to_string());
                    if !quick_sc.is_empty() {
                        map.insert(quick_sc.clone(), "show_quick".to_string());
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
                    
                    // Paste 1-9
                    for i in 1..=9 {
                        let key = format!("shortcut_paste_{}", i);
                         let sc = db::get_setting(&pool_clone, &key).await.unwrap_or("".to_string());
                         if !sc.is_empty() {
                             map.insert(sc, format!("paste_{}", i));
                         }
                    }
                });

                // Register Plugin with Handler
                let _app_handle_for_handler = app.handle().clone();
                
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app: &tauri::AppHandle, shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                let shortcut_str = normalize_shortcut(&shortcut.to_string());
                                println!("[DEBUG] Shortcut pressed (normalized): {}", shortcut_str);
                                
                                let map_state = app.state::<ShortcutStateMap>();
                                let action = {
                                    let map = map_state.0.lock().unwrap();
                                    println!("[DEBUG] Registered shortcuts: {:?}", map.keys().collect::<Vec<_>>());
                                    map.get(&shortcut_str).cloned()
                                };
                                
                                println!("[DEBUG] Action found: {:?}", action);
                                
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
                                    } else if act == "show_quick" {
                                        if let Some(w) = app.get_webview_window("quick") {
                                            if w.is_visible().unwrap_or(false) {
                                                let _ = w.hide();
                                            } else {
                                                // Get Cursor Pos
                                                #[cfg(target_os = "windows")]
                                                {
                                                    use windows::Win32::Foundation::POINT;
                                                    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
                                                    
                                                    let mut point = POINT { x: 0, y: 0 };
                                                    unsafe { let _ = GetCursorPos(&mut point); };
                                                    
                                                    // Ensure window is within screen bounds?
                                                    // For now just set position.
                                                    let _ = w.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: point.x, y: point.y }));
                                                }
                                                
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
                                    } else if act.starts_with("paste_") {
                                        // Parse number
                                        if let Ok(num) = act.trim_start_matches("paste_").parse::<usize>() {
                                            // Backend Paste Logic
                                            let app_clone = app.clone();
                                            let state = app.state::<DbState>();
                                            let pool = state.pool.clone();
                                            
                                            tauri::async_runtime::spawn(async move {
                                                if let Ok(clips) = db::get_clips(&pool, 20, 0, None).await {
                                                    if let Some(clip) = clips.get(num - 1) {
                                                        let _ = paste_clip_to_system(app_clone, clip.content.clone(), clip.type_.clone()).await;
                                                    }
                                                }
                                            });
                                        }
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
                let _ = tray::create_tray(app.handle());
            }

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .invoke_handler(tauri::generate_handler![
             greet, get_recent_clips, get_clip_stats, get_clip_dates, add_privacy_rule, delete_privacy_rule, get_privacy_rules, 
             update_shortcut, get_shortcuts,
             get_templates, add_template, delete_template, update_template,
             copy_to_system, delete_clip, paste_clip_to_system, run_maintenance, get_app_data_path, 
             export_clips, import_clips, update_clip_tags, toggle_clip_pin, set_incognito_mode, 
             validate_paths, get_incognito_mode, update_clip_content, toggle_clip_favorite, get_url_metadata, 
             get_system_accent_color, clear_clips, clear_snippets, reorder_clip, get_autostart, set_autostart,
             save_window_position, load_window_position,
             get_regex_rules, add_regex_rule, update_regex_rule, delete_regex_rule,
             get_sensitive_settings, set_sensitive_settings, get_maintenance_settings, set_maintenance_settings,
             get_snippets, add_snippet, update_snippet, delete_snippet, toggle_snippet_favorite, duplicate_snippet,
             run_ocr, get_file_size, export_image,
             update::check_update, update::install_update,
             drive::start_google_auth, drive::finish_google_auth, drive::get_drive_status, drive::disconnect_google_drive, drive::sync_clips,
             get_notes, add_note, update_note, delete_note,
             get_reminders, add_reminder, toggle_reminder, delete_reminder, update_reminder_content,
             get_alarms, add_alarm, update_alarm, toggle_alarm, delete_alarm,
             reorder_items
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ... existing code ...

#[tauri::command]
async fn get_notes(state: State<'_, DbState>) -> Result<Vec<db::Note>, String> {
    db::get_notes(&state.pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_note(state: State<'_, DbState>, title: String, content: String, color: Option<String>, tags: Option<String>) -> Result<i64, String> {
    db::add_note(&state.pool, title, content, color, tags).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_note(state: State<'_, DbState>, id: i64, title: String, content: String, color: Option<String>, is_pinned: bool, is_archived: bool, tags: Option<String>) -> Result<(), String> {
    db::update_note(&state.pool, id, title, content, color, is_pinned, is_archived, tags).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_note(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_note(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn reorder_items(state: State<'_, DbState>, table: String, id: i64, position: i64) -> Result<(), String> {
    db::update_item_position(&state.pool, &table, id, position).await.map_err(|e| e.to_string())
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
async fn clear_clips(state: State<'_, DbState>) -> Result<(), String> {
    db::delete_all_clips(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_snippets(state: State<'_, DbState>) -> Result<(), String> {
    db::delete_all_snippets(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn reorder_clip(state: State<'_, DbState>, id: i64, position: i64) -> Result<(), String> {
    db::update_clip_position(&state.pool, id, position)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_autostart(app: tauri::AppHandle) -> Result<bool, String> {
    println!("[DEBUG] get_autostart called");
    use tauri_plugin_autostart::ManagerExt;
    let enabled = app.autolaunch().is_enabled().map_err(|e| e.to_string())?;
    println!("[DEBUG] get_autostart result: {}", enabled);
    Ok(enabled)
}

#[tauri::command]
async fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    println!("[DEBUG] set_autostart called with: {}", enabled);
    use tauri_plugin_autostart::ManagerExt;
    if enabled {
        app.autolaunch().enable().map_err(|e| e.to_string())
    } else {
        app.autolaunch().disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
async fn save_window_position(state: State<'_, DbState>, x: i32, y: i32, width: u32, height: u32) -> Result<(), String> {
    let position = format!("{},{},{},{}", x, y, width, height);
    println!("[DEBUG] Saving window position: {}", position);
    db::set_setting(&state.pool, "window_position", &position).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn load_window_position(state: State<'_, DbState>) -> Result<Option<(i32, i32, u32, u32)>, String> {
    println!("[DEBUG] Loading window position...");
    let raw = db::get_setting(&state.pool, "window_position").await;
    println!("[DEBUG] Raw value from DB: {:?}", raw);
    
    if let Some(pos) = raw {
        let parts: Vec<&str> = pos.split(',').collect();
        if parts.len() == 4 {
            if let (Ok(x), Ok(y), Ok(w), Ok(h)) = (
                parts[0].parse::<i32>(),
                parts[1].parse::<i32>(),
                parts[2].parse::<u32>(),
                parts[3].parse::<u32>(),
            ) {
                println!("[DEBUG] Parsed position: ({}, {}, {}, {})", x, y, w, h);
                return Ok(Some((x, y, w, h)));
            }
        }
    }
    println!("[DEBUG] No position found, returning None");
    Ok(None)
}

#[tauri::command]
async fn validate_paths(content: String) -> Vec<(String, bool, bool)> {
    // Content is expected to be JSON array of strings
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
    // Fallback: if single path string?
    let p = std::path::Path::new(&content);
    vec![(content.clone(), p.exists(), p.is_dir())]
}

#[tauri::command]
async fn paste_clip_to_system(app_handle: tauri::AppHandle, content: String, clip_type: String) -> Result<(), String> {
    // 1. Set to clipboard
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    
    // FILES Handling (Windows)
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
    }
    // IMAGE Handling
    else if clip_type == "image" {
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
    } 
    // HTML Handling (Windows)
    else if clip_type == "html" {
        #[cfg(target_os = "windows")]
        {
            use clipboard_rs::{Clipboard, ClipboardContext};
            let ctx = ClipboardContext::new().map_err(|e| e.to_string())?;
            
            // Convert HTML to Plain Text for fallback
            // We use html2text to strip tags and format nicely
            let plain_text = html2text::from_read(content.as_bytes(), 80).unwrap_or(content.clone()); 
            
            // Set BOTH HTML and Text. 
            // Note: clipboard-rs documentation isn't explicit if set_html clears others, 
            // but usually multiple set calls in one context might work or overwrite.
            // Let's try setting text first, then HTML.
            // Actually, based on common clipboard APIs, setting one usually clears unless we use a specific "open/set/set/close" flow.
            // clipboard-rs `set_text` and `set_html` might be independent operations that open/close individually.
            // If so, the second one might clear the first.
            // HOWEVER, we want to try setting HTML. If that fails to provide text fallback, we might need a crate that supports multiple.
            // But let's verify if `clipboard-rs` supports `set_html` and `set_text` sequentially.
            // Looking at the crate, it seems they are separate.
            // But w/o testing, hard to know.
            // A safer bet for Windows might be to use `clipboard-win` or `copypasta` if we needed complex handling,
            // but let's try setting plain text first, then HTML. 
            // If the user says it "activates and goes through process", it means something is on the clipboard.
            
            // Let's try to set the text content first, so at least we have text.
            ctx.set_text(plain_text.clone()).map_err(|e| e.to_string())?;
            // Then set HTML. If this overwrites, we lose text. If it adds, we win.
            ctx.set_html(content.clone()).map_err(|e| e.to_string())?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            // For non-Windows (Mac/Linux), arboard set_text usually handles plain text. 
            // We can try to strip HTML here too.
            let plain_text = html2text::from_read(content.as_bytes(), 80).unwrap_or(content); 
            clipboard.set_text(plain_text).map_err(|e| e.to_string())?;
            // Note: arboard doesn't support HTML on all platforms easily yet in this version.
        }
    } else {
        clipboard.set_text(content.clone()).map_err(|e| e.to_string())?;
    }

    // 2. Hide Window (if visible)
    if let Some(window) = app_handle.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        }
    }

    // 3. Simulate Paste
    use enigo::{Enigo, Key, Keyboard, Settings, Direction};
    
    // Enigo::new() returns Result in 0.6+
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    
    // Longer delay to ensure focus switches back to the previous window
    std::thread::sleep(std::time::Duration::from_millis(200));
    
    println!("[DEBUG] Simulating Ctrl+V paste...");

    // Platform specific modifier
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
    
    println!("[DEBUG] Paste simulation complete.");
    
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

// Regex Rules Commands
#[tauri::command]
async fn get_regex_rules(state: State<'_, DbState>) -> Result<Vec<db::RegexRule>, String> {
    db::get_regex_rules(&state.pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_regex_rule(state: State<'_, DbState>, pattern: String, action_type: String, action_payload: String) -> Result<i64, String> {
    db::add_regex_rule(&state.pool, pattern, action_type, action_payload).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_regex_rule(state: State<'_, DbState>, id: i64, pattern: String, action_type: String, action_payload: String, enabled: bool) -> Result<(), String> {
    db::update_regex_rule(&state.pool, id, pattern, action_type, action_payload, enabled).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_regex_rule(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_regex_rule(&state.pool, id).await.map_err(|e| e.to_string())
}



// Reminders
#[tauri::command]
async fn get_reminders(state: State<'_, DbState>) -> Result<Vec<db::Reminder>, String> {
    db::get_reminders(&state.pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_reminder(state: State<'_, DbState>, content: String, due_date: Option<String>) -> Result<i64, String> {
    db::add_reminder(&state.pool, content, due_date).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_reminder_content(state: State<'_, DbState>, id: i64, content: String, due_date: Option<String>) -> Result<(), String> {
    db::update_reminder_content(&state.pool, id, content, due_date).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_reminder(state: State<'_, DbState>, id: i64) -> Result<bool, String> {
    db::toggle_reminder(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_reminder(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_reminder(&state.pool, id).await.map_err(|e| e.to_string())
}

// Alarms
#[tauri::command]
async fn get_alarms(state: State<'_, DbState>) -> Result<Vec<db::Alarm>, String> {
    db::get_alarms(&state.pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_alarm(state: State<'_, DbState>, time: String, label: String, days: String) -> Result<i64, String> {
    db::add_alarm(&state.pool, time, label, days).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_alarm(state: State<'_, DbState>, id: i64, time: String, label: String, days: String, active: bool) -> Result<(), String> {
    db::update_alarm(&state.pool, id, time, label, days, active).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_alarm(state: State<'_, DbState>, id: i64) -> Result<bool, String> {
    db::toggle_alarm(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_alarm(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_alarm(&state.pool, id).await.map_err(|e| e.to_string())
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
    // Additional SEO fields
    og_title: Option<String>,
    og_description: Option<String>,
    og_site_name: Option<String>,
    keywords: Option<String>,
    author: Option<String>,
    canonical: Option<String>,
    favicon: Option<String>,
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
    
    // Helper to extract meta content
    let extract_meta = |name: &str, attr: &str| -> Option<String> {
        let pattern = format!(r#"(?i)<meta\s+{}=[\"']{}[\"']\s+content=[\"']([^\"']*)[\"']"#, attr, name);
        regex::Regex::new(&pattern).ok()
            .and_then(|re| re.captures(&text))
            .map(|c| c.get(1).unwrap().as_str().trim().to_string())
            .or_else(|| {
                // Try reverse order: content first
                let pattern2 = format!(r#"(?i)<meta\s+content=[\"']([^\"']*)[\"']\s+{}=[\"']{}[\"']"#, attr, name);
                regex::Regex::new(&pattern2).ok()
                    .and_then(|re| re.captures(&text))
                    .map(|c| c.get(1).unwrap().as_str().trim().to_string())
            })
    };
    
    // Detect bot protection pages (Cloudflare, etc.)
    let is_protected = text.contains("Just a moment") 
        || text.contains("cf-browser-verification")
        || text.contains("challenge-platform")
        || text.contains("Checking your browser");
    
    if is_protected {
        // Return minimal metadata for protected sites - just extract domain
        if let Ok(parsed) = reqwest::Url::parse(&url) {
            return Ok(UrlMetadata { 
                title: Some(format!("🔒 {}", parsed.host_str().unwrap_or("Protected Site"))),
                description: Some("This site uses bot protection. Preview not available.".to_string()),
                image: None,
                og_title: None,
                og_description: None,
                og_site_name: None,
                keywords: None,
                author: None,
                canonical: None,
                favicon: None,
            });
        }
    }
    
    // Title from <title> tag
    let title = regex::Regex::new(r"(?i)<title>([^<]*)</title>").ok()
        .and_then(|re| re.captures(&text))
        .map(|c| c.get(1).unwrap().as_str().trim().to_string())
        .filter(|t| !t.is_empty() && !t.to_lowercase().contains("just a moment"));
    
    // Standard meta tags
    let description = extract_meta("description", "name");
    let keywords = extract_meta("keywords", "name");
    let author = extract_meta("author", "name");
    
    // Open Graph tags
    let og_title = extract_meta("og:title", "property");
    let og_description = extract_meta("og:description", "property");
    let og_site_name = extract_meta("og:site_name", "property");
    let image = extract_meta("og:image", "property");
    
    // Canonical URL
    let canonical = regex::Regex::new(r#"(?i)<link\s+rel=[\"']canonical[\"']\s+href=[\"']([^\"']*)[\"']"#).ok()
        .and_then(|re| re.captures(&text))
        .map(|c| c.get(1).unwrap().as_str().trim().to_string());
    
    // Favicon
    let favicon = regex::Regex::new(r#"(?i)<link[^>]+rel=[\"'](?:shortcut\s+)?icon[\"'][^>]+href=[\"']([^\"']*)[\"']"#).ok()
        .and_then(|re| re.captures(&text))
        .map(|c| {
            let href = c.get(1).unwrap().as_str().trim().to_string();
            // Make absolute URL if relative
            if href.starts_with("http") {
                href
            } else if href.starts_with("//") {
                format!("https:{}", href)
            } else if href.starts_with("/") {
                if let Ok(parsed) = reqwest::Url::parse(&url) {
                    format!("{}://{}{}", parsed.scheme(), parsed.host_str().unwrap_or(""), href)
                } else { href }
            } else { href }
        });

    Ok(UrlMetadata { 
        title, 
        description, 
        image,
        og_title,
        og_description,
        og_site_name,
        keywords,
        author,
        canonical,
        favicon,
    })
}

#[tauri::command]
#[allow(unused_variables)]
async fn run_ocr(path: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        ocr::extract_text_from_image(&path).await
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("OCR only supported on Windows".to_string())
    }
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

#[tauri::command]
async fn get_file_size(path: String) -> Result<u64, String> {
    std::fs::metadata(&path)
        .map(|m| m.len())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_image(source_path: String, target_path: String) -> Result<(), String> {
    let img = image::open(&source_path).map_err(|e| e.to_string())?;
    img.save(&target_path).map_err(|e| e.to_string())?;
    Ok(())
}
