-- ════════════════════════════════════════════════════════════════════════════
-- Migration 109 — CONSOLIDATE LEADS INTO ONE BUCKET
-- ════════════════════════════════════════════════════════════════════════════
-- Problem: leads live in TWO tables — `leads` (the modern CRM pipeline, used by
-- the glass Lead Glass / workbench / inbound flow) and `show_leads` (the legacy
-- ARIA/"show leads" table). The New Opportunity picker reads show_leads, so reps
-- never see the leads they actually work. We are killing show_leads.
--
-- This migration is PHASE 1: move every show_leads row into `leads` (losslessly)
-- and re-point opportunities.show_lead_id → lead_id. It is IDEMPOTENT and does
-- NOT drop show_leads. Drop happens in migration 110 AFTER the code is repointed
-- and verified on beta.
--
-- RUN ORDER:  109 (this)  →  deploy code that reads `leads`  →  verify on beta  →  110 (drop)
-- ════════════════════════════════════════════════════════════════════════════

-- 1 ── Legacy show_leads had no org. Allow null org_id on leads so migrated rows
--      land cleanly (corporate sees all; null-org leads behave like the old
--      unassigned show_leads).
ALTER TABLE leads ALTER COLUMN org_id DROP NOT NULL;

-- 2 ── Provenance + columns show_leads carried that `leads` didn't have yet.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS legacy_show_lead_id   uuid;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS legacy_data           jsonb;       -- full original row, lossless
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_name         text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS city                  text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS state                 text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_title         text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_dealer       text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to_user_id   text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to_name      text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS temp_hold_expires_at  timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_intel        jsonb;

-- One migrated lead per show_lead (lets us re-run safely + remap opportunities).
CREATE UNIQUE INDEX IF NOT EXISTS leads_legacy_show_lead_id_key
  ON leads (legacy_show_lead_id) WHERE legacy_show_lead_id IS NOT NULL;

-- 3 ── Copy every show_leads row into `leads` (skip any already migrated).
--      The live show_leads schema drifted from the migrations (some columns
--      don't exist), so we read EVERY field out of to_jsonb(s.*) — a missing
--      key yields NULL instead of erroring. The full original row is also kept
--      in legacy_data, so nothing is ever lost.
--      stage is forced to a valid lead_stage enum value; original kept in legacy_data.
WITH src AS (
  SELECT s.id AS sid, to_jsonb(s.*) AS j FROM show_leads s
)
INSERT INTO leads (
  legacy_show_lead_id, legacy_data,
  contact_name, property_name, company_name, email, phone,
  property_type, unit_count, location, city, state, contact_title,
  notes, source, stage,
  assigned_dealer, assigned_to_user_id, assigned_to_name, temp_hold_expires_at,
  property_intel, created_at
)
SELECT
  src.sid,
  src.j,
  src.j->>'name',
  src.j->>'property_name',
  NULLIF(src.j->>'property_name', ''),                          -- company_name best-effort
  src.j->>'email',
  src.j->>'phone',
  COALESCE(NULLIF(src.j->>'property_type',''), 'Multifamily'),
  NULLIF(src.j->>'units','')::int,
  NULLIF(concat_ws(', ', src.j->>'city', src.j->>'state'), ''),
  src.j->>'city',
  src.j->>'state',
  src.j->>'contact_title',
  src.j->>'notes',
  COALESCE(NULLIF(src.j->>'source',''), 'show'),
  'prospect'::lead_stage,                                       -- safe default; original in legacy_data->>'stage'
  src.j->>'assigned_dealer',
  src.j->>'assigned_to_user_id',
  src.j->>'assigned_to_name',
  NULLIF(src.j->>'temp_hold_expires_at','')::timestamptz,
  CASE WHEN src.j ? 'property_intel' THEN src.j->'property_intel' ELSE NULL END,
  COALESCE(NULLIF(src.j->>'created_at','')::timestamptz, now())
FROM src
WHERE NOT EXISTS (
  SELECT 1 FROM leads l WHERE l.legacy_show_lead_id = src.sid
);

-- 4 ── Re-point opportunities from the old show_lead_id to the new lead_id.
--      Guarded: only runs if opportunities.show_lead_id actually exists in THIS db
--      (the live schema drifted from the migration files). Fills lead_id only
--      where it's still blank, so existing links are untouched.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'opportunities' AND column_name = 'show_lead_id') THEN
    UPDATE opportunities o
    SET    lead_id = l.id
    FROM   leads l
    WHERE  l.legacy_show_lead_id = o.show_lead_id
      AND  o.show_lead_id IS NOT NULL
      AND  o.lead_id IS NULL;
  END IF;
END $$;

-- 5 ── Re-point any activities logged against a show_lead so the timeline
--      follows the lead into its new home. Guarded the same way.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'activities' AND column_name = 'show_lead_id') THEN
    UPDATE activities a
    SET    lead_id = l.id
    FROM   leads l
    WHERE  l.legacy_show_lead_id = a.show_lead_id
      AND  a.show_lead_id IS NOT NULL
      AND  a.lead_id IS NULL;
  END IF;
END $$;

-- (aria_properties.crm_lead_id still has a FK to show_leads here, so it is
--  re-pointed in migration 110 after that constraint is dropped.)

-- ── show_leads is intentionally LEFT IN PLACE here. ──
-- After the app no longer references it (code repoint deployed + verified),
-- run migration 110 to drop show_leads and opportunities.show_lead_id.
