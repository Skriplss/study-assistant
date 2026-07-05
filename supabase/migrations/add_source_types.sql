-- Extend study_materials to support non-file sources (YouTube transcripts, web URLs)
-- and bring the file_type check in line with the file types the app already accepts.

-- Widen file_type and refresh the allowed set (old check only listed pdf/txt/md).
ALTER TABLE study_materials
  ALTER COLUMN file_type TYPE VARCHAR(20);

ALTER TABLE study_materials
  DROP CONSTRAINT IF EXISTS study_materials_file_type_check;

ALTER TABLE study_materials
  ADD CONSTRAINT study_materials_file_type_check
  CHECK (file_type IN ('pdf', 'txt', 'md', 'pptx', 'png', 'jpg', 'jpeg', 'youtube', 'url'));

-- Source URL for link-based materials (youtube/url). NULL for uploaded files.
ALTER TABLE study_materials
  ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Link materials have no stored file, so file_path is no longer mandatory.
ALTER TABLE study_materials
  ALTER COLUMN file_path DROP NOT NULL;
