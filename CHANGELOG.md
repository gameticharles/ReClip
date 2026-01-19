## [0.4.0] - 2026-01-18

Added new features (snippet and updater) and fixed bugs
## [0.4.0] - 2026-01-18

Added new features (snippet and updater) and fixed bugs
# CHANGELOG

All notable changes to this project will be documented in this file.

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
- **Settings**:
  - Separate "Clear Clipboard" and "Clear Snippets" options.
  - Fixed UI bugs in Automations and About tabs.

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






