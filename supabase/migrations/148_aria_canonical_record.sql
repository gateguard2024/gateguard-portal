-- Migration 148: ARIA canonical record — standardize every property into one
-- uniform shape across all sites. `facts` = Data In (scraped/verified as found),
-- `deductions` = Data Out (research + reasoning built on the facts).
--
-- These two JSONB bundles are the canonical source of truth the ARIA tabs read,
-- so a re-opened property looks identical to a fresh search. The existing flat
-- columns remain for DB filtering (stage/urgency/expiry) and back-compat.
--
-- ALTER TABLE only — no GRANT needed (existing table permissions unchanged).

ALTER TABLE public.aria_properties
  ADD COLUMN IF NOT EXISTS facts       JSONB,
  ADD COLUMN IF NOT EXISTS deductions  JSONB;

-- Canonical shape (for reference — enforced in the write layer, not the DB):
--   facts = {
--     property:        { name, address, city, state, units, year_built, occupancy,
--                        property_type, class, phone, website, management_company,
--                        owner_entity, last_sale },
--     connectivity:    { isp_providers[], video_providers[], bulk_agreements[],
--                        roe_detected, roe_providers[], roe_expiry_year, fcc_verified },
--     proptech_found:  { gate_operators[], access_control[], intercoms[], cameras[],
--                        smart_locks[], resident_apps[], package_solutions[], tech_generation },
--     decision_makers: [ { name, title, company, role_type, email, phone, linkedin_slug } ],
--     ownership:       { owner_entity, owner_type, portfolio_size, acquisition_year, capex_signal },
--     community_posts: [ { platform, quote, topic, signal_type, severity, url, date } ]
--   }
--   deductions = {
--     ai_intel:          { key_finding, buying_trends, behavioral_profile,
--                          primary_concern, buy_score, urgency },
--     scout:             { scout_brief, pitch_strategy, outreach_plan, outreach_sequence },
--     proptech_inferred: [ { category, name, confidence_pct, reason } ]
--   }

NOTIFY pgrst, 'reload schema';
