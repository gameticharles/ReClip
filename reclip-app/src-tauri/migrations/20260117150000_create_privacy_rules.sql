CREATE TABLE IF NOT EXISTS privacy_rules (
    id INTEGER PRIMARY KEY,
    rule_type TEXT NOT NULL, -- 'APP_IGNORE' or 'REGEX_MASK'
    value TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1
);
