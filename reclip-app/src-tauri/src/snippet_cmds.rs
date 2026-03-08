use tauri::State;
use crate::db::{self, DbState, Snippet};

#[tauri::command]
pub async fn get_snippets(state: State<'_, DbState>) -> Result<Vec<Snippet>, String> {
    db::get_snippets(&state.pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_snippet(state: State<'_, DbState>, title: String, content: String, language: String, tags: String, description: Option<String>, folder: Option<String>) -> Result<i64, String> {
    db::add_snippet(&state.pool, title, content, language, tags, description.unwrap_or_default(), folder.unwrap_or_default()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_snippet(state: State<'_, DbState>, id: i64, title: String, content: String, language: String, tags: String, description: Option<String>, folder: Option<String>) -> Result<(), String> {
    db::update_snippet(&state.pool, id, title, content, language, tags, description.unwrap_or_default(), folder.unwrap_or_default()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_snippet(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_snippet(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_snippet_favorite(state: State<'_, DbState>, id: i64) -> Result<bool, String> {
    db::toggle_snippet_favorite(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn duplicate_snippet(state: State<'_, DbState>, id: i64) -> Result<i64, String> {
    db::duplicate_snippet(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_snippets(state: State<'_, DbState>) -> Result<(), String> {
    db::delete_all_snippets(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_notes(state: State<'_, DbState>) -> Result<Vec<db::Note>, String> {
    db::get_notes(&state.pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_note(state: State<'_, DbState>, title: String, content: String, color: Option<String>, tags: Option<String>) -> Result<i64, String> {
    db::add_note(&state.pool, title, content, color, tags).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_note(state: State<'_, DbState>, id: i64, title: String, content: String, color: Option<String>, is_pinned: bool, is_archived: bool, tags: Option<String>) -> Result<(), String> {
    db::update_note(&state.pool, id, title, content, color, is_pinned, is_archived, tags).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_note(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_note(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_templates(state: State<'_, DbState>) -> Result<Vec<db::Template>, String> {
    db::get_templates(&state.pool).await.ok_or("Failed to fetch templates".to_string())
}

#[tauri::command]
pub async fn add_template(state: State<'_, DbState>, name: String, content: String) -> Result<i64, String> {
    db::add_template(&state.pool, &name, &content).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_template(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_template(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_template(state: State<'_, DbState>, id: i64, name: String, content: String) -> Result<(), String> {
    db::update_template(&state.pool, id, &name, &content).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reorder_items(state: State<'_, DbState>, table: String, id: i64, position: i64) -> Result<(), String> {
    db::update_item_position(&state.pool, &table, id, position).await.map_err(|e| e.to_string())
}
