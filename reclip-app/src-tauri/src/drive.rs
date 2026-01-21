use std::sync::Mutex;
use tauri::{AppHandle, Manager, State, Emitter};
use serde::{Deserialize, Serialize};
use oauth2::{
    basic::BasicClient, AuthUrl, ClientId, ClientSecret, RedirectUrl,
    TokenResponse, TokenUrl, RefreshToken, Scope, PkceCodeChallenge, CsrfToken,
    reqwest::async_http_client,
};
use std::collections::HashMap;
use crate::db::{DbState, set_setting, get_setting};
use reqwest::Client;
use std::path::PathBuf;

// Constants
const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const REDIRECT_URI: &str = "http://localhost:14200"; 
const FOLDER_MIME_TYPE: &str = "application/vnd.google-apps.folder";

#[derive(Clone, Serialize, Deserialize)]
pub struct DriveInfo {
    pub connected: bool,
    pub user_name: Option<String>,
    pub user_email: Option<String>,
    pub last_sync: Option<String>,
}

pub struct DriveState {
    pub client: Mutex<Option<BasicClient>>,
    pub pkce_verifier: Mutex<Option<oauth2::PkceCodeVerifier>>,
    pub access_token: Mutex<Option<String>>,
}

impl DriveState {
    pub fn new() -> Self {
        Self {
            client: Mutex::new(None),
            pkce_verifier: Mutex::new(None),
            access_token: Mutex::new(None),
        }
    }
}

// Initialize the Oauth Client
fn create_client(client_id: String, client_secret: String) -> Result<BasicClient, String> {
    let client = BasicClient::new(
        ClientId::new(client_id),
        Some(ClientSecret::new(client_secret)),
        AuthUrl::new(AUTH_URL.to_string()).map_err(|e| e.to_string())?,
        Some(TokenUrl::new(TOKEN_URL.to_string()).map_err(|e| e.to_string())?)
    )
    .set_redirect_uri(RedirectUrl::new(REDIRECT_URI.to_string()).map_err(|e| e.to_string())?);
    Ok(client)
}

// Helper to get a valid access token (refreshing if needed)
async fn get_valid_token(
    state: &State<'_, DriveState>,
    db_state: &State<'_, DbState>
) -> Result<String, String> {
    // 1. Check memory
    {
        let at_lock = state.access_token.lock().map_err(|e| e.to_string())?;
        if let Some(token) = &*at_lock {
            // TODO: check expiry if we tracked it. For now assuming valid until 401 or restart.
            // But actually, we should probably try to refresh if we can, or just return it.
            return Ok(token.clone());
        }
    }

    // 2. Need to refresh or load.
    let refresh_token = get_setting(&db_state.pool, "drive_refresh_token").await;
    let client_id = get_setting(&db_state.pool, "drive_client_id").await;
    let client_secret = get_setting(&db_state.pool, "drive_client_secret").await;

    if let (Some(rt), Some(cid), Some(csec)) = (refresh_token, client_id, client_secret) {
        if rt.is_empty() { return Err("No refresh token".into()); }
        
        let client = create_client(cid, csec)?;
        
        let token_result = client
            .exchange_refresh_token(&RefreshToken::new(rt))
            .request_async(async_http_client)
            .await
            .map_err(|e| format!("Token refresh failed: {}", e))?;
            
        let new_access_token = token_result.access_token().secret().clone();
        
        // Update memory
        {
            let mut at_lock = state.access_token.lock().map_err(|e| e.to_string())?;
            *at_lock = Some(new_access_token.clone());
        }
        
        return Ok(new_access_token);
    }

    Err("Not authenticated".into())
}

