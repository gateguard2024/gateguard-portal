-- Migration 123: richer technician profiles
-- ALTER TABLE only — existing table, no GRANT needed.
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS level  TEXT;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';
