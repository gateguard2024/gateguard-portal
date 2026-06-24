-- Migration 138: structured "interested in" + carry-forward parity for leads → opportunities.
-- One consistent bucket: the same fields exist on both leads and opportunities so a
-- conversion copies cleanly and the glass windows can save them.
ALTER TABLE public.leads          ADD COLUMN IF NOT EXISTS interests     text[];
ALTER TABLE public.opportunities  ADD COLUMN IF NOT EXISTS interests     text[];
ALTER TABLE public.opportunities  ADD COLUMN IF NOT EXISTS property_type text;
