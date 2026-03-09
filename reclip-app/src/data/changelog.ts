export interface ChangeLogEntry {
    version: string;
    date: string;
    sections: {
        title: string;
        items: string[];
    }[];
}

export const CHANGELOG_DATA: ChangeLogEntry[] = [
    {
        version: "1.2.0",
        date: "2026-03-09",
        sections: [
            {
                title: "✨ New Features",
                items: [
                    "**Screen Capture**: Added a new screen capture feature to capture screenshots of the screen.",
                    "**Image Editing**: Added a new image editing feature to edit screenshots."
                ]
            },
            {
                title: "🐛 Bug Fixes",
                items: [
                    "**Core**: Prevented multiple instances of the app from running simultaneously. Launching a second instance now focuses the existing main window.",
                    "**Modularization**: Modularized the application into smaller, more manageable components.",
                    "**UI**: Fixed an issue where the search widget border was not visible in light mode."
                ]
            }

        ]
    },
    {
        version: "1.1.2",
        date: "2026-03-08",
        sections: [
            {
                title: "Security",
                items: [
                    "**Content Security Policy (CSP)**: Updated CSP to allow local file access."
                ]
            }
        ]
    },
    {
        version: "1.1.1",
        date: "2026-03-08",
        sections: [
            {
                title: "Tray",
                items: [
                    "**Tray**: Fixed tray menu logic to ensure proper updates and sync with main application state."
                ]
            },
            {
                title: "Pasting",
                items: [
                    "**Pasting**: Fixed an issue where pasting HTML content into plain text fields would fail. Now automatically falls back to plain text when needed."
                ]
            }
        ]
    },
    {
        version: "1.1.0",
        date: "2026-03-08",
        sections: [
            {
                title: "✨ New Features",
                items: [
                    "**Global Search (Ctrl+K)**: Spotlight-style search to quickly find clips, snippets, and notes.",
                    "**Undo System**: 5-second window to undo accidental clip deletions.",
                    "**Source App Tracking**: Clips now show which application they were copied from.",
                    "**First-Run Onboarding**: Interactive tour to help new users discover ReClip features.",
                    "**PIN Lock**: Secure your clipboard history with a local PIN.",
                    "**Category Filters**: Dedicated chips to filter by All, Text, Images, HTML, Files, and Favorites.",
                    "**Improved OCR (Windows)**: Enhanced native OCR with progress indicators.",
                    "**Automation Workflows**: Foundation for trigger-action clipboard automations.",
                    "**IDE Plugin API**: RESTful API for integration with VS Code, IntelliJ, and more (localhost:14401).",
                    "**E2E Encrypted Cloud Sync**: Securely sync clipboard data via Google Drive with local AES-256-GCM encryption.",
                    "**Multi-Window Support**: Option to allow multiple instances of snippet or note windows."
                ]
            },
            {
                title: "🐛 Bug Fixes",
                items: [
                    "**Bug Fix (Undo Delete)**: Resolved issue where undone clips were restored to the top of the list. They now return to their **original index/position**.",
                    "**Listen to Self Toggle**: Users can now disable capturing clipboard events that originate from within the ReClip app itself to prevent cluttering the history.",
                    "**Single Instance Protection**: Added backend logic to prevent multiple app instances and focus the existing window on second launch.",
                    "**CSP Image Fix**: Resolved image rendering issues in Windows release builds by allowing `http://asset.localhost` in the Content Security Policy.",
                    "**Linting**: Resolved all TypeScript compiler warnings and unused variable errors across `App.tsx`, `MainView.tsx`, and state stores.",
                    "**Search Layout**: Optimized search and filter bar for better responsiveness on small windows.",
                    "**Security**: Added restrictive Content Security Policy (CSP) for improved app safety.",
                    "**Tray**: Fixed tray menu logic to ensure proper updates and sync with main application state.",
                    "**Pasting**: Fixed an issue where pasting HTML content into plain text fields would fail. Now automatically falls back to plain text when needed."
                ]
            }
        ]
    },
    {
        version: "1.0.5",
        date: "2026-03-08",
        sections: [
            {
                title: "🐛 Bug Fixes",
                items: [
                    "**Auto-Updater**: Fixed an issue where the auto-updater was not working correctly."
                ]
            }
        ]
    },
    {
        version: "1.0.4",
        date: "2026-03-07",
        sections: [
            {
                title: "✨ New Features",
                items: [
                    "**Copy as Text**: Easily extract raw, unformatted text from HTML/Web clips via the 'More Actions' menu.",
                    "**Branding**: The application background process is now natively recognized as \"ReClip\" by the OS instead of \"reclip-app\"."
                ]
            },
            {
                title: "🐛 Bug Fixes",
                items: [
                    "**Launch on System Startup**: Fixed an issue where having Autostart enabled would cause the app to crash silently in the background on system boot.",
                    "**System Tray Sync**: Fixed an issue where toggling \"Always on Top\" or \"Incognito Mode\" from the system tray menu would fall out of sync with the main application's Settings UI."
                ]
            }
        ]
    },
    {
        version: "1.0.2",
        date: "2026-03-07",
        sections: [
            {
                title: "✨ New Features",
                items: [
                    "**Auto-Updater Migration**: Replaced custom updater with the official `@tauri-apps/plugin-updater` for enhanced stability, security, and native progress indicators.",
                    "**App Icons**: Updated application branding with new high-resolution icons across all platforms."
                ]
            }
        ]
    },
    {
        version: "1.0.0",
        date: "2026-02-10",
        sections: [
            {
                title: "✨ New Features",
                items: [
                    "**Organizer Dashboard**: A dedicated space for managing your Notes, Reminders, and Alarms with a grid layout and quick add functionality.",
                    "**Rich Text Notes**: Full WYSIWYG editor with Markdown support, titles, pinning, and color coding.",
                    "**Alarms & Reminders**: Set alarms with system notifications, sound alerts, and smart scheduling.",
                    "**Tagging System**: Add comma-separated tags to notes and filter content by tags."
                ]
            },
            {
                title: "🎨 UI/UX Improvements",
                items: [
                    "**Drag & Drop Reordering**: Switch to 'Manual' sort mode to drag and drop items into your preferred order.",
                    "**Responsive Design**: The Organizer adapts to different window sizes.",
                    "**Global Navigation**: Added 'Organizer' icon to the Title Bar for quick access.",
                    "**Settings UI Polish**: Replaced sidebar emojis with consistent outlined icons and added hover effects."
                ]
            },
            {
                title: "🐛 Bug Fixes",
                items: [
                    "**HTML Paste**: Fixed an issue where pasting HTML content into plain text fields would fail. Now automatically falls back to plain text when needed."
                ]
            }
        ]
    },
    {
        version: "0.9.5",
        date: "2026-02-09",
        sections: [
            {
                title: "✨ New Features",
                items: [
                    "**Unified Title Bar**: A new, persistent Title Bar with dedicated navigation buttons (Home, Snippets, Colors, Settings).",
                    "**Active State Indicators**: Navigation icons now highlight to visually indicate the current active view.",
                    "**Home Button**: Added a dedicated Home button and clickable App Logo to quickly return to the main clipboard view."
                ]
            },
            {
                title: "🎨 UI/UX Improvements",
                items: [
                    "**Main Clipboard View**: Moved the scrollbar to the extreme right edge and added bottom padding to prevent cutoff.",
                    "**Simplified Navigation**: Removed redundant internal title bars and Back/Close buttons from Settings, Color Tool, and Snippets pages."
                ]
            },
            {
                title: "🐛 Bug Fixes",
                items: [
                    "Refined Timeline layout with a two-row header to organize presets and controls.",
                    "Improved error handling for \"Check for Updates\" (network errors, offline)."
                ]
            }
        ]
    },
    {
        version: "0.9.0",
        date: "2026-01-21",
        sections: [
            {
                title: "✨ New Features",
                items: [
                    "**Google Drive Synchronization**: Securely sync your clips to a dedicated \"ReClip\" folder on Google Drive with bidirectional sync."
                ]
            },
            {
                title: "🎨 UI/UX Improvements",
                items: [
                    "**Settings Page**: New dedicated section for Backup & Cloud Sync with real-time status feedback."
                ]
            },
            {
                title: "🐛 Bug Fixes",
                items: [
                    "Fixed duplicate/conflicting code in Settings that caused build failures.",
                    "Fixed database query macros for stable compilation."
                ]
            }
        ]
    },
    {
        version: "0.8.0",
        date: "2026-01-20",
        sections: [
            {
                title: "✨ New Features",
                items: [
                    "**Color Tool Overhaul**: Complete redesign with Analyze, Mixer (LAB/OKLCH), Harmonies, Gradients, and Accessibility (APCA/Blindness) tabs."
                ]
            },
            {
                title: "🎨 UI/UX Improvements",
                items: [
                    "**Theming**: Fixed Light Mode transparency issues and dynamic accent color usage.",
                    "**Visual Polish**: Standardized sliders and added consistent hover effects."
                ]
            }
        ]
    },
    {
        version: "0.7.0",
        date: "2026-01-19",
        sections: [
            {
                title: "✨ New Features",
                items: [
                    "**Update Download Progress**: Real-time progress bar when downloading app updates.",
                    "**Calendar Navigation**: New calendar picker in Timeline.",
                    "**Timeline Quick Presets**: New buttons for 7d, 30d, MTD.",
                    "**Advanced Color Tool**: WCAG Contrast Checker, Tailwind match, Gradients/Harmonies."
                ]
            },
            {
                title: "🐛 Bug Fixes",
                items: [
                    "**Stats & Timeline**: Now display total clips from database.",
                    "**App Metadata**: Fixed installer properties for Windows."
                ]
            }
        ]
    }
];
