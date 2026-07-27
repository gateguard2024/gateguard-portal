-- Migration 164: persist a category on local Nexus calendar events so a
-- user-created "Sales"/"Personal"/etc event doesn't reload as "Jobs".
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS category TEXT;
