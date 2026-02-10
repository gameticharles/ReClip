use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite, Row};
use std::fs;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Clip {
    pub id: i64,
    pub content: String,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub type_: String, // "text", "image", "file_list"
    pub hash: String,
    pub created_at: String,
    pub pinned: bool,
    pub favorite: bool,
    pub tags: Option<String>,
    pub sender_app: Option<String>,
    pub sensitive: bool,
    pub position: Option<i64>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct RegexRule {
    pub id: i64,
    pub pattern: String,
    pub action_type: String, // "open_url", "copy_back", "notify"
    pub action_payload: String,
    pub enabled: bool,
    pub created_at: String,
}

pub struct DbState {
    pub pool: Pool<Sqlite>,
}

pub async fn init_db(app_handle: &AppHandle) -> Result<Pool<Sqlite>, Box<dyn std::error::Error>> {
    let app_dir = app_handle.path().app_data_dir()?;
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }
    let db_path = app_dir.join("reclip.db");
    let db_url = format!("sqlite://{}", db_path.to_string_lossy());

    // Create the database file if it doesn't exist (sqlx requires this for some setups, but SqlitePoolOptions can create it)
    if !db_path.exists() {
        fs::File::create(&db_path)?;
    }

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await?;

    // Create regex_rules table if not exists (migrating manually for robustness in this step)
    sqlx::query("CREATE TABLE IF NOT EXISTS regex_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_payload TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )").execute(&pool).await?;

    // Create notes table
    sqlx::query("CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT DEFAULT '',
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )").execute(&pool).await?;

    // Migration: Add title column if it doesn't exist (for existing users)
    // We ignore the error if column already exists
    let _ = sqlx::query("ALTER TABLE notes ADD COLUMN title TEXT DEFAULT ''").execute(&pool).await;

    // Migration: Add is_pinned, color, is_archived columns
    let _ = sqlx::query("ALTER TABLE notes ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT 0").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE notes ADD COLUMN color TEXT DEFAULT NULL").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE notes ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT 0").execute(&pool).await;

    // Create reminders table
    sqlx::query("CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        due_date DATETIME,
        completed BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )").execute(&pool).await?;

    // Create alarms table
    sqlx::query("CREATE TABLE IF NOT EXISTS alarms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        time TEXT NOT NULL,
        label TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT 1,
        days TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )").execute(&pool).await?;

    // Migration: Add tags and position columns to notes/reminders/alarms if needed
    let _ = sqlx::query("ALTER TABLE notes ADD COLUMN tags TEXT DEFAULT ''").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE notes ADD COLUMN position INTEGER DEFAULT 0").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE reminders ADD COLUMN position INTEGER DEFAULT 0").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE alarms ADD COLUMN position INTEGER DEFAULT 0").execute(&pool).await;

    Ok(pool)
}

