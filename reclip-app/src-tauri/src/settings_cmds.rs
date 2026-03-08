use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use crate::db::{self, DbState};
use crate::clipboard;

/// Normalize shortcut string from plugin format to stored format
/// Plugin: "shift+control+alt+Digit1" -> Stored: "Ctrl+Shift+Alt+1"
pub fn normalize_shortcut(shortcut: &str) -> String {
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

pub struct ShortcutStateMap(pub Mutex<HashMap<String, String>>); // Shortcut -> Action

#[tauri::command]
pub async fn update_shortcut(app: tauri::AppHandle, state: State<'_, DbState>, map: State<'_, ShortcutStateMap>, action: String, new_shortcut: String) -> Result<(), String> {
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
pub async fn get_shortcuts(state: State<'_, DbState>) -> Result<HashMap<String, String>, String> {
    let mut shortcuts = HashMap::new();
    if let Some(s) = db::get_setting(&state.pool, "shortcut_show_window").await { shortcuts.insert("show_window".to_string(), s); }
    if let Some(s) = db::get_setting(&state.pool, "shortcut_show_quick").await { shortcuts.insert("show_quick".to_string(), s); }
    if let Some(s) = db::get_setting(&state.pool, "shortcut_incognito").await { shortcuts.insert("incognito".to_string(), s); }
    if let Some(s) = db::get_setting(&state.pool, "shortcut_paste_next").await { shortcuts.insert("paste_next".to_string(), s); }
    if let Some(s) = db::get_setting(&state.pool, "shortcut_global_search").await { shortcuts.insert("global_search".to_string(), s); }
    for i in 1..=9 {
        let key = format!("shortcut_paste_{}", i);
        if let Some(s) = db::get_setting(&state.pool, &key).await {
            shortcuts.insert(format!("paste_{}", i), s);
        }
    }
    Ok(shortcuts)
}

#[tauri::command]
pub async fn get_sensitive_settings(state: State<'_, DbState>) -> Result<(bool, u64), String> {
    let enabled = db::get_setting(&state.pool, "sensitive_auto_delete").await
        .map(|v| v != "false")
        .unwrap_or(true); // Default enabled
    let timer = db::get_setting(&state.pool, "sensitive_delete_timer").await
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(30); // Default 30 seconds
    Ok((enabled, timer))
}

#[tauri::command]
pub async fn set_sensitive_settings(state: State<'_, DbState>, enabled: bool, timer: u64) -> Result<(), String> {
    db::set_setting(&state.pool, "sensitive_auto_delete", if enabled { "true" } else { "false" })
        .await.map_err(|e| e.to_string())?;
    db::set_setting(&state.pool, "sensitive_delete_timer", &timer.to_string())
        .await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_maintenance_settings(state: State<'_, DbState>) -> Result<(bool, i64, bool, i64), String> {
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
pub async fn set_maintenance_settings(state: State<'_, DbState>, age_enabled: bool, age_days: i64, limit_enabled: bool, max_clips: i64) -> Result<(), String> {
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

#[tauri::command]
pub async fn get_autostart(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    let enabled = app.autolaunch().is_enabled().map_err(|e| e.to_string())?;
    Ok(enabled)
}

#[tauri::command]
pub async fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    if enabled {
        app.autolaunch().enable().map_err(|e| e.to_string())
    } else {
        app.autolaunch().disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn set_incognito_mode(enabled: bool) {
    clipboard::set_incognito(enabled);
}

#[tauri::command]
pub fn get_incognito_mode() -> bool {
    clipboard::is_incognito()
}

#[tauri::command]
pub async fn get_privacy_rules(state: State<'_, DbState>) -> Result<Vec<db::PrivacyRule>, String> {
    db::get_privacy_rules(&state.pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_privacy_rule(state: State<'_, DbState>, rule_type: String, value: String) -> Result<i64, String> {
    db::add_privacy_rule(&state.pool, rule_type, value).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_privacy_rule(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_privacy_rule(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_listen_to_self(state: State<'_, DbState>) -> Result<bool, String> {
    let enabled = db::get_setting(&state.pool, "listen_to_self").await
        .map(|v| v != "false")
        .unwrap_or(true); // Default true
    Ok(enabled)
}

#[tauri::command]
pub async fn set_listen_to_self(state: State<'_, DbState>, enabled: bool) -> Result<(), String> {
    db::set_setting(&state.pool, "listen_to_self", if enabled { "true" } else { "false" })
        .await.map_err(|e| e.to_string())?;
    Ok(())
}
