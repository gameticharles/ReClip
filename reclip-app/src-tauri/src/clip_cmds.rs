use tauri::State;
use crate::db::{self, DbState, Clip};

#[tauri::command]
pub async fn get_recent_clips(state: State<'_, DbState>, limit: i64, offset: i64, search: Option<String>, type_filter: Option<String>, favorites_only: Option<bool>) -> Result<Vec<Clip>, String> {
    db::get_clips(&state.pool, limit, offset, search, type_filter, favorites_only.unwrap_or(false))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_clip_type_counts(state: State<'_, DbState>) -> Result<Vec<db::TypeCount>, String> {
    db::get_clip_type_counts(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn global_search(state: State<'_, DbState>, term: String, limit: Option<i64>) -> Result<Vec<db::GlobalSearchResult>, String> {
    db::global_search(&state.pool, &term, limit.unwrap_or(20))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_usage_stats(state: State<'_, DbState>) -> Result<db::UsageStats, String> {
    db::get_usage_stats(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_clip_stats(state: State<'_, DbState>, search: Option<String>) -> Result<db::ClipStats, String> {
    db::get_clip_stats(&state.pool, search)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_clip_dates(state: State<'_, DbState>, year: i32, month: i32) -> Result<Vec<db::DateCount>, String> {
    db::get_clip_dates(&state.pool, year, month)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_clip(app: tauri::AppHandle, state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_clip(&state.pool, id)
        .await
        .map_err(|e| e.to_string())?;
    let _ = crate::tray::update_tray_history(&app).await;
    Ok(())
}

#[tauri::command]
pub async fn clear_clips(app: tauri::AppHandle, state: State<'_, DbState>) -> Result<(), String> {
    db::delete_all_clips(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    let _ = crate::tray::update_tray_history(&app).await;
    Ok(())
}

#[tauri::command]
pub async fn reorder_clip(app: tauri::AppHandle, state: State<'_, DbState>, id: i64, position: i64) -> Result<(), String> {
    db::update_clip_position(&state.pool, id, position)
        .await
        .map_err(|e| e.to_string())?;
    let _ = crate::tray::update_tray_history(&app).await;
    Ok(())
}

#[tauri::command]
pub async fn update_clip_tags(app: tauri::AppHandle, state: State<'_, DbState>, id: i64, tags: String) -> Result<(), String> {
    db::update_clip_tags(&state.pool, id, tags)
        .await
        .map_err(|e| e.to_string())?;
    let _ = crate::tray::update_tray_history(&app).await;
    Ok(())
}

#[tauri::command]
pub async fn toggle_clip_pin(app: tauri::AppHandle, state: State<'_, DbState>, id: i64) -> Result<bool, String> {
    let res = db::toggle_pin(&state.pool, id).await.map_err(|e| e.to_string())?;
    let _ = crate::tray::update_tray_history(&app).await;
    Ok(res)
}

#[tauri::command]
pub async fn update_clip_content(app: tauri::AppHandle, state: State<'_, DbState>, id: i64, content: String) -> Result<(), String> {
    db::update_clip_content(&state.pool, id, content)
        .await
        .map_err(|e| e.to_string())?;
    let _ = crate::tray::update_tray_history(&app).await;
    Ok(())
}

#[tauri::command]
pub async fn toggle_clip_favorite(app: tauri::AppHandle, state: State<'_, DbState>, id: i64) -> Result<bool, String> {
    let res = db::toggle_favorite(&state.pool, id).await.map_err(|e| e.to_string())?;
    let _ = crate::tray::update_tray_history(&app).await;
    Ok(res)
}
