CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut_show_window', 'Ctrl+Shift+X');
INSERT OR IGNORE INTO settings (key, value) VALUES ('shortcut_incognito', '');
