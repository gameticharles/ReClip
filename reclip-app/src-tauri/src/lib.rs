mod db;
mod clipboard;
mod tray;
mod ocr;
mod drive;
mod crypto;
mod api;
mod clip_cmds;
mod snippet_cmds;
mod settings_cmds;
mod workflow_cmds;
mod system_cmds;
mod window_cmds;
mod maintenance_cmds;

use db::{DbState, init_db};
use tauri::{Manager, Emitter};
use std::collections::HashMap;
use std::sync::Mutex;
use settings_cmds::{ShortcutStateMap, normalize_shortcut};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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
            
            // Start IDE Plugin API Server (Axum) on port 14201
            let api_pool = pool.clone();
            tauri::async_runtime::spawn(async move {
                api::start_api_server(DbState { pool: api_pool }).await;
            });
            
            // Start Clipboard Listener
            clipboard::start_clipboard_listener(app.handle(), pool.clone());
            
            // Start Sensitive Clip Cleanup Task (runs every 30 seconds)
            {
                let pool_for_cleanup = pool.clone();
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    loop {
                        std::thread::sleep(std::time::Duration::from_secs(30)); 
                        
                        tauri::async_runtime::block_on(async {
                            // 1. Cleanup Sensitive Clips
                            let _ = db::cleanup_sensitive_clips(&pool_for_cleanup, 60).await;

                            // 2. Check Alarms & Reminders
                            if let Ok(reminders) = db::get_due_reminders(&pool_for_cleanup).await {
                                for reminder in reminders {
                                    let _ = app_handle.emit("system-notification", serde_json::json!({
                                        "type": "reminder",
                                        "id": reminder.id,
                                        "title": "Reminder",
                                        "body": reminder.content
                                    }));
                                }
                            }

                            if let Ok(alarms) = db::get_active_alarms(&pool_for_cleanup).await {
                                use chrono::{Local, Timelike, Datelike};
                                let now = Local::now();
                                let current_time = format!("{:02}:{:02}", now.hour(), now.minute());
                                let current_day = now.weekday().to_string(); 

                                for alarm in alarms {
                                    if alarm.time == current_time {
                                        let days_match = if alarm.days.is_empty() { true } else { alarm.days.contains(&current_day[0..3]) };
                                        if days_match {
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
                let pool_clone = pool.clone();
                let shortcut_map = app.state::<ShortcutStateMap>();
                
                tauri::async_runtime::block_on(async move {
                    let mut map = shortcut_map.0.lock().unwrap();
                    if let Some(s) = db::get_setting(&pool_clone, "shortcut_show_window").await { map.insert(s, "show_window".to_string()); }
                    if let Some(s) = db::get_setting(&pool_clone, "shortcut_show_quick").await { map.insert(s, "show_quick".to_string()); }
                    if let Some(s) = db::get_setting(&pool_clone, "shortcut_incognito").await { map.insert(s, "incognito".to_string()); }
                    if let Some(s) = db::get_setting(&pool_clone, "shortcut_paste_next").await { map.insert(s, "paste_next".to_string()); }
                    for i in 1..=9 {
                         if let Some(s) = db::get_setting(&pool_clone, &format!("shortcut_paste_{}", i)).await { map.insert(s, format!("paste_{}", i)); }
                    }
                });

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app: &tauri::AppHandle, shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                let shortcut_str = normalize_shortcut(&shortcut.to_string());
                                let map_state = app.state::<ShortcutStateMap>();
                                let action = {
                                    let map = map_state.0.lock().unwrap();
                                    map.get(&shortcut_str).cloned()
                                };
                                
                                if let Some(act) = action {
                                    if act == "show_window" {
                                        if let Some(w) = app.get_webview_window("main") {
                                            if w.is_visible().unwrap_or(false) { let _ = w.hide(); } else { let _ = w.show(); let _ = w.set_focus(); }
                                        }
                                    } else if act == "show_quick" {
                                        if let Some(w) = app.get_webview_window("quick") {
                                            if w.is_visible().unwrap_or(false) { let _ = w.hide(); } else {
                                                #[cfg(target_os = "windows")]
                                                {
                                                    use windows::Win32::Foundation::POINT;
                                                    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
                                                    let mut point = POINT { x: 0, y: 0 };
                                                    unsafe { let _ = GetCursorPos(&mut point); };
                                                    let _ = w.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: point.x, y: point.y }));
                                                }
                                                let _ = w.show(); let _ = w.set_focus();
                                            }
                                        }
                                    } else if act == "incognito" {
                                        let current = crate::clipboard::is_incognito();
                                        crate::clipboard::set_incognito(!current);
                                        let _ = app.emit("incognito-changed", !current);
                                    } else if act == "paste_next" {
                                        let _ = app.emit("paste-next-trigger", ());
                                    } else if act.starts_with("paste_") {
                                        if let Ok(num) = act.trim_matches(|c: char| !c.is_numeric()).parse::<usize>() {
                                            let app_clone = app.clone();
                                            let state = app.state::<DbState>();
                                            let pool = state.pool.clone();
                                            tauri::async_runtime::spawn(async move {
                                                if let Ok(clips) = db::get_clips(&pool, 20, 0, None, None, false).await {
                                                    if let Some(clip) = clips.get(num - 1) {
                                                        let _ = system_cmds::paste_clip_to_system(app_clone, clip.content.clone(), clip.type_.clone()).await;
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

                let map_r = app.state::<ShortcutStateMap>();
                let map = map_r.0.lock().unwrap();
                for (sc, _) in map.iter() { let _ = app.global_shortcut().register(sc.as_str()); }
            }

            // Setup System Tray
            #[cfg(desktop)]
            {
                let _ = tray::create_tray(app.handle());
                let pool_for_tray = pool.clone();
                let app_for_tray = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Ok(clips) = db::get_clips(&pool_for_tray, 10, 0, None, None, false).await {
                        let tray_clips: Vec<(i64, String, String)> = clips.iter().map(|c| (c.id, c.content.clone(), c.type_.clone())).collect();
                        tray::update_tray_clips(&app_for_tray, tray_clips);
                    }
                });
            }

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .invoke_handler(tauri::generate_handler![
             greet,
             clip_cmds::get_recent_clips, clip_cmds::get_clip_stats, clip_cmds::get_clip_dates, clip_cmds::get_clip_type_counts, clip_cmds::global_search, clip_cmds::get_usage_stats,
             clip_cmds::delete_clip, clip_cmds::clear_clips, clip_cmds::reorder_clip, clip_cmds::update_clip_tags, clip_cmds::toggle_clip_pin, clip_cmds::update_clip_content, clip_cmds::toggle_clip_favorite,
             snippet_cmds::get_snippets, snippet_cmds::add_snippet, snippet_cmds::update_snippet, snippet_cmds::delete_snippet, snippet_cmds::toggle_snippet_favorite, snippet_cmds::duplicate_snippet, snippet_cmds::clear_snippets,
             snippet_cmds::get_notes, snippet_cmds::add_note, snippet_cmds::update_note, snippet_cmds::delete_note,
             snippet_cmds::get_templates, snippet_cmds::add_template, snippet_cmds::delete_template, snippet_cmds::update_template,
             snippet_cmds::reorder_items,
             settings_cmds::update_shortcut, settings_cmds::get_shortcuts,
             settings_cmds::get_sensitive_settings, settings_cmds::set_sensitive_settings, settings_cmds::get_maintenance_settings, settings_cmds::set_maintenance_settings,
             settings_cmds::get_autostart, settings_cmds::set_autostart, settings_cmds::get_incognito_mode, settings_cmds::set_incognito_mode,
             settings_cmds::get_privacy_rules, settings_cmds::add_privacy_rule, settings_cmds::delete_privacy_rule,
             workflow_cmds::get_workflows, workflow_cmds::add_workflow, workflow_cmds::delete_workflow,
             workflow_cmds::get_regex_rules, workflow_cmds::add_regex_rule, workflow_cmds::update_regex_rule, workflow_cmds::delete_regex_rule,
             workflow_cmds::get_reminders, workflow_cmds::add_reminder, workflow_cmds::update_reminder_content, workflow_cmds::toggle_reminder, workflow_cmds::delete_reminder,
             workflow_cmds::get_alarms, workflow_cmds::add_alarm, workflow_cmds::update_alarm, workflow_cmds::toggle_alarm, workflow_cmds::delete_alarm,
             system_cmds::copy_to_system, system_cmds::paste_clip_to_system, system_cmds::validate_paths, system_cmds::get_app_data_path, system_cmds::get_system_accent_color, system_cmds::get_file_size, system_cmds::export_image, system_cmds::get_url_metadata, system_cmds::run_ocr,
             window_cmds::save_window_position, window_cmds::load_window_position, window_cmds::is_minimized_launch,
             maintenance_cmds::run_maintenance, maintenance_cmds::export_clips, maintenance_cmds::import_clips, maintenance_cmds::update_tray_item_state, maintenance_cmds::refresh_tray_clips,
             drive::start_google_auth, drive::finish_google_auth, drive::get_drive_status, drive::disconnect_google_drive, drive::sync_clips
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
