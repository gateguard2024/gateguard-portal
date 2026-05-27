-- Migration 093: per-tech access codes for /tech field tool login
-- Run on beta first, then prod.

ALTER TABLE technicians ADD COLUMN IF NOT EXISTS tech_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS technicians_tech_code_unique ON technicians(tech_code) WHERE tech_code IS NOT NULL;
