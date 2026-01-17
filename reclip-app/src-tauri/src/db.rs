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
    pub created_at: String, // Simplified for now, can be DateTime
    pub pinned: bool,
    pub favorite: bool,
    pub tags: Option<String>,
    pub sender_app: Option<String>,
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

    Ok(pool)
}

pub async fn insert_clip(pool: &Pool<Sqlite>, content: String, type_: String, hash: String, tags: Option<String>) -> Result<i64, sqlx::Error> {
    // Upsert logic: if hash exists, update created_at to now, return id.
    // If not, insert new.
    let id = sqlx::query("INSERT INTO clips (content, type, hash, tags) VALUES (?, ?, ?, ?) 
        ON CONFLICT(hash) DO UPDATE SET created_at = CURRENT_TIMESTAMP
        RETURNING id")
        .bind(content)
        .bind(type_)
        .bind(hash)
        .bind(tags)
        .fetch_one(pool)
        .await?
        .get::<i64, _>(0);

    Ok(id)
}

pub async fn get_clips(pool: &Pool<Sqlite>, limit: i64, offset: i64, search: Option<String>) -> Result<Vec<Clip>, sqlx::Error> {
    let query_str = if let Some(term) = search {
        format!(
            "SELECT id, content, type, hash, created_at, pinned, favorite, tags, sender_app FROM clips 
             WHERE content LIKE '%{}%' OR tags LIKE '%{}%' 
             ORDER BY favorite DESC, pinned DESC, created_at DESC LIMIT ? OFFSET ?", 
            term, term
        )
    } else {
        "SELECT id, content, type, hash, created_at, pinned, favorite, tags, sender_app FROM clips ORDER BY favorite DESC, pinned DESC, created_at DESC LIMIT ? OFFSET ?".to_string()
    };

    let clips = sqlx::query_as::<_, Clip>(&query_str)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;
    Ok(clips)
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

pub async fn update_clip_content(pool: &Pool<Sqlite>, id: i64, content: String) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE clips SET content = ? WHERE id = ?")
        .bind(content)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
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
