use screenshots::Screen;
use tauri::{AppHandle, Manager, Emitter};
use base64::Engine;
use std::io::Cursor;
use crate::db::{DbState, insert_clip};

#[tauri::command]
pub async fn capture_full_screen(app: AppHandle) -> Result<String, String> {
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    
    if let Some(screen) = screens.first() {
        let image = screen.capture().map_err(|e| format!("Failed to capture screen: {}", e))?;
        
        // Encode to PNG
        let mut buff = Cursor::new(Vec::new());
        image.write_to(&mut buff, screenshots::image::ImageFormat::Png)
            .map_err(|e| format!("Failed to encode image: {}", e))?;
        let buffer = buff.into_inner();
        
        let base64_image = base64::engine::general_purpose::STANDARD.encode(&buffer);
        let data_uri = format!("data:image/png;base64,{}", base64_image);
        
        // Generate a hash for the clip
        let hash = blake3::hash(data_uri.as_bytes()).to_string();
        
        // Save to DB
        let state = app.state::<DbState>();
        let pool = &state.pool;
        
        insert_clip(pool, data_uri.clone(), "image".to_string(), hash, None, None).await
            .map_err(|e: sqlx::Error| format!("Failed to save clip: {}", e))?;
        
        // Emit event to refresh UI
        app.emit("clip-created", ()).map_err(|e: tauri::Error| e.to_string())?;
        
        Ok("Success".to_string())
    } else {
        Err("No screens found".to_string())
    }
}

#[tauri::command]
pub async fn capture_region(app: AppHandle, x: i32, y: i32, width: u32, height: u32) -> Result<String, String> {
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;
    
    if let Some(screen) = screens.first() {
        let image = screen.capture_area(x, y, width, height).map_err(|e| format!("Failed to capture area: {}", e))?;
        
        // Encode to PNG
        let mut buff = Cursor::new(Vec::new());
        image.write_to(&mut buff, screenshots::image::ImageFormat::Png)
            .map_err(|e| format!("Failed to encode image: {}", e))?;
        let buffer = buff.into_inner();
        
        let base64_image = base64::engine::general_purpose::STANDARD.encode(&buffer);
        let data_uri = format!("data:image/png;base64,{}", base64_image);
        
        let hash = blake3::hash(data_uri.as_bytes()).to_string();
        
        // Save to DB
        let state = app.state::<DbState>();
        let pool = &state.pool;
        
        insert_clip(pool, data_uri.clone(), "image".to_string(), hash, None, None).await
            .map_err(|e: sqlx::Error| format!("Failed to save clip: {}", e))?;
        
        app.emit("clip-created", ()).map_err(|e: tauri::Error| e.to_string())?;
        
        Ok("Success".to_string())
    } else {
        Err("No screens found".to_string())
    }
}