#[tauri::command]
pub async fn start_google_auth(
    app: AppHandle,
    state: State<'_, DriveState>,
    db_state: State<'_, DbState>,
    client_id: String,
    client_secret: String
) -> Result<String, String> {
    // Save credentials for future refreshes
    set_setting(&db_state.pool, "drive_client_id", &client_id).await.map_err(|e| e.to_string())?;
    set_setting(&db_state.pool, "drive_client_secret", &client_secret).await.map_err(|e| e.to_string())?;

    let client = create_client(client_id.clone(), client_secret.clone())?;
    
    // PKCE
    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();
    
    // Save verifier and client for later
    {
        let mut v_lock = state.pkce_verifier.lock().map_err(|e| e.to_string())?;
        *v_lock = Some(pkce_verifier);
        
        let mut c_lock = state.client.lock().map_err(|e| e.to_string())?;
        *c_lock = Some(client.clone());
    }

    // Generate Auth URL
    let (auth_url, _csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new("https://www.googleapis.com/auth/drive.file".to_string()))
        .add_scope(Scope::new("https://www.googleapis.com/auth/userinfo.profile".to_string()))
        .add_scope(Scope::new("https://www.googleapis.com/auth/userinfo.email".to_string()))
        .set_pkce_challenge(pkce_challenge)
        .url();

    // Start a local server (same as before)
    let app_handle = app.clone();
    std::thread::spawn(move || {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        
        // Try multiple ports if 14200 is taken, but redirect URI is fixed in GCP so... we must use 14200.
        // Or user adds more URIs. For now stick to 14200.
        let listener = match TcpListener::bind("127.0.0.1:14200") {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Failed to bind to localhost:14200: {}", e);
                return;
            }
        };
        
        for stream in listener.incoming() {
            match stream {
                Ok(mut stream) => {
                    let mut buffer = [0; 1024];
                    if let Ok(_) = stream.read(&mut buffer) {
                        let request = String::from_utf8_lossy(&buffer);
                        // Parse "GET /?code=... HTTP/1.1"
                        if let Some(code_start) = request.find("code=") {
                             let rest = &request[code_start + 5..];
                             let code_end = rest.find('&').or_else(|| rest.find(' ')).unwrap_or(rest.len());
                             let code = &rest[..code_end];
                             
                             let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html><body><h1>ReClip Connected!</h1><p>You can close this window now.</p><script>window.close()</script></body></html>";
                             let _ = stream.write(response.as_bytes());
                             let _ = stream.flush();
                             
                             let _ = app_handle.emit("google-auth-code", code.to_string());
                             break; 
                        } else {
                             let response = "HTTP/1.1 400 Bad Request\r\n\r\n";
                             let _ = stream.write(response.as_bytes());
                        }
                    }
                }
                Err(e) => { println!("Connection failed: {}", e); }
            }
        }
    });

    let url_string = auth_url.to_string();
    let _ = open::that(&url_string); 
    Ok(url_string)
}

#[tauri::command]
pub async fn finish_google_auth(
    app: AppHandle,
    state: State<'_, DriveState>,
    db_state: State<'_, DbState>,
    code: String
) -> Result<DriveInfo, String> {
    let client;
    let pkce_verifier;
    {
        let c_lock = state.client.lock().map_err(|e| e.to_string())?;
        client = c_lock.clone().ok_or("Auth client not initialized")?;
        
        let mut v_lock = state.pkce_verifier.lock().map_err(|e| e.to_string())?;
        pkce_verifier = v_lock.take().ok_or("PKCE verifier missing")?;
    }
    
    // Exchange Code for Token
    let token_result = client
        .exchange_code(oauth2::AuthorizationCode::new(code))
        .set_pkce_verifier(pkce_verifier)
        .request_async(async_http_client)
        .await
        .map_err(|e| format!("Token exchange failed: {}", e))?;
        
    let access_token = token_result.access_token().secret();
    let refresh_token = token_result.refresh_token().map(|t| t.secret());
    
    // Store Refresh Token in DB
    if let Some(rt) = refresh_token {
        set_setting(&db_state.pool, "drive_refresh_token", rt).await.map_err(|e| e.to_string())?;
    }
    
    // Store Access Token in Memory
    {
        let mut at_lock = state.access_token.lock().map_err(|e| e.to_string())?;
        *at_lock = Some(access_token.clone());
    }
    
    // Fetch User Info
    let http_client = Client::new();
    let user_info: serde_json::Value = http_client
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(access_token)
        .send()
        .await.map_err(|e| e.to_string())?
        .json()
        .await.map_err(|e| e.to_string())?;
        
    let name = user_info["name"].as_str().map(|s| s.to_string());
    let email = user_info["email"].as_str().map(|s| s.to_string());
    
    if let Some(n) = &name { set_setting(&db_state.pool, "drive_user_name", n).await.map_err(|e| e.to_string())?; }
    if let Some(e) = &email { set_setting(&db_state.pool, "drive_user_email", e).await.map_err(|e| e.to_string())?; }
    
    set_setting(&db_state.pool, "drive_connected", "true").await.map_err(|e| e.to_string())?;

    Ok(DriveInfo {
        connected: true,
        user_name: name,
        user_email: email,
        last_sync: None
    })
}

