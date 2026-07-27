-- Migration 170: document entity linking + floor-plan design sets
-- (Tier 2). ALTER TABLE only — no GRANT needed (existing table perms unchanged).

-- ─── Documents: link a library doc to the opportunity it came from ───────────
-- org_documents already carries org_id (dealer) + site_id; add opportunity_id so
-- a contract/doc can point back to the deal it was created from.
ALTER TABLE public.org_documents
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_documents_opportunity ON public.org_documents(opportunity_id)
  WHERE opportunity_id IS NOT NULL;

-- ─── Floor plans: tie the three stages into one versioned design set ──────────
-- A property's Floor Plan → System Design → As-Built are separate floor_plans
-- rows (distinguished by status). design_group_id links them as ONE design; every
-- stage of the same design shares it. version bumps each time a stage is promoted.
ALTER TABLE public.floor_plans
  ADD COLUMN IF NOT EXISTS design_group_id UUID,
  ADD COLUMN IF NOT EXISTS version         INTEGER DEFAULT 1;

-- Backfill: existing plans each become their own single-stage group.
UPDATE public.floor_plans SET design_group_id = id WHERE design_group_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_floor_plans_design_group ON public.floor_plans(design_group_id)
  WHERE design_group_id IS NOT NULL;
