-- Migration 219: Executive Lexi workstreams (Nov 4 2026).
-- nexus_usage      — which Nexus areas (bottom-bar tabs, Admin, Help…) each person opens, so
--                    Lexi can see what's used and what isn't. One row per visit (the app
--                    sends at most one per area per 10 minutes per person).
-- lexi_work_items  — Lexi's own running work list ("What I'm working on"), per workstream.
-- lexi_plans.workstream — which workstream a plan belongs to.
-- Run on beta first, then prod.

CREATE TABLE IF NOT EXISTS public.nexus_usage (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  org_id      uuid,
  org_tier    text,
  role        text,
  area        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.nexus_usage TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_nexus_usage_created ON public.nexus_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nexus_usage_org ON public.nexus_usage (org_id, created_at DESC);
ALTER TABLE public.nexus_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nexus_usage_service ON public.nexus_usage;
CREATE POLICY nexus_usage_service ON public.nexus_usage TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.lexi_work_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,                       -- whose Lexi (Clerk id)
  workstream  text NOT NULL CHECK (workstream IN ('sales', 'upsell', 'collections', 'dealers', 'nexus', 'fleet')),
  title       text NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'waiting', 'done')),
  next_step   text,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.lexi_work_items TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_lexi_work_items_user ON public.lexi_work_items (user_id, status, updated_at DESC);
ALTER TABLE public.lexi_work_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lexi_work_items_service ON public.lexi_work_items;
CREATE POLICY lexi_work_items_service ON public.lexi_work_items TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.lexi_plans ADD COLUMN IF NOT EXISTS workstream text;
