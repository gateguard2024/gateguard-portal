-- ════════════════════════════════════════════════════════════════════════════
-- Migration 111 — columns the repointed code needs on `leads` (+ link columns)
-- ════════════════════════════════════════════════════════════════════════════
-- Run AFTER 109, BEFORE deploying the show_leads→leads code repoint (and before 110).
-- Additive + idempotent. Brings SCOUT, ARIA import, and the email-campaign feature
-- onto `leads` so they keep working once they stop reading show_leads.
-- ════════════════════════════════════════════════════════════════════════════

-- 1 ── SCOUT + ARIA intel columns (were top-level on show_leads).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scout_status            text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scout_enrolled_at       timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scout_sent_at           timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scout_opened_at         timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_intel_updated_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_intel_source   text;
CREATE INDEX IF NOT EXISTS leads_scout_status_idx ON leads (scout_status) WHERE scout_status IS NOT NULL;

-- 2 ── Backfill the SCOUT columns from the data 109 stashed in legacy_data.
UPDATE leads
SET scout_status            = COALESCE(scout_status, legacy_data->>'scout_status'),
    scout_enrolled_at       = COALESCE(scout_enrolled_at, NULLIF(legacy_data->>'scout_enrolled_at','')::timestamptz),
    scout_sent_at           = COALESCE(scout_sent_at, NULLIF(legacy_data->>'scout_sent_at','')::timestamptz),
    scout_opened_at         = COALESCE(scout_opened_at, NULLIF(legacy_data->>'scout_opened_at','')::timestamptz),
    property_intel_updated_at = COALESCE(property_intel_updated_at, NULLIF(legacy_data->>'property_intel_updated_at','')::timestamptz),
    property_intel_source   = COALESCE(property_intel_source, legacy_data->>'property_intel_source')
WHERE legacy_show_lead_id IS NOT NULL;

-- 3 ── campaign_sends + crm_activities link to a lead now, not a show_lead.
ALTER TABLE campaign_sends ADD COLUMN IF NOT EXISTS lead_id uuid;
CREATE INDEX IF NOT EXISTS campaign_sends_lead_id_idx ON campaign_sends (lead_id) WHERE lead_id IS NOT NULL;
-- crm_activities.lead_id already exists (migration 008). activities.lead_id too.

-- 4 ── Backfill those link columns from the old show_lead_id via the 109 mapping.
--      Guarded — these legacy columns may not exist in this db.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'campaign_sends' AND column_name = 'show_lead_id') THEN
    UPDATE campaign_sends cs
    SET    lead_id = l.id
    FROM   leads l
    WHERE  l.legacy_show_lead_id = cs.show_lead_id
      AND  cs.show_lead_id IS NOT NULL
      AND  cs.lead_id IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'crm_activities' AND column_name = 'show_lead_id') THEN
    UPDATE crm_activities a
    SET    lead_id = l.id
    FROM   leads l
    WHERE  l.legacy_show_lead_id = a.show_lead_id
      AND  a.show_lead_id IS NOT NULL
      AND  a.lead_id IS NULL;
  END IF;
END $$;
