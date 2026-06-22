-- ============================================================================
-- Migration 133 — Consolidate activity logging into ONE table: crm_activities
-- ============================================================================
-- Audit (June 2026) found activity data fragmented across two tables:
--   • crm_activities  — read by the unified ActivityTimeline + CRM detail (CANONICAL)
--   • activities      — written by some Nexus lead/opp flows (FRAGMENT)
-- All application code has been repointed to crm_activities. This migration makes
-- crm_activities a SUPERSET (adds the columns `activities` had) and copies any
-- existing `activities` rows over so no history is lost. The `activities` table is
-- then dropped in migration 134 (after you take a snapshot).
--
-- Run on BETA first, then PROD.
-- ============================================================================

-- 1 ── Make crm_activities a superset of activities (additive, safe).
ALTER TABLE public.crm_activities ADD COLUMN IF NOT EXISTS dealer_org_id uuid;
ALTER TABLE public.crm_activities ADD COLUMN IF NOT EXISTS created_by    text;
ALTER TABLE public.crm_activities ADD COLUMN IF NOT EXISTS contact_id    uuid;
ALTER TABLE public.crm_activities ADD COLUMN IF NOT EXISTS company_id    uuid;
ALTER TABLE public.crm_activities ADD COLUMN IF NOT EXISTS customer_id   uuid;

-- 2 ── Copy any existing activities rows into crm_activities (idempotent by id).
--      Only runs if the legacy `activities` table still exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'activities') THEN
    INSERT INTO public.crm_activities
      (id, dealer_org_id, created_by, type, subject, body,
       lead_id, opportunity_id, contact_id, company_id, customer_id,
       due_at, completed_at, created_at)
    SELECT
       a.id, a.dealer_org_id, a.created_by::text, a.type, a.subject, a.body,
       a.lead_id, a.opportunity_id, a.contact_id, a.company_id, a.customer_id,
       a.due_at, a.completed_at, a.created_at
    FROM public.activities a
    WHERE NOT EXISTS (SELECT 1 FROM public.crm_activities c WHERE c.id = a.id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_activities_org  ON public.crm_activities (dealer_org_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON public.crm_activities (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_opp  ON public.crm_activities (opportunity_id);
