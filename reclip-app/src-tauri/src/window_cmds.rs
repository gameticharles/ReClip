use tauri::State;
use crate::db::DbState;

#[tauri::command]
pub async fn save_window_position(state: State<'_, DbState>, x: i32, y: i32, width: u32, height: u32) -> Result<(), String> {
    crate::db::set_setting(&state.pool, "window_x", &x.to_string()).await.map_err(|e| e.to_string())?;
    crate::db::set_setting(&state.pool, "window_y", &y.to_string()).await.map_err(|e| e.to_string())?;
    crate::db::set_setting(&state.pool, "window_width", &width.to_string()).await.map_err(|e| e.to_string())?;
    crate::db::set_setting(&state.pool, "window_height", &height.to_string()).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn load_window_position(state: State<'_, DbState>) -> Result<Option<(i32, i32, u32, u32)>, String> {
    let x = crate::db::get_setting(&state.pool, "window_x").await.and_then(|s| s.parse().ok());
    let y = crate::db::get_setting(&state.pool, "window_y").await.and_then(|s| s.parse().ok());
    let w = crate::db::get_setting(&state.pool, "window_width").await.and_then(|s| s.parse().ok());
    let h = crate::db::get_setting(&state.pool, "window_height").await.and_then(|s| s.parse().ok());
    
    if let (Some(x), Some(y), Some(w), Some(h)) = (x, y, w, h) {
        Ok(Some((x, y, w, h)))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn is_minimized_launch() -> bool {
    std::env::args().any(|arg| arg == "--minimized")
}
