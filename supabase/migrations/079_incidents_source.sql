-- Migration 079: add source tracking to incidents
-- Allows the GGSOC alarm bridge to find and update incidents by external alarm ID

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS source_ext_id  text,   -- GGSOC alarm UUID
  ADD COLUMN IF NOT EXISTS source_system  text;   -- 'ggsoc' | 'brivo' | 'eagle_eye' etc.

CREATE INDEX IF NOT EXISTS incidents_source_ext_id_idx
  ON incidents (source_ext_id)
  WHERE source_ext_id IS NOT NULL;

-- Update RLS: service role can do everything (already covered by existing policy)
-- No new policies needed — service role key is used by the ingest endpoint
