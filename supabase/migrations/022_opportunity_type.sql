-- Migration 022: Enhance opportunities with document tracking + approval fields
-- The opp_type column already exists (text, from 008_crm_full.sql)
-- This migration adds document status tracking and approval workflow fields

-- Add document tracking + approval columns (safe — IF NOT EXISTS)
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS documents_status jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS approved_at      timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by      text;

-- documents_status shape:
-- {
--   nda_sent: boolean,
--   nda_signed: boolean,
--   agreement_sent: boolean,
--   agreement_negotiated: boolean,
--   agreement_signed: boolean,
--   background_check_complete: boolean,
--   territory_confirmed: boolean,
--   tech_certification_scheduled: boolean,
--   vetting_complete: boolean,
--   insurance_verified: boolean,
--   sla_confirmed: boolean,
--   crm_access_granted: boolean,
--   site_survey_complete: boolean,
--   quote_sent: boolean,
--   quote_approved: boolean,
--   install_scheduled: boolean,
--   site_walk_complete: boolean,
--   service_scheduled: boolean,
--   commission_agreement_sent: boolean,
--   commission_agreement_signed: boolean,
-- }

-- Valid opp_type values (text column — no enum needed):
-- master_agent, mso, dealer, install_partner, service_partner,
-- sales_partner, property, company, customer

-- Index for filtering by opp_type (already a text column with existing data)
CREATE INDEX IF NOT EXISTS idx_opportunities_opp_type ON opportunities (opp_type);
CREATE INDEX IF NOT EXISTS idx_opportunities_approved_at ON opportunities (approved_at) WHERE approved_at IS NOT NULL;
