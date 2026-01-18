# ReClip: The Next-Gen Snippet & Clipboard Manager

**Copy once. Organize instantly. Use everywhere.**

ReClip is a modern, cross-platform clipboard manager built for developers and power users. It goes beyond simple history tracking to become your external brain for code, colors, files, and links. Built with **Rust** and **Tauri**, it's blazingly fast, lightweight, and secure.

---

## 🚀 Key Features

### 📋 Smart Clipboard History
*   **Rich Content Support**: Automatically handles Text, HTML, Images, File Paths, and Colors.
*   **Content Intelligence**:
    *   **Colors**: Shows preview for hex codes (e.g., `#FF5733`).
    *   **Code**: Auto-detects programming languages.
    *   **Files**: Validates file paths and checks for existence.
*   **Smart Search**: Filter by type, content, or tags.
*   **Paste Queue**: Select multiple items and paste them sequentially without switching windows.

### 💻 Advanced Snippet Library
Turn your clipboard history into a permanent knowledge base.
*   **Syntax Highlighting**: Beautiful code rendering with auto-switching Light/Dark themes (`Atom One Dark` / `Atom One Light`).
*   **Organization**: Organize snippets with **Folders**, **Tags**, and **Favorites**.
*   **Version History**: Track changes and restore previous versions of your snippets.
*   **Productivity Tools**:
    *   **Templates**: Quick-start templates for common languages (React, SQL, Python, Rust).
    *   **Quick Actions**: Duplicate, Edit, Copy, and Export.
    *   **Keyboard Shortcuts**: `Ctrl+N` (New), `Ctrl+S` (Save), `Ctrl+F` (Search).

### 🔍 On-Device OCR (Optical Character Recognition)
*   **Extract Text**: Grab text from any image or screenshot in your clipboard instantly.
*   **Privacy-First**: Runs entirely locally on your device using native OS APIs. No data leaves your machine.

### 📱 QR Code Generator
*   **Instant Sharing**: Generate QR codes for any text or snippet to transfer to mobile.
*   **Multi-Page Support**: Automatically splits long content into multiple scannable QR codes.
*   **High Quality**: Large, high-contrast codes optimized for scanning.

### 🎨 Beautiful & Adaptive UI
*   **Theming**: Fully adaptive **Light** and **Dark** modes that respect your system settings.
*   **System Accent**: Optionally syncs with your OS accent color (Windows).
*   **Glassmorphism**: Modern, translucent aesthetics.

---

## 🛠️ Technical Stack

*   **Core**: Rust (Backend), Tauri (Framework)
*   **Frontend**: React, TypeScript, Vite
*   **Styling**: Vanilla CSS (Performance focused)
*   **Database**: SQLite (Local storage)

---

## ⌨️ Shortcuts

| Action | Shortcut |
|--------|----------|
| Open ReClip | `Ctrl+Space` (Default) |
| New Snippet | `Ctrl+N` |
| Save Snippet | `Ctrl+S` |
| Search | `Ctrl+F` |
| Close Modal | `Esc` |

---

## 🗺️ Roadmap

*   **☁️ Secure Sync**: End-to-End Encrypted sync across devices.
*   **🔌 Plugins**: Integrations for VS Code and JetBrains.
*   **🧠 Local AI**: Auto-tagging and summarization using local LLMs.

---

<p align="center">
  <sub>Built with ❤️ by the ReClip Team</sub>
</p>
