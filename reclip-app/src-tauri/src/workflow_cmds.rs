use tauri::State;
use crate::db::{self, DbState};

#[tauri::command]
pub async fn get_workflows(state: State<'_, DbState>) -> Result<Vec<db::Workflow>, String> {
    db::get_workflows(&state.pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_workflow(state: State<'_, DbState>, name: String, trigger_type: String, trigger_pattern: String, action_type: String, action_value: String) -> Result<i64, String> {
    db::add_workflow(&state.pool, name, trigger_type, trigger_pattern, action_type, action_value).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_workflow(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_workflow(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_regex_rules(state: State<'_, DbState>) -> Result<Vec<db::RegexRule>, String> {
    db::get_regex_rules(&state.pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_regex_rule(state: State<'_, DbState>, pattern: String, action_type: String, action_payload: String) -> Result<i64, String> {
    db::add_regex_rule(&state.pool, pattern, action_type, action_payload).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_regex_rule(state: State<'_, DbState>, id: i64, pattern: String, action_type: String, action_payload: String, enabled: bool) -> Result<(), String> {
    db::update_regex_rule(&state.pool, id, pattern, action_type, action_payload, enabled).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_regex_rule(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_regex_rule(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_reminders(state: State<'_, DbState>) -> Result<Vec<db::Reminder>, String> {
    db::get_reminders(&state.pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_reminder(state: State<'_, DbState>, content: String, due_date: Option<String>) -> Result<i64, String> {
    db::add_reminder(&state.pool, content, due_date).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_reminder_content(state: State<'_, DbState>, id: i64, content: String, due_date: Option<String>) -> Result<(), String> {
    db::update_reminder_content(&state.pool, id, content, due_date).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_reminder(state: State<'_, DbState>, id: i64) -> Result<bool, String> {
    db::toggle_reminder(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_reminder(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_reminder(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_alarms(state: State<'_, DbState>) -> Result<Vec<db::Alarm>, String> {
    db::get_alarms(&state.pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_alarm(state: State<'_, DbState>, time: String, label: String, days: String) -> Result<i64, String> {
    db::add_alarm(&state.pool, time, label, days).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_alarm(state: State<'_, DbState>, id: i64, time: String, label: String, days: String, active: bool) -> Result<(), String> {
    db::update_alarm(&state.pool, id, time, label, days, active).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_alarm(state: State<'_, DbState>, id: i64) -> Result<bool, String> {
    db::toggle_alarm(&state.pool, id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_alarm(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    db::delete_alarm(&state.pool, id).await.map_err(|e| e.to_string())
}
