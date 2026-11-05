-- Migration 217: Executive Lexi (Nov 4 2026).
-- lexi_plans        — plans Lexi brings to the CEO for approval (90%+ certainty only),
--                     what was created when approved, and how each plan turned out
--                     (so Lexi's track record is visible).
-- lexi_market_notes — the daily market watch: industry / competitor / multifamily news
--                     Lexi found and why it matters to Gate Guard.
-- user_settings.lexi_exec_state — what Lexi has already looked at (so a signal makes
--                     one plan, not one every two hours).
-- Run on beta first, then prod.

CREATE TABLE IF NOT EXISTS public.lexi_plans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        text NOT NULL,                  -- Clerk id of the person it's for
  org_id         uuid,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'changes', 'rejected', 'expired')),
  source         text NOT NULL DEFAULT 'chat' CHECK (source IN ('chat', 'daily', 'signal')),
  title          text NOT NULL,
  problem        text,                           -- what we're solving / the opportunity
  plan_steps     jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence     integer NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  evidence       jsonb NOT NULL DEFAULT '[]'::jsonb,
  assumptions    jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks          jsonb NOT NULL DEFAULT '[]'::jsonb,
  impact_usd     numeric,
  impact_note    text,
  measure        text,                           -- how we'll know it worked
  due_date       date,
  owner          text,
  actions        jsonb NOT NULL DEFAULT '[]'::jsonb,   -- what approving creates (rocks, issues, to-dos, tasks)
  created_items  jsonb NOT NULL DEFAULT '[]'::jsonb,   -- what approving actually created
  signal_key     text,
  decision_note  text,
  decided_at     timestamptz,
  outcome        text CHECK (outcome IN ('worked', 'partly', 'did_not')),
  outcome_note   text,
  outcome_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.lexi_plans TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_lexi_plans_user ON public.lexi_plans (user_id, status, created_at DESC);
ALTER TABLE public.lexi_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lexi_plans_service ON public.lexi_plans;
CREATE POLICY lexi_plans_service ON public.lexi_plans TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.lexi_market_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url             text NOT NULL UNIQUE,
  headline        text NOT NULL,
  why_it_matters  text,
  topic           text,                          -- competitor | multifamily | access_control | video | proptech | economy | other
  source          text,
  published       text,                          -- as the source gave it ("2 days ago", a date)
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.lexi_market_notes TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_lexi_market_notes_created ON public.lexi_market_notes (created_at DESC);
ALTER TABLE public.lexi_market_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lexi_market_notes_service ON public.lexi_market_notes;
CREATE POLICY lexi_market_notes_service ON public.lexi_market_notes TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS lexi_exec_state jsonb NOT NULL DEFAULT '{}'::jsonb;
