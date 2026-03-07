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
        version: "1.0.3",
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
