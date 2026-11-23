-- Migration 238: lead status "Stuck" (blocked, still being worked).
-- ADD-ON ONLY: two nullable columns on the existing leads table + a small index.
-- No new tables, nothing dropped, no data changed. Safe to re-run.
--   Status shown in Nexus Leads:  Lost  = lost_at set (existing)
--                                 Stuck = stuck_at set (this migration)
--                                 Open / Contacting = from stage (existing)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS stuck_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS stuck_reason text;
CREATE INDEX IF NOT EXISTS leads_stuck_at_idx ON public.leads (stuck_at) WHERE stuck_at IS NOT NULL;
