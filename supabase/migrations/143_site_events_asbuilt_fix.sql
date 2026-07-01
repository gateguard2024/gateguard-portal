-- Migration 143: fix site as-builts / photos / notes not saving.
--
-- Root cause: migration 077 (re)created site_events with a CHECK constraint that
-- only permits event_type IN ('install','offline','online','work_order','inspection',
-- 'alert','access','visitor','other'). Uploading an as-built / photo / note posts
-- event_type 'as_built' | 'photo' | 'site_photo' | 'note', which VIOLATES that check
-- so the INSERT is rejected — the file silently never saves. 077's schema also lacks
-- event_source / summary / metadata, which /api/sites/[id] selects.
--
-- Fix: add the missing columns, and drop the restrictive CHECK constraints so any
-- event_type is allowed (the application controls the vocabulary). ALTER only — no GRANT.

ALTER TABLE public.site_events ADD COLUMN IF NOT EXISTS event_source text DEFAULT 'manual';
ALTER TABLE public.site_events ADD COLUMN IF NOT EXISTS summary      text;
ALTER TABLE public.site_events ADD COLUMN IF NOT EXISTS metadata     jsonb;

-- Drop every CHECK constraint on site_events (the event_type + severity whitelists
-- from migration 077) so as_built / photo / note / site_photo can be inserted.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.site_events'::regclass AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.site_events DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
