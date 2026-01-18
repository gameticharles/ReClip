## [0.3.0] - 2026-01-18

- feat: Implement `MainView` component, introducing core clip management, paste queue, multi-selection, and keyboard navigation features. (fa3a592)
- feat: implement core application styling and settings page. (9c3ed65)
- feat: introduce advanced snippet library features, on-device OCR, and QR code generation, alongside UI/UX improvements and an updated project README. (aad5a7e)
- feat: Implement snippets page with comprehensive styling and theming. (3acf22f)
- feat: add core application styling with theming and a new SnippetsPage for snippet management. (a353ed4)
- feat: Add MainView component with paste queue, timeline view, advanced settings, QR modal, and a new Snippets page. (e5cee2d)
- feat: Implement SQLite database for persistent clip, template, regex rule, and privacy rule management. (00cac52)
- feat: Implement core clipboard management UI including paste queue, multi-selection, keyboard navigation, and backend integration for OCR and database. (de2495e)
- chore: Remove deleted file. (489db72)
# Changelog

All notable changes to this project will be documented in this file.

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

