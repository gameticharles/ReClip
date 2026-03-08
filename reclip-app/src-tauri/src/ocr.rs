#[cfg(target_os = "windows")]
use std::io::Cursor;
#[cfg(target_os = "windows")]
use windows::Graphics::Imaging::BitmapDecoder;
#[cfg(target_os = "windows")]
use windows::Media::Ocr::OcrEngine;
#[cfg(target_os = "windows")]
use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};

#[cfg(not(target_os = "windows"))]
use rusty_tesseract::{Args, Image};

#[cfg(target_os = "windows")]
pub async fn extract_text_from_image(image_path: &str) -> Result<String, String> {
    let img = image::open(image_path).map_err(|e| format!("Failed to open image: {}", e))?;
    let stream = InMemoryRandomAccessStream::new().map_err(|e| e.to_string())?;
    let writer = DataWriter::CreateDataWriter(&stream).map_err(|e| e.to_string())?;
    
    let mut buffer = Vec::new();
    img.write_to(&mut Cursor::new(&mut buffer), image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode image: {}", e))?;

    writer.WriteBytes(&buffer).map_err(|e| e.to_string())?;
    writer.StoreAsync().map_err(|e| e.to_string())?.await.map_err(|e| e.to_string())?;
    writer.DetachStream().map_err(|e| e.to_string())?;
    
    stream.Seek(0).map_err(|e| e.to_string())?;

    let decoder = BitmapDecoder::CreateAsync(&stream).map_err(|e| e.to_string())?.await.map_err(|e| e.to_string())?;
    let bitmap = decoder.GetSoftwareBitmapAsync().map_err(|e| e.to_string())?.await.map_err(|e| e.to_string())?;

    let engine = match OcrEngine::TryCreateFromUserProfileLanguages() {
        Ok(e) => e,
        Err(_) => {
            let lang_tag = windows::core::HSTRING::from("en-US");
            let lang = windows::Globalization::Language::CreateLanguage(&lang_tag).map_err(|e| e.to_string())?;
            OcrEngine::TryCreateFromLanguage(&lang).map_err(|e| e.to_string())?
        }
    };

    let result = engine.RecognizeAsync(&bitmap).map_err(|e| e.to_string())?.await.map_err(|e| e.to_string())?;
    
    let lines = result.Lines().map_err(|e| e.to_string())?;
    let mut text = String::new();
    
    for line in lines {
        text.push_str(&line.Text().unwrap().to_string());
        text.push('\n');
    }

    Ok(text.trim().to_string())
}

#[cfg(not(target_os = "windows"))]
pub async fn extract_text_from_image(image_path: &str) -> Result<String, String> {
    let img = Image::from_path(image_path).map_err(|e| format!("Tesseract error (is it installed?): {}", e))?;
    let args = Args::default();
    
    // rusty-tesseract is mostly blocking in its current form, wrap in spawn_blocking if needed
    // but here we just call it.
    let text = rusty_tesseract::image_to_string(&img, &args)
        .map_err(|e| format!("OCR execution failed: {}", e))?;
        
    Ok(text.trim().to_string())
}
