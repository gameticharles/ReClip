# ReClip Master Implementation Plan

This document serves as the single source of truth for the development of ReClip.

## 1. Project Overview
*   **Name:** ReClip
*   **Goal:** A high-performance, cross-platform clipboard manager.
*   **Key Value:** Speed (<1% CPU), Privacy (End-to-End Encryption), and Organization (Smart Tags).

## 2. Technology Stack
*   **Core:** Rust 🦀
    *   *Role:* System Hooks (Clipboard monitoring), Database handling, Encryption, Business Logic.
    *   *Key Crates:* `tauri`, `sqlx` (SQLite), `arboard` (Clipboard), `rdev` (Hotkeys).
*   **App Framework:** Tauri v2 🌟
    *   *Role:* Windows/macOS native webview wrapper.
*   **Frontend:** React + TypeScript + TailwindCSS
    *   *Role:* UI/UX.
*   **Database:** SQLite
    *   *Role:* Local storage of clip history.

## 3. Architecture & Data Model

### Database Schema (Unified)
Instead of separate tables for "Text" and "Files", we will use a **Unified Schema** to support the "Unified Feed".

```sql
CREATE TABLE clips (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    content     TEXT NOT NULL,          -- The actual text content or file path
    type        TEXT NOT NULL,          -- 'text', 'image', 'file_list', 'html'
    hash        TEXT UNIQUE NOT NULL,   -- BLAKE3 hash for deduplication
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    pinned      BOOLEAN DEFAULT 0,
    tags        TEXT,                   -- JSON array of tags: ["#work", "#urgent"]
    sender_app  TEXT                    -- App name where clip originated (e.g. "Google Chrome")
);
```

### Core Rust Commands (Tauri API)
*   `get_clips(limit: u32, offset: u32, filter: String) -> Vec<Clip>`
*   `copy_clip_to_system(id: u32)`
*   `delete_clip(id: u32)`
*   `toggle_pin(id: u32)`

## 4. UI/UX Design (Unified Feed)
*   **Main View:** A single scrolling list of cards.
*   **Filtering:** Top bar with "Chips": `[All]`, `[Images]`, `[Files]`, `[Pinned]`.
*   **Card Layout:**
    *   *Text:* Shows first 3 lines. Click to expand.
    *   *Image:* Thumbnail preview.
    *   *File:* Icon + Filename + Path. If file is missing (checked via Rust `std::path::Path::exists`), show "⚠️ Missing".

## 5. Feature Implementation Priority
1.  **Project Init:** Initialize Tauri + React project.
2.  **Clipboard Watcher:** Implement Rust thread to listen for clipboard changes (`arboard`).
3.  **Database Layer:** Set up SQLite and `sqlx`.
4.  **UI Skeleton:** Build the React feed.
5.  **Hotkeys:** Implement global hotkeys (`Ctrl+Shift+X` to toggle window).

## 6. Migration from Legacy
*   **Ported Features:**
    *   Hotkeys: `Ctrl+Shift+X` (Activate), `Paste Stack` support.
    *   File Tracking: Visual indicator for deleted files.
*   **Improved Features:**
    *   **Unified Feed:** Merged specific tabs into one filterable view.
    *   **Unlimited History:** Replaced "350 clip limit" with huge SQLite capacity.
