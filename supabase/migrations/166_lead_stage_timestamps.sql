-- Migration 166: lead stage timestamps for time-in-stage reporting.
-- Identified = created_at; Visited = visited_at (165); these add the rest.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS contacted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS sent_info_at  timestamptz;
