-- Migration 130: tags on camera↔door links.
-- Manual tags now; Eagle Eye's own camera tags can sync into the same column
-- later. ALTER only — no GRANT needed.

ALTER TABLE public.door_cameras ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
