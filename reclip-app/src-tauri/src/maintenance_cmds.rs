use tauri::{State, Manager};
use crate::db::{self, DbState};
use crate::tray;

#[tauri::command]
pub async fn run_maintenance(state: State<'_, DbState>, days: i64, max_clips: i64) -> Result<(), String> {
    db::prune_clips(&state.pool, days, max_clips).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_clips(app: tauri::AppHandle, export_path: String) -> Result<String, String> {
    use std::fs::File;
    use std::io::{Write, Read};
    use zip::ZipWriter;
    use zip::write::FileOptions;
    use walkdir::WalkDir;
    
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_dir.join("clips.db");
    let images_dir = app_dir.join("images");
    
    let file = File::create(&export_path).map_err(|e| format!("Failed to create export file: {}", e))?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    
    if db_path.exists() {
        let mut db_file = File::open(&db_path).map_err(|e| e.to_string())?;
        let mut db_contents = Vec::new();
        db_file.read_to_end(&mut db_contents).map_err(|e| e.to_string())?;
        zip.start_file("clips.db", options).map_err(|e| e.to_string())?;
        zip.write_all(&db_contents).map_err(|e| e.to_string())?;
    }
    
    if images_dir.exists() {
        for entry in WalkDir::new(&images_dir).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                let relative_path = path.strip_prefix(&app_dir).unwrap();
                let mut file = File::open(path).map_err(|e| e.to_string())?;
                let mut contents = Vec::new();
                file.read_to_end(&mut contents).map_err(|e| e.to_string())?;
                zip.start_file(relative_path.to_string_lossy(), options).map_err(|e| e.to_string())?;
                zip.write_all(&contents).map_err(|e| e.to_string())?;
            }
        }
    }
    
    zip.finish().map_err(|e| e.to_string())?;
    Ok(format!("Exported to {}", export_path))
}

#[tauri::command]
pub async fn import_clips(app: tauri::AppHandle, import_path: String) -> Result<String, String> {
    use std::fs::File;
    use std::io::{Read, Write};
    use zip::ZipArchive;
    
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let file = File::open(&import_path).map_err(|e| format!("Failed to open import file: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid backup file: {}", e))?;
    let mut imported_count = 0;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = app_dir.join(file.name());
        if file.name().ends_with('/') {
            std::fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = outpath.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
            let mut contents = Vec::new();
            file.read_to_end(&mut contents).map_err(|e| e.to_string())?;
            outfile.write_all(&contents).map_err(|e| e.to_string())?;
            imported_count += 1;
        }
    }
    Ok(format!("Imported {} files", imported_count))
}

#[tauri::command]
pub fn update_tray_item_state(state: tauri::State<'_, crate::tray::TrayState<tauri::Wry>>, id: String, checked: bool) -> Result<(), String> {
    tray::update_item_state(state, id, checked)
}

#[tauri::command]
pub async fn refresh_tray_clips(app: tauri::AppHandle, state: State<'_, DbState>) -> Result<(), String> {
    tray::update_tray_history(&app, state).await
}
