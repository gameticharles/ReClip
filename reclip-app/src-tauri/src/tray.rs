use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, Submenu},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

pub struct TrayState<R: Runtime> {
    pub incognito_item: CheckMenuItem<R>,
    pub always_on_top_item: CheckMenuItem<R>,
    pub recent_clips_menu: Submenu<R>,
}

/// Truncate text for tray display (max ~50 chars)
fn truncate_for_tray(text: &str) -> String {
    let cleaned = text.replace('\n', " ").replace('\r', "");
    if cleaned.len() > 50 {
        format!("{}…", &cleaned[..47])
    } else {
        cleaned
    }
}

/// Update the recent clips in the tray menu
pub fn update_tray_clips<R: Runtime>(app: &AppHandle<R>, clips: Vec<(i64, String, String)>) {
    let state = match app.try_state::<TrayState<R>>() {
        Some(s) => s,
        None => return,
    };

    let submenu = &state.recent_clips_menu;
    
    // Remove existing items
    let items: Vec<_> = submenu.items().unwrap_or_default();
    for item in items {
        let _ = submenu.remove(&item);
    }
    
    if clips.is_empty() {
        let empty_item = MenuItem::with_id(app, "clip_empty", "(No clips yet)", false, None::<&str>);
        if let Ok(item) = empty_item {
            let _ = submenu.append(&item);
        }
        return;
    }

    // Add clip items
    for (i, (_id, content, clip_type)) in clips.iter().enumerate() {
        let label = if clip_type == "image" {
            format!("🖼️ Image")
        } else if clip_type == "files" {
            "📁 Files".to_string()
        } else if clip_type == "html" {
            let text = html2text::from_read(content.as_bytes(), 80).unwrap_or_else(|_| content.clone());
            truncate_for_tray(&text)
        } else {
            truncate_for_tray(content)
        };
        
        let item_id = format!("tray_clip_{}", i);
        if let Ok(item) = MenuItem::with_id(app, &item_id, &label, true, None::<&str>) {
            let _ = submenu.append(&item);
        }
    }
}

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // 1. Create Menu Items

    // Main Actions
    let show_item = MenuItem::with_id(app, "show", "Show ReClip", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "Hide ReClip", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    // Features
    let is_incognito = crate::clipboard::is_incognito();
    let incognito_item = CheckMenuItem::with_id(
        app,
        "toggle_incognito",
        "Incognito Mode",
        true,
        is_incognito,
        None::<&str>,
    )?;

    let always_on_top_item = CheckMenuItem::with_id(
        app,
        "toggle_top",
        "Always on Top",
        true,
        false,
        None::<&str>,
    )?;

    // Tools
    let maintenance_item =
        MenuItem::with_id(app, "maintenance", "Run Maintenance", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;

    // Recent Clips Submenu (populated dynamically)
    let clip_empty = MenuItem::with_id(app, "clip_empty", "(No clips yet)", false, None::<&str>)?;
    let recent_clips_menu = Submenu::with_items(app, "Recent Clips", true, &[&clip_empty])?;

    // 2. Build Menu Structure
    let menu = Menu::with_items(
        app,
        &[
            &show_item,
            &hide_item,
            &tauri::menu::PredefinedMenuItem::separator(app)?,
            &incognito_item,
            &always_on_top_item,
            &tauri::menu::PredefinedMenuItem::separator(app)?,
            &recent_clips_menu,
            &maintenance_item,
            &settings_item,
            &tauri::menu::PredefinedMenuItem::separator(app)?,
            &quit_item,
        ],
    )?;

    // Store in app state
    app.manage(TrayState {
        incognito_item: incognito_item.clone(),
        always_on_top_item: always_on_top_item.clone(),
        recent_clips_menu: recent_clips_menu.clone(),
    });

    // 3. Create Tray Icon
    let _tray = TrayIconBuilder::with_id("tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .icon(app.default_window_icon().unwrap().clone())
        .on_menu_event(move |app, event| {
            let id = event.id.as_ref();
            match id {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "hide" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                "toggle_incognito" => {
                    let _ = app.emit("tray-toggle-incognito", ());
                }
                "toggle_top" => {
                    let _ = app.emit("tray-toggle-top", ());
                }
                "settings" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = app.emit("open-settings", ());
                    }
                }
                "maintenance" => {
                    let _ = app.emit("run-maintenance", ());
                }
                _ => {
                    // Handle tray clip clicks
                    if id.starts_with("tray_clip_") {
                        if let Ok(index) = id.trim_start_matches("tray_clip_").parse::<usize>() {
                            let app_clone = app.clone();
                            let db_state = app.state::<crate::db::DbState>();
                            let pool = db_state.pool.clone();
                            tauri::async_runtime::spawn(async move {
                                if let Ok(clips) = crate::db::get_clips(&pool, 10, 0, None, None, false).await {
                                    if let Some(clip) = clips.get(index) {
                                        if clip.type_ != "image" {
                                            if let Ok(mut cb) = arboard::Clipboard::new() {
                                                let _ = cb.set_text(&clip.content);
                                                let _ = app_clone.emit("notification", "Copied from tray!");
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    }
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

pub fn update_item_state<R: Runtime>(state: tauri::State<'_, TrayState<R>>, id: String, checked: bool) -> Result<(), String> {
    if id == "toggle_incognito" {
        let _ = state.incognito_item.set_checked(checked);
    } else if id == "toggle_top" {
        let _ = state.always_on_top_item.set_checked(checked);
    }
    Ok(())
}

pub async fn update_tray_history<R: Runtime>(app: &AppHandle<R>, state: tauri::State<'_, crate::db::DbState>) -> Result<(), String> {
    if let Ok(clips) = crate::db::get_clips(&state.pool, 10, 0, None, None, false).await {
        let tray_clips: Vec<(i64, String, String)> = clips.iter().map(|c| (c.id, c.content.clone(), c.type_.clone())).collect();
        update_tray_clips(app, tray_clips);
    }
    Ok(())
}
