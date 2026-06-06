-- Migration: Add language detection and new file formats support
-- Date: 2024-01-XX
-- Description: 
--   1. Add language column for automatic language detection
--   2. Extend file_type support to include PPTX and image formats

-- Add language column to study_materials table
ALTER TABLE study_materials 
ADD COLUMN IF NOT EXISTS language VARCHAR(10);

-- Add comment for documentation
COMMENT ON COLUMN study_materials.language IS 'ISO 639-1 language code detected from material content (e.g., en, sk, uk, de)';

-- Update file_type constraint to include new formats
ALTER TABLE study_materials 
DROP CONSTRAINT IF EXISTS study_materials_file_type_check;

ALTER TABLE study_materials 
ADD CONSTRAINT study_materials_file_type_check 
CHECK (file_type IN ('pdf', 'txt', 'md', 'pptx', 'png', 'jpg', 'jpeg'));

-- Index for language filtering (optional, for future language-based queries)
CREATE INDEX IF NOT EXISTS idx_study_materials_language ON study_materials(language);

