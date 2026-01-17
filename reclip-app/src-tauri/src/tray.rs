use tauri::{
    menu::{Menu, MenuItem, Submenu, CheckMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Runtime, Emitter, Manager,
};

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // 1. Create Menu Items
    
    // Main Actions
    let show_item = MenuItem::with_id(app, "show", "Show ReClip", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "Hide ReClip", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    // Features
    let incognito_item = CheckMenuItem::with_id(app, "toggle_incognito", "Incognito Mode", true, false, None::<&str>)?;
    let always_on_top_item = CheckMenuItem::with_id(app, "toggle_top", "Always on Top", true, false, None::<&str>)?;

    // Tools
    let maintenance_item = MenuItem::with_id(app, "maintenance", "Run Maintenance", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    
    // Recent Clips Submenu (Placeholder)
    // In a full implementation, this would be dynamic
    let clip1 = MenuItem::with_id(app, "clip_1", "(Empty)", false, None::<&str>)?;
    let recent_clips_menu = Submenu::with_items(
        app, 
        "Recent Clips", 
        true, 
        &[&clip1]
    )?;

    // 2. Build Menu Structure
    let menu = Menu::with_items(app, &[
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
    ])?;

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
                    // Logic to toggle incognito in backend state would go here
                    // For now we just emit an event to frontend
                    let _ = app.emit("tray-toggle-incognito", ());
                }
                 "toggle_top" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let new_state = !window.is_always_on_top().unwrap_or(false);
                        let _ = window.set_always_on_top(new_state);
                    }
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
                _ => {}
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
