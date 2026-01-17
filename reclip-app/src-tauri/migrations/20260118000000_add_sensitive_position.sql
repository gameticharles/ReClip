-- Add sensitive flag for password/API key detection and position for drag-drop reorder
ALTER TABLE clips ADD COLUMN sensitive INTEGER DEFAULT 0;
ALTER TABLE clips ADD COLUMN position INTEGER DEFAULT NULL;
