-- Migration 165: lead sizing (Lead Analysis) — manually entered on the lead,
-- carried forward to the opportunity on convert.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_type    text,
  ADD COLUMN IF NOT EXISTS entry_points integer,
  ADD COLUMN IF NOT EXISTS cameras      integer,
  ADD COLUMN IF NOT EXISTS mrr          numeric,
  ADD COLUMN IF NOT EXISTS pcr          numeric,
  ADD COLUMN IF NOT EXISTS visited_at   timestamptz;