#[tauri::command]
pub async fn get_drive_status(db_state: State<'_, DbState>) -> Result<DriveInfo, String> {
    let connected = get_setting(&db_state.pool, "drive_connected").await.unwrap_or_default() == "true";
    let user_name = get_setting(&db_state.pool, "drive_user_name").await;
    let user_email = get_setting(&db_state.pool, "drive_user_email").await;
    let last_sync = get_setting(&db_state.pool, "drive_last_sync").await;
    
    Ok(DriveInfo {
        connected,
        user_name,
        user_email,
        last_sync
    })
}

#[tauri::command]
pub async fn disconnect_google_drive(state: State<'_, DriveState>, db_state: State<'_, DbState>) -> Result<(), String> {
    set_setting(&db_state.pool, "drive_connected", "false").await.map_err(|e| e.to_string())?;
    set_setting(&db_state.pool, "drive_refresh_token", "").await.map_err(|e| e.to_string())?;
    set_setting(&db_state.pool, "drive_user_name", "").await.map_err(|e| e.to_string())?;
    set_setting(&db_state.pool, "drive_user_email", "").await.map_err(|e| e.to_string())?;
    set_setting(&db_state.pool, "drive_client_id", "").await.map_err(|e| e.to_string())?;
    set_setting(&db_state.pool, "drive_client_secret", "").await.map_err(|e| e.to_string())?;
    
    {
        let mut at_lock = state.access_token.lock().map_err(|e| e.to_string())?;
        *at_lock = None;
    }
    
    Ok(())
}

// Drive Operations

async fn ensure_reclip_folder(token: &str, db_state: &State<'_, DbState>) -> Result<String, String> {
    // Check if we already have the ID cached
    if let Some(id) = get_setting(&db_state.pool, "drive_folder_id").await {
        if !id.is_empty() { return Ok(id); }
    }

    let client = Client::new();
    // Search for folder
    let search_url = "https://www.googleapis.com/drive/v3/files";
    let q = "mimeType='application/vnd.google-apps.folder' and name='ReClip' and trashed=false";
    
    let resp: serde_json::Value = client.get(search_url)
        .bearer_auth(token)
        .query(&[("q", q)])
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
        
    if let Some(files) = resp["files"].as_array() {
        if let Some(first) = files.first() {
            let id = first["id"].as_str().ok_or("No ID found")?.to_string();
             set_setting(&db_state.pool, "drive_folder_id", &id).await.map_err(|e| e.to_string())?;
            return Ok(id);
        }
    }

    // Create folder logic would go here if not found...
    // For now returning error if not found or implementing creation
    
    // Create Folder
    let create_body = serde_json::json!({
        "name": "ReClip",
        "mimeType": FOLDER_MIME_TYPE
    });
    
    let create_resp: serde_json::Value = client.post("https://www.googleapis.com/drive/v3/files")
        .bearer_auth(token)
        .json(&create_body)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
        
    let id = create_resp["id"].as_str().ok_or("Failed to create folder")?.to_string();
    set_setting(&db_state.pool, "drive_folder_id", &id).await.map_err(|e| e.to_string())?;
    Ok(id)
}

async fn list_drive_files(token: &str, folder_id: &str) -> Result<HashMap<String, String>, String> {
    let client = Client::new();
    let query = format!("'{}' in parents and trashed=false", folder_id);
    let url = "https://www.googleapis.com/drive/v3/files";
    
    let resp: serde_json::Value = client.get(url)
        .bearer_auth(token)
        .query(&[("q", query.as_str()), ("fields", "files(id, name, modifiedTime)")])
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
        
    let mut file_map = HashMap::new();
    if let Some(files) = resp["files"].as_array() {
        for file in files {
            if let (Some(name), Some(id)) = (file["name"].as_str(), file["id"].as_str()) {
                file_map.insert(name.to_string(), id.to_string());
            }
        }
    }
    Ok(file_map)
}

