-- Migration 218: Executive Lexi fills the EOS Scorecard herself (Nov 4 2026).
-- eos_scorecard.auto_key = which Nexus number Lexi writes each week
-- (new_leads, deals_won, won_value, pipeline_added, proposals_sent, jobs_done,
--  jobs_old, gates_down, cash, ar_90). NULL = a number someone enters by hand.
-- ALTER only. Run on beta first, then prod.
ALTER TABLE public.eos_scorecard ADD COLUMN IF NOT EXISTS auto_key text;
-- Lexi records one value per measurable per week (already unique from migration 010; kept here in case it's missing).
CREATE UNIQUE INDEX IF NOT EXISTS eos_scorecard_entries_unique ON public.eos_scorecard_entries (scorecard_id, week_of);
