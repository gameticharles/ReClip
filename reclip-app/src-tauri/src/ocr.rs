use image::GenericImageView;
use std::io::Cursor;
use windows::Graphics::Imaging::BitmapDecoder;
use windows::Media::Ocr::OcrEngine;
use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};

// Note: This function must be called from a thread where Windows RT is initialized (which Tauri usually handles on main thread, but safe to do in spawned blocking task?)
// Windows RT objects are mostly Agile so they are thread-safe.

pub async fn extract_text_from_image(image_path: &str) -> Result<String, String> {
    // 1. Load image into memory using helper
    let img = image::open(image_path).map_err(|e| format!("Failed to open image: {}", e))?;
    let (width, height) = img.dimensions();
    
    // Convert to RGBA8
    let rgba = img.to_rgba8();
    let raw_pixels = rgba.as_raw();

    // 2. Create SoftwareBitmap
    // We need to feed data into a RandomAccessStream to use BitmapDecoder to create SoftwareBitmap? 
    // Or create SoftwareBitmap directly. 
    // Native SoftwareBitmap creation from buffer is complex in Rust bindings without IBuffer helpers.
    // Easier path: Write to in-memory stream -> BitmapDecoder -> SoftwareBitmap.

    let stream = InMemoryRandomAccessStream::new().map_err(|e| e.to_string())?;
    let writer = DataWriter::CreateDataWriter(&stream).map_err(|e| e.to_string())?;
    
    // We need to encode as PNG/JPEG to stream first? 
    // 'image' crate can write to buffer.
    
    let mut buffer = Vec::new();
    img.write_to(&mut Cursor::new(&mut buffer), image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode image: {}", e))?;

    writer.WriteBytes(&buffer).map_err(|e| e.to_string())?;
    writer.StoreAsync().map_err(|e| e.to_string())?.await.map_err(|e| e.to_string())?;
    writer.DetachStream().map_err(|e| e.to_string())?;
    
    stream.Seek(0).map_err(|e| e.to_string())?;

    let decoder = BitmapDecoder::CreateAsync(&stream).map_err(|e| e.to_string())?.await.map_err(|e| e.to_string())?;
    let bitmap = decoder.GetSoftwareBitmapAsync().map_err(|e| e.to_string())?.await.map_err(|e| e.to_string())?;

    // 3. Initialize OCR Engine
    // Use default language or "en-US"
    let engine = match OcrEngine::TryCreateFromUserProfileLanguages() {
        Ok(e) => e,
        Err(_) => {
            let lang_tag = windows::core::HSTRING::from("en-US");
            let lang = windows::Globalization::Language::CreateLanguage(&lang_tag).map_err(|e| e.to_string())?;
            OcrEngine::TryCreateFromLanguage(&lang).map_err(|e| e.to_string())?
        }
    };

    // 4. Recognize
    let result = engine.RecognizeAsync(&bitmap).map_err(|e| e.to_string())?.await.map_err(|e| e.to_string())?;
    
    let lines = result.Lines().map_err(|e| e.to_string())?;
    let mut text = String::new();
    
    for line in lines {
        text.push_str(&line.Text().unwrap().to_string());
        text.push('\n');
    }

    Ok(text.trim().to_string())
}
