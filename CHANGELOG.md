# CHANGELOG

All notable changes to this project will be documented in this file.

## [0.6.0] - 2026-01-19

### ✨ New Features
- **Rich Clip Card Rendering**:
  - **HTML Preview**: Safely renders sanitized HTML content with links, lists, and formatting.
  - **Markdown Preview**: Full GFM support (tables, checkboxes, code blocks, links).
  - **JSON Pretty Print**: Colorized, collapsible JSON with key/value highlighting.
  - **Diff View**: Git-style diff with green/red additions/deletions highlighting.
  - **LaTeX Math**: Renders mathematical expressions using KaTeX ($...$ and $$...$$).
  - **Table Detection**: Auto-formats tab-separated or CSV data as tables.
  - **Contact Detection**: Clickable mailto: and tel: links for emails/phones.

  - **Enhanced Code Preview**: 20+ languages, line numbers, copy button, language badge.
- **Clip Content Editing**: Full-screen editor to modify clip content (via context menu).
- **Raw/Formatted Toggle**: Switch between raw text and formatted preview per clip via context menu.

## [0.5.0] - 2026-01-19

### ✨ New Features
- **Maintenance**:
  - Split "Clear Entire Database" into separate **Clear All Clips** and **Clear All Snippets** buttons for granular control.

### 🎨 UI/UX Improvements
- **Snippet Library**:
  - Added hover effects to toolbar buttons (Import, Export, Paste, New) for better interactivity.
- **Settings > About**:
  - Fixed "Check Again" button to properly adapt to Light/Dark themes.
- **Settings > Automations**:
  - Fixed URL input field overflow issue with proper text truncation.
- **General**:
  - Added hover effects to danger zone buttons in Maintenance tab.

### 🐛 Bug Fixes
- **Maintenance**:
  - Fixed "Clear Entire Database" button not functioning (now split into working individual buttons).
- **QR Code Modal**:
  - Removed duplicate close button (kept only the bottom "Close" button).

## [0.4.0] - 2026-01-18

### ✨ New Features
- **Snippet Library Settings**:
  - Added dedicated Settings tab for snippet configuration.
  - **Editor Preferences**: Adjustable Font Size, Tab Size, Word Wrap, and Line Numbers.
  - **Theming**: Select separate Syntax Highlighting themes for Light (`Atom One Light`, `GitHub`, `VS`) and Dark (`Atom Dark`, `Dracula`, `VSC Dark+`) modes.
  - **Template Management**: Centralized management of snippet templates.
  - **Auto Update**: Built-in check for updates in Settings > About.

### 🎨 UI/UX Improvements
  - **Snippet Settings UI**:
    - Implemented cleaner grid layout for settings.
    - Added theme-aware dropdown controls for consistent appearance in Light/Dark modes.
  - **About Page Overhaul**:
    - Updated with official app icon, detailed description, and developer profile link.

### 🐛 Bug Fixes
- **Persistence**:
  - Fixed **Always on Top** not applying automatically on startup.
  - Fixed **Incognito Mode** and **Timeline View** states not persisting across restarts.
  - Fixed **Paste Queue Mode** state not persisting across restarts.
- **Sidebar**:
  - Fixed duplicate "Maintenance" tab appearing in settings.

## [0.3.0] - 2026-01-18

### ✨ New Features
- **Advanced Snippet Library**:
  - Added syntax highlighting with auto-switching Light (`Atom One Light`) and Dark (`Atom One Dark`) themes.
  - Added **Folders**, **Favorites**, and **Version History** tracking.
  - Added **Templates** for quick code generation.
  - Added **Import/Export** functionality for snippets (JSON).
- **On-Device OCR**:
  - Added ability to extract text from images in the clipboard history.
- **QR Code Generator**:
  - Integrated high-res QR code generation for both Clips and Snippets.
  - Added **Multi-page support** for long text content.
  - Added ability to save QR codes as PNG.

### 🎨 UI/UX Improvements
- **Theming**:
  - Greatly improved **Light Mode** readability with better borders and contrast.
  - Added **System Theme Detection** to automatically switch app theme.
  - Fixed Dark Mode issues with fav icons and dropdowns.
- **Visual Polish**:
  - Added hover effects and animations to Snippet cards.
  - Improved Titlebar dragging experience.
  - Consistent date formatting (Relative/Absolute) across Clips and Snippets.

### 🐛 Bug Fixes
- Fixed invisible borders on snippet cards in Light Mode.
- Fixed unreadable code syntax in Light Mode.
- Fixed titlebar dragging dead zones.
- Fixed favorite stat icons not adapting to theme changes.

## [0.2.0] - 2026-01-18
- Initial Snippet Library implementation.
- Basic clipboard history tracking.
- Search functionality.
- UI improvements.

## [0.1.1] - 2026-01-18
- Fixed release script.
- Initial project setup.







