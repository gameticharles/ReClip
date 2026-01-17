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
