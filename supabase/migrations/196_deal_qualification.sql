-- ============================================================
-- Migration 196 — Deal qualification fields (Part 1 · Dealer, Sales board)
-- Run on BETA first, verify, then prod. Safe to run more than once.
--
--   decision_date        board / owner meeting where the decision gets made
--   budget_status        confirmed | not_confirmed | unknown
--   pain_points          why they're looking (can be filled from ARIA)
--   competing_vendors    other bids in play while the deal is open
--   target_install_date  hand-off date to Operations
--   year_built / buildings / occupancy_pct   property facts (can be filled from ARIA)
--   aria_property_id     link to the ARIA property record the facts came from
--
-- No new tables, so no GRANT block is needed.
-- ============================================================

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS decision_date        date,
  ADD COLUMN IF NOT EXISTS budget_status        text,
  ADD COLUMN IF NOT EXISTS pain_points          text,
  ADD COLUMN IF NOT EXISTS competing_vendors    text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_install_date  date,
  ADD COLUMN IF NOT EXISTS year_built           integer,
  ADD COLUMN IF NOT EXISTS buildings            integer,
  ADD COLUMN IF NOT EXISTS occupancy_pct        numeric,
  ADD COLUMN IF NOT EXISTS aria_property_id     uuid;

DO $$ BEGIN
  ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_budget_status_check
    CHECK (budget_status IS NULL OR budget_status IN ('confirmed', 'not_confirmed', 'unknown'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_occupancy_pct_check
    CHECK (occupancy_pct IS NULL OR (occupancy_pct >= 0 AND occupancy_pct <= 100));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_year_built_check
    CHECK (year_built IS NULL OR (year_built BETWEEN 1800 AND 2100));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_opportunities_aria_property ON public.opportunities (aria_property_id) WHERE aria_property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_decision_date ON public.opportunities (decision_date) WHERE decision_date IS NOT NULL;
