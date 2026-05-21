-- Migration 061: Add missing columns to quotes table
-- Adds opportunity_id, survey_id, and site_id that were referenced in code
-- but not yet present in the live schema. Safe to run multiple times.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS survey_id      uuid REFERENCES surveys(id)       ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_id        uuid REFERENCES sites(id)         ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_opportunity_id ON quotes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_quotes_survey_id      ON quotes(survey_id);
CREATE INDEX IF NOT EXISTS idx_quotes_site_id        ON quotes(site_id);