async fn upload_file_content(token: &str, folder_id: &str, filename: &str, content: &str) -> Result<(), String> {
    let client = Client::new();
    
    // Simple metadata-only create check? No, we need multipart for metadata + content, 
    // or just upload content if we don't care about metadata details except name/parent.
    
    let metadata = serde_json::json!({
        "name": filename,
        "parents": [folder_id]
    });
    
    // Multipart upload is complex with reqwest serde json alone. 
    // We'll use the 'multipart' upload type with a proper body construction if possible,
    // or just create file with metadata then update media.
    // Easier: Create metadata to get ID, then PATCH content? No, can do distinct calls.
    
    // Let's use the 'upload' endpoint with multipart/related for single request
    // Or simple: 
    // 1. Create file metadata (if not exists)
    // 2. Upload media
    
    // For MVP, lets try strictly creating new files (we check existence in sync logic).
    // If it exists, we should probably update it (PATCH).
    
    // Construct valid multipart body manually or use reqwest::multipart
    use reqwest::multipart;
    
    let part_metadata = multipart::Part::text(metadata.to_string())
        .mime_str("application/json").map_err(|e| e.to_string())?;
        
    let part_content = multipart::Part::text(content.to_string())
        .mime_str("application/json").map_err(|e| e.to_string())?;
        
    let form = multipart::Form::new()
        .part("metadata", part_metadata)
        .part("media", part_content);
        
    let _ = client.post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
        .bearer_auth(token)
        .multipart(form)
        .send().await.map_err(|e| e.to_string())?;
        
    Ok(())
}

async fn get_file_content(token: &str, file_id: &str) -> Result<String, String> {
    let client = Client::new();
    let content = client.get(format!("https://www.googleapis.com/drive/v3/files/{}?alt=media", file_id))
        .bearer_auth(token)
        .send().await.map_err(|e| e.to_string())?
        .text().await.map_err(|e| e.to_string())?;
    Ok(content)
}

#[tauri::command]
pub async fn sync_clips(
    app: AppHandle,
    state: State<'_, DriveState>,
    db_state: State<'_, DbState>
) -> Result<String, String> {
    // 1. Authenticate
    let token = get_valid_token(&state, &db_state).await?;
    
    // 2. Folder
    let folder_id = ensure_reclip_folder(&token, &db_state).await?;
    
    // 3. List Drive Files
    let drive_files = list_drive_files(&token, &folder_id).await?;
    
    // 4. List Local Clips
    // We need a DB function to get all clips content. Ideally lightweight list first.
    // Let's assume we fetch all for now, or fetch recent 50.
    // For full backup, we need all.
    // Using `get_all_clips_as_json` (need to implement or query directly).
    // Let's query directly here for simplicity, or use `db` module if exposed.
    // Accessing pool directly:
    
    // Use offline query function instead of macro for missing env
    let clips = sqlx::query_as::<_, (i64, String, String)>("SELECT id, content, created_at FROM clips WHERE is_text = 1")
        .fetch_all(&db_state.pool).await.map_err(|e| e.to_string())?;
        
    let mut uploaded_count = 0;
    // let mut downloaded_count = 0;
    
    // 5. Upload missing
    let mut local_ids = std::collections::HashSet::new();
    for (id, content, created_at) in &clips {
        local_ids.insert(*id);
        
        let filename = format!("clip_{}.json", id);
        if !drive_files.contains_key(&filename) {
            // Upload
            let clip_data = serde_json::json!({
                "id": id,
                "content": content,
                "created_at": created_at
            });
            
            upload_file_content(&token, &folder_id, &filename, &clip_data.to_string()).await?;
            uploaded_count += 1;
        }
    }
    
    // 6. Download missing
    let mut downloaded_count = 0;
    for (filename, file_id) in drive_files {
        if filename.starts_with("clip_") && filename.ends_with(".json") {
            // Extract ID
            let id_part = &filename[5..filename.len()-5];
            if let Ok(id) = id_part.parse::<i64>() {
                if !local_ids.contains(&id) {
                    // Download
                    if let Ok(content_str) = get_file_content(&token, &file_id).await {
                        if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content_str) {
                             let content = data["content"].as_str().unwrap_or_default();
                             let created_at = data["created_at"].as_str().unwrap_or("");
                             
                             // Insert into DB
                             let _ = sqlx::query("INSERT OR IGNORE INTO clips (id, content, created_at, is_text) VALUES (?, ?, ?, 1)")
                             .bind(id)
                             .bind(content)
                             .bind(created_at)
                             .execute(&db_state.pool)
                             .await;
                             
                             downloaded_count += 1;
                        }
                    }
                }
            }
        }
    }
    
    // Update last sync time
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(); // Format for display
    set_setting(&db_state.pool, "drive_last_sync", &now).await.map_err(|e| e.to_string())?;
    
    Ok(format!("Synced: Uploaded {}, Downloaded {}", uploaded_count, downloaded_count))
}
