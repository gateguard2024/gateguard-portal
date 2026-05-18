-- Migration 030: add stage column to show_leads
-- Enables per-lead stage progression tracking in the CRM pipeline
-- Stage is separate from conversion status (conversion is tracked via opportunities.show_lead_id)

ALTER TABLE show_leads
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'new';

-- Index for stage filtering (CRM list views)
CREATE INDEX IF NOT EXISTS show_leads_stage_idx ON show_leads (stage);

-- Existing rows: default to 'new'
-- No data migration needed — DEFAULT 'new' handles it
