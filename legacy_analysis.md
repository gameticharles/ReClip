# Legacy ReClip (C#) Feature Extraction

I have analyzed the provided screenshots of the 2021 C# version. Here is a breakdown of the features we should port, modernize, or discard.

## 1. Core Functionality (Keep & Improve)
*   **Clipboard Monitoring:**
    *   *Legacy:* Separated "Files/Folders" vs "Text/Image".
    *   *New Plan:* **Unified Feed**. Treat files, text, and images as "Clips" in a single list, but use **Smart Tags** (`#file`, `#image`) to filter them instantly. This reduces clicking.
*   **Hotkeys (Critical):**
    *   *Legacy:* `Ctrl+Shift+X` (Activate), `Ctrl+Shift+A` (Paste First), `Ctrl+Shift+Q/W/E...` (Paste Specific 1-10).
    *   *New Plan:* Port these exact bindings. Rust (`rdev` or similar crates) handles global hotkeys perfectly.
*   **File Tracking:**
    *   *Legacy:* Showed "4 file(s) missing" if source files were deleted.
    *   *New Plan:* Keep this. It's a great feature. We can show a "broken link" icon for files that no longer exist.

## 2. Settings & Customization
*   **Window Behavior:** "Always on Top", "Start Minimized", "Opacity Slider".
    *   *New Plan:* Keep. Tauri allows easy window transparency and "always on top" flags.
*   **Database Management:**
    *   *Legacy:* Manual limits (350 clips, 200MB).
    *   *New Plan:* **Auto-Maintenance**. SQLite can handle 100,000+ items easily. We don't need a "350 clip" limit. Instead, we'll implement a "Time-To-Live" (e.g., Delete after 30 days) and a "Soft Limit" (e.g., keep last 10,000) that happens in the background. The user shouldn't have to worry about megabytes.

## 3. UI/UX Modernization
*   **Visual Style:**
    *   *Legacy:* Standard Windows Forms/WPF look (purple borders, standard checkboxes).
    *   *New Plan:* Modern, Frameless UI.
        *   **Glassmorphism/Blur** background (using Tauri's window vibe).
        *   **Dark Mode** default.
        *   **Rich Previews:** instead of just a generic HTML icon, render the actual HTML/Markdown snippet or a thumbnail of the website.
        *   **Keyboard Navigation:** `j/k` navigation (Vim style) in addition to arrow keys.

## 4. Migration Checklist
1.  [ ] **Unified Data Model:** Design the Rust Struct to hold Text, ImagePath, or FileList.
2.  [ ] **Hotkey Manager:** Re-implement the "Paste Position X" logic.
3.  [ ] **Assets:** The legacy app had distinct icons. We should generate a new, modern icon set.

## Question for You
The legacy app had separate tabs for **"Files/Folders"** and **"Text/Image"**.
**Do you want to keep these separate tabs, or merging them into one searchable list with filters (e.g., clickable chips `[Files]`, `[Images]`)?**
*Merging is generally considered more "modern" and faster.*