// ... existing code ...

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Note {
    pub id: i64,
    pub title: Option<String>,
    pub content: String,
    pub is_pinned: bool,
    pub color: Option<String>,
    pub is_archived: bool,
    pub tags: Option<String>,
    pub position: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

pub async fn get_notes(pool: &Pool<Sqlite>) -> Result<Vec<Note>, sqlx::Error> {
    sqlx::query_as::<_, Note>("SELECT id, title, content, is_pinned, color, is_archived, tags, position, created_at, updated_at FROM notes ORDER BY is_pinned DESC, COALESCE(position, 0) DESC, updated_at DESC")
        .fetch_all(pool)
        .await
}

pub async fn add_note(pool: &Pool<Sqlite>, title: String, content: String, color: Option<String>, tags: Option<String>) -> Result<i64, sqlx::Error> {
    let id = sqlx::query("INSERT INTO notes (title, content, color, tags) VALUES (?, ?, ?, ?) RETURNING id")
        .bind(title)
        .bind(content)
        .bind(color)
        .bind(tags)
        .fetch_one(pool)
        .await?
        .get::<i64, _>(0);
    Ok(id)
}

pub async fn update_note(pool: &Pool<Sqlite>, id: i64, title: String, content: String, color: Option<String>, is_pinned: bool, is_archived: bool, tags: Option<String>) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE notes SET title = ?, content = ?, color = ?, is_pinned = ?, is_archived = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(title)
        .bind(content)
        .bind(color)
        .bind(is_pinned)
        .bind(is_archived)
        .bind(tags)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_note(pool: &Pool<Sqlite>, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM notes WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Reminder {
    pub id: i64,
    pub content: String,
    pub due_date: Option<String>,
    pub completed: bool,
    pub position: Option<i64>,
    pub created_at: String,
}

pub async fn get_reminders(pool: &Pool<Sqlite>) -> Result<Vec<Reminder>, sqlx::Error> {
    // Sort by: uncompleted first, then by due date (nulls last), then created_at
    sqlx::query_as::<_, Reminder>("SELECT id, content, due_date, completed, position, created_at FROM reminders ORDER BY completed ASC, CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, COALESCE(position, 0) DESC, created_at DESC")
        .fetch_all(pool)
        .await
}

pub async fn add_reminder(pool: &Pool<Sqlite>, content: String, due_date: Option<String>) -> Result<i64, sqlx::Error> {
    let id = sqlx::query("INSERT INTO reminders (content, due_date) VALUES (?, ?) RETURNING id")
        .bind(content)
        .bind(due_date)
        .fetch_one(pool)
        .await?
        .get::<i64, _>(0);
    Ok(id)
}

pub async fn update_reminder_content(pool: &Pool<Sqlite>, id: i64, content: String, due_date: Option<String>) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE reminders SET content = ?, due_date = ? WHERE id = ?")
        .bind(content)
        .bind(due_date)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn toggle_reminder(pool: &Pool<Sqlite>, id: i64) -> Result<bool, sqlx::Error> {
    sqlx::query("UPDATE reminders SET completed = NOT completed WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    
    let is_completed: bool = sqlx::query_scalar("SELECT completed FROM reminders WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;
        
    Ok(is_completed)
}

pub async fn delete_reminder(pool: &Pool<Sqlite>, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM reminders WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Alarm {
    pub id: i64,
    pub time: String,
    pub label: String,
    pub active: bool,
    pub days: String,
    pub position: Option<i64>,
    pub created_at: String,
}

pub async fn get_alarms(pool: &Pool<Sqlite>) -> Result<Vec<Alarm>, sqlx::Error> {
    sqlx::query_as::<_, Alarm>("SELECT id, time, label, active, days, position, created_at FROM alarms ORDER BY COALESCE(position, 0) DESC, time ASC")
        .fetch_all(pool)
        .await
}

pub async fn add_alarm(pool: &Pool<Sqlite>, time: String, label: String, days: String) -> Result<i64, sqlx::Error> {
    let id = sqlx::query("INSERT INTO alarms (time, label, days) VALUES (?, ?, ?) RETURNING id")
        .bind(time)
        .bind(label)
        .bind(days)
        .fetch_one(pool)
        .await?
        .get::<i64, _>(0);
    Ok(id)
}

pub async fn update_alarm(pool: &Pool<Sqlite>, id: i64, time: String, label: String, days: String, active: bool) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE alarms SET time = ?, label = ?, days = ?, active = ? WHERE id = ?")
        .bind(time)
        .bind(label)
        .bind(days)
        .bind(active)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn toggle_alarm(pool: &Pool<Sqlite>, id: i64) -> Result<bool, sqlx::Error> {
    sqlx::query("UPDATE alarms SET active = NOT active WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    
    let is_active: bool = sqlx::query_scalar("SELECT active FROM alarms WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;
        
    Ok(is_active)
}

pub async fn delete_alarm(pool: &Pool<Sqlite>, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM alarms WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_item_position(pool: &Pool<Sqlite>, table: &str, id: i64, position: i64) -> Result<(), sqlx::Error> {
    // Basic SQL injection protection: check table name whitelist
    if !["notes", "reminders", "alarms"].contains(&table) {
        return Err(sqlx::Error::RowNotFound); // Invalid table
    }
    
    let query = format!("UPDATE {} SET position = ? WHERE id = ?", table);
    sqlx::query(&query)
        .bind(position)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_due_reminders(pool: &Pool<Sqlite>) -> Result<Vec<Reminder>, sqlx::Error> {
    sqlx::query_as::<_, Reminder>("SELECT id, content, due_date, completed, position, created_at FROM reminders WHERE completed = 0 AND due_date IS NOT NULL AND due_date <= datetime('now')")
        .fetch_all(pool)
        .await
}

pub async fn get_active_alarms(pool: &Pool<Sqlite>) -> Result<Vec<Alarm>, sqlx::Error> {
    sqlx::query_as::<_, Alarm>("SELECT id, time, label, active, days, created_at FROM alarms WHERE active = 1")
        .fetch_all(pool)
        .await
}

pub async fn insert_clip(pool: &Pool<Sqlite>, content: String, type_: String, hash: String, tags: Option<String>) -> Result<i64, sqlx::Error> {
    insert_clip_with_sensitive(pool, content, type_, hash, tags, false).await
}

pub async fn insert_clip_with_sensitive(pool: &Pool<Sqlite>, content: String, type_: String, hash: String, tags: Option<String>, sensitive: bool) -> Result<i64, sqlx::Error> {
    let id = sqlx::query("INSERT INTO clips (content, type, hash, tags, sensitive) VALUES (?, ?, ?, ?, ?) 
        ON CONFLICT(hash) DO UPDATE SET created_at = CURRENT_TIMESTAMP
        RETURNING id")
        .bind(content)
        .bind(type_)
        .bind(hash)
        .bind(tags)
        .bind(sensitive)
        .fetch_one(pool)
        .await?
        .get::<i64, _>(0);

    Ok(id)
}

pub async fn update_clip_content(pool: &Pool<Sqlite>, id: i64, content: String) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE clips SET content = ? WHERE id = ?")
        .bind(content)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_clips(pool: &Pool<Sqlite>, limit: i64, offset: i64, search: Option<String>) -> Result<Vec<Clip>, sqlx::Error> {
    let query_str = if let Some(term) = search {
        format!(
            "SELECT id, content, type, hash, created_at, pinned, favorite, tags, sender_app, sensitive, position FROM clips 
             WHERE content LIKE '%{}%' OR tags LIKE '%{}%' 
             ORDER BY favorite DESC, pinned DESC, COALESCE(position, 0) DESC, created_at DESC LIMIT ? OFFSET ?", 
            term, term
        )
    } else {
        "SELECT id, content, type, hash, created_at, pinned, favorite, tags, sender_app, sensitive, position FROM clips ORDER BY favorite DESC, pinned DESC, COALESCE(position, 0) DESC, created_at DESC LIMIT ? OFFSET ?".to_string()
    };

    let clips = sqlx::query_as::<_, Clip>(&query_str)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;
    Ok(clips)
}

#[derive(Debug, serde::Serialize)]
pub struct ClipStats {
    pub total_count: i64,
    pub oldest_date: Option<String>,
    pub newest_date: Option<String>,
}

pub async fn get_clip_stats(pool: &Pool<Sqlite>, search: Option<String>) -> Result<ClipStats, sqlx::Error> {
    let (count_query, date_query) = if let Some(ref term) = search {
        (
            format!("SELECT COUNT(*) as count FROM clips WHERE content LIKE '%{}%' OR tags LIKE '%{}%'", term, term),
            format!("SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM clips WHERE content LIKE '%{}%' OR tags LIKE '%{}%'", term, term)
        )
    } else {
        (
            "SELECT COUNT(*) as count FROM clips".to_string(),
            "SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM clips".to_string()
        )
    };

    let count: i64 = sqlx::query_scalar(&count_query)
        .fetch_one(pool)
        .await?;

    let dates: (Option<String>, Option<String>) = sqlx::query_as(&date_query)
        .fetch_one(pool)
        .await?;

    Ok(ClipStats {
        total_count: count,
        oldest_date: dates.0,
        newest_date: dates.1,
    })
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct DateCount {
    pub date: String,
    pub count: i64,
}

pub async fn get_clip_dates(pool: &Pool<Sqlite>, year: i32, month: i32) -> Result<Vec<DateCount>, sqlx::Error> {
    // Get clip counts grouped by date for a specific month
    let query = format!(
        "SELECT DATE(created_at) as date, COUNT(*) as count FROM clips 
         WHERE strftime('%Y', created_at) = '{:04}' AND strftime('%m', created_at) = '{:02}'
         GROUP BY DATE(created_at) ORDER BY date",
        year, month
    );
    
    let dates = sqlx::query_as::<_, DateCount>(&query)
        .fetch_all(pool)
        .await?;
    
    Ok(dates)
}

pub async fn delete_clip(pool: &Pool<Sqlite>, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM clips WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn prune_clips(pool: &Pool<Sqlite>, days: i64, max_clips: i64) -> Result<(), sqlx::Error> {
    // 1. Delete clips older than X days, excluding pinned and favorites
    // Note: SQLite uses 'now', '-X days' syntax
    let date_query = format!("DELETE FROM clips WHERE created_at < date('now', '-{} days') AND pinned = 0 AND favorite = 0", days);
    sqlx::query(&date_query)
        .execute(pool)
        .await?;

    // 2. Delete excess clips, keeping the newest 'max_clips' (excluding pinned/favs)
    let count_query = format!("DELETE FROM clips WHERE id NOT IN (SELECT id FROM clips ORDER BY created_at DESC LIMIT {}) AND pinned = 0 AND favorite = 0", max_clips);
    sqlx::query(&count_query)
         .execute(pool)
         .await?;
         
    Ok(())
}

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Template {
    pub id: i64,
    pub name: String,
    pub content: String,
    pub created_at: String,
}

pub async fn get_templates(pool: &Pool<Sqlite>) -> Option<Vec<Template>> {
    sqlx::query_as::<_, Template>("SELECT id, name, content, created_at FROM templates ORDER BY name ASC")
        .fetch_all(pool)
        .await
        .ok()
}

pub async fn add_template(pool: &Pool<Sqlite>, name: &str, content: &str) -> Result<i64, sqlx::Error> {
    let id = sqlx::query("INSERT INTO templates (name, content) VALUES (?, ?)")
        .bind(name)
        .bind(content)
        .execute(pool)
        .await?
        .last_insert_rowid();
    Ok(id)
}

pub async fn delete_template(pool: &Pool<Sqlite>, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM templates WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_template(pool: &Pool<Sqlite>, id: i64, name: &str, content: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE templates SET name = ?, content = ? WHERE id = ?")
        .bind(name)
        .bind(content)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_clip_tags(pool: &Pool<Sqlite>, id: i64, tags: String) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE clips SET tags = ? WHERE id = ?")
        .bind(tags)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn toggle_pin(pool: &Pool<Sqlite>, id: i64) -> Result<bool, sqlx::Error> {
    // Toggle pinned status and return new value
    sqlx::query("UPDATE clips SET pinned = NOT pinned WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    
    let result = sqlx::query("SELECT pinned FROM clips WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;
    
    Ok(result.get::<bool, _>(0))
}

pub async fn toggle_favorite(pool: &Pool<Sqlite>, id: i64) -> Result<bool, sqlx::Error> {
    // Toggle favorite status and return new value
    sqlx::query("UPDATE clips SET favorite = NOT favorite WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    
    let result = sqlx::query("SELECT favorite FROM clips WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;
    
    Ok(result.get::<bool, _>(0))
}



#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct PrivacyRule {
    pub id: i64,
    pub rule_type: String,
    pub value: String,
    pub is_active: bool,
}

pub async fn add_privacy_rule(pool: &Pool<Sqlite>, rule_type: String, value: String) -> Result<i64, sqlx::Error> {
    let id = sqlx::query("INSERT INTO privacy_rules (rule_type, value) VALUES (?, ?) RETURNING id")
        .bind(rule_type)
        .bind(value)
        .fetch_one(pool)
        .await?
        .get::<i64, _>(0);
    Ok(id)
}

pub async fn delete_privacy_rule(pool: &Pool<Sqlite>, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM privacy_rules WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_privacy_rules(pool: &Pool<Sqlite>) -> Result<Vec<PrivacyRule>, sqlx::Error> {
    let rules = sqlx::query_as::<_, PrivacyRule>("SELECT * FROM privacy_rules WHERE is_active = 1")
        .fetch_all(pool)
        .await?;
    Ok(rules)
}

pub async fn get_setting(pool: &Pool<Sqlite>, key: &str) -> Option<String> {
    sqlx::query_scalar("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await
        .unwrap_or(None)
}

pub async fn set_setting(pool: &Pool<Sqlite>, key: &str, value: &str) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?")
        .bind(key)
        .bind(value)
        .bind(value)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_all_clips(pool: &Pool<Sqlite>) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM clips").execute(pool).await?;
    sqlx::query("DELETE FROM clip_fts").execute(pool).await?;
    Ok(())
}

pub async fn delete_all_snippets(pool: &Pool<Sqlite>) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM snippets").execute(pool).await?;
    Ok(())
}

/// Delete sensitive clips older than specified seconds
pub async fn cleanup_sensitive_clips(pool: &Pool<Sqlite>, max_age_seconds: i64) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM clips WHERE sensitive = 1 AND created_at < datetime('now', '-' || ? || ' seconds')"
    )
        .bind(max_age_seconds)
        .execute(pool)
        .await?;
    Ok(result.rows_affected())
}

/// Update clip position for drag-drop reordering
pub async fn update_clip_position(pool: &Pool<Sqlite>, id: i64, position: i64) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE clips SET position = ? WHERE id = ?")
        .bind(position)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}


pub async fn get_regex_rules(pool: &Pool<Sqlite>) -> Result<Vec<RegexRule>, sqlx::Error> {
    sqlx::query_as::<_, RegexRule>("SELECT id, pattern, action_type, action_payload, enabled, created_at FROM regex_rules ORDER BY created_at DESC")
        .fetch_all(pool)
        .await
}

pub async fn add_regex_rule(pool: &Pool<Sqlite>, pattern: String, action_type: String, action_payload: String) -> Result<i64, sqlx::Error> {
    let id = sqlx::query("INSERT INTO regex_rules (pattern, action_type, action_payload, enabled) VALUES (?, ?, ?, 1) RETURNING id")
        .bind(pattern)
        .bind(action_type)
        .bind(action_payload)
        .fetch_one(pool)
        .await?
        .get::<i64, _>(0);
    Ok(id)
}

pub async fn update_regex_rule(pool: &Pool<Sqlite>, id: i64, pattern: String, action_type: String, action_payload: String, enabled: bool) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE regex_rules SET pattern = ?, action_type = ?, action_payload = ?, enabled = ? WHERE id = ?")
        .bind(pattern)
        .bind(action_type)
        .bind(action_payload)
        .bind(enabled)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_regex_rule(pool: &Pool<Sqlite>, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM regex_rules WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Snippet {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub language: String,
    pub tags: String,
    pub favorite: bool,
    pub folder: String,
    pub description: String,
    pub version_history: String,
    pub created_at: String,
    pub updated_at: String,
}

pub async fn get_snippets(pool: &Pool<Sqlite>) -> Result<Vec<Snippet>, sqlx::Error> {
    sqlx::query_as::<_, Snippet>("SELECT id, title, content, language, tags, COALESCE(favorite, 0) as favorite, COALESCE(folder, '') as folder, COALESCE(description, '') as description, COALESCE(version_history, '[]') as version_history, created_at, updated_at FROM snippets ORDER BY favorite DESC, updated_at DESC")
        .fetch_all(pool)
        .await
}

pub async fn add_snippet(pool: &Pool<Sqlite>, title: String, content: String, language: String, tags: String, description: String, folder: String) -> Result<i64, sqlx::Error> {
    let id = sqlx::query("INSERT INTO snippets (title, content, language, tags, description, folder, favorite, version_history, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, '[]', CURRENT_TIMESTAMP) RETURNING id")
        .bind(title)
        .bind(content)
        .bind(language)
        .bind(tags)
        .bind(description)
        .bind(folder)
        .fetch_one(pool)
        .await?
        .get::<i64, _>(0);
    Ok(id)
}

pub async fn update_snippet(pool: &Pool<Sqlite>, id: i64, title: String, content: String, language: String, tags: String, description: String, folder: String) -> Result<(), sqlx::Error> {
    // First get current content for version history
    let old: Option<(String, String)> = sqlx::query_as("SELECT content, version_history FROM snippets WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    
    let new_history = if let Some((old_content, old_history)) = old {
        if old_content != content {
            // Append old content to version history
            let mut history: Vec<serde_json::Value> = serde_json::from_str(&old_history).unwrap_or_default();
            history.push(serde_json::json!({
                "content": old_content,
                "timestamp": chrono::Utc::now().to_rfc3339()
            }));
            // Keep only last 10 versions
            if history.len() > 10 {
                let skip_count = history.len() - 10;
                history = history.into_iter().skip(skip_count).collect();
            }
            serde_json::to_string(&history).unwrap_or_else(|_| "[]".to_string())
        } else {
            old_history
        }
    } else {
        "[]".to_string()
    };

    sqlx::query("UPDATE snippets SET title = ?, content = ?, language = ?, tags = ?, description = ?, folder = ?, version_history = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(title)
        .bind(content)
        .bind(language)
        .bind(tags)
        .bind(description)
        .bind(folder)
        .bind(new_history)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn toggle_snippet_favorite(pool: &Pool<Sqlite>, id: i64) -> Result<bool, sqlx::Error> {
    let row: (bool,) = sqlx::query_as("SELECT COALESCE(favorite, 0) FROM snippets WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;
    let new_val = !row.0;
    sqlx::query("UPDATE snippets SET favorite = ? WHERE id = ?")
        .bind(new_val)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(new_val)
}

pub async fn duplicate_snippet(pool: &Pool<Sqlite>, id: i64) -> Result<i64, sqlx::Error> {
    let snippet: Snippet = sqlx::query_as("SELECT id, title, content, language, tags, COALESCE(favorite, 0) as favorite, COALESCE(folder, '') as folder, COALESCE(description, '') as description, COALESCE(version_history, '[]') as version_history, created_at, updated_at FROM snippets WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;
    
    let new_title = format!("{} (Copy)", snippet.title);
    add_snippet(pool, new_title, snippet.content, snippet.language, snippet.tags, snippet.description, snippet.folder).await
}

pub async fn delete_snippet(pool: &Pool<Sqlite>, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM snippets WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

