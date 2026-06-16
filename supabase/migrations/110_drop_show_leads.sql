-- ════════════════════════════════════════════════════════════════════════════
-- Migration 110 — DROP show_leads (kill the second bucket)
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠️  DO NOT RUN until BOTH are true:
--     1. Migration 109 has run (data moved into `leads`).
--     2. The code repoint is deployed — NO route/page references show_leads or
--        opportunities.show_lead_id anymore. Verify with:
--          grep -rn "show_leads\|show_lead_id" app components lib   →   should be empty
--
-- Run on BETA first, exercise the app, THEN prod.
--
-- Tables/columns with a FK to show_leads (must be cleared by the CASCADE below):
--   show_lead_assignments.show_lead_id   (008)  — pure legacy, dropped
--   opportunities.show_lead_id           (028)  — redundant post-109, dropped
--   campaign_sends.show_lead_id          (029)  — link dropped, history kept
--   activities.show_lead_id              (039)  — remapped to lead_id in 109, column dropped
--   aria_properties.crm_lead_id          (098)  — re-pointed to leads below
-- ════════════════════════════════════════════════════════════════════════════

-- 1 ── Re-point ARIA intel links to the new lead BEFORE we lose the mapping.
--      (The FK to show_leads is removed by the CASCADE in step 3; do the data
--       fix first while leads.legacy_show_lead_id still maps old → new.)
ALTER TABLE aria_properties DROP CONSTRAINT IF EXISTS aria_properties_crm_lead_id_fkey;
UPDATE aria_properties p
SET    crm_lead_id = l.id
FROM   leads l
WHERE  l.legacy_show_lead_id = p.crm_lead_id
  AND  p.crm_lead_id IS NOT NULL;

-- 2 ── Drop the pure-legacy assignment table (replaced by leads.assigned_to / assigned_dealer).
DROP TABLE IF EXISTS show_lead_assignments CASCADE;

-- 3 ── Drop the bucket. CASCADE removes the remaining FK constraints on
--      opportunities / campaign_sends / activities (their columns survive).
DROP TABLE IF EXISTS show_leads CASCADE;

-- 4 ── Remove the now-orphaned link columns.
ALTER TABLE opportunities DROP COLUMN IF EXISTS show_lead_id;
ALTER TABLE activities     DROP COLUMN IF EXISTS show_lead_id;
ALTER TABLE campaign_sends DROP COLUMN IF EXISTS show_lead_id;

-- Optional cleanup once you're confident nothing reads provenance:
-- ALTER TABLE leads DROP COLUMN IF EXISTS legacy_show_lead_id;
-- ALTER TABLE leads DROP COLUMN IF EXISTS legacy_data;
