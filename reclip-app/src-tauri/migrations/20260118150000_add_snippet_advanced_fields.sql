-- Add new fields for advanced snippet features
ALTER TABLE snippets ADD COLUMN favorite INTEGER DEFAULT 0;
ALTER TABLE snippets ADD COLUMN folder TEXT DEFAULT '';
ALTER TABLE snippets ADD COLUMN description TEXT DEFAULT '';
ALTER TABLE snippets ADD COLUMN version_history TEXT DEFAULT '[]';
