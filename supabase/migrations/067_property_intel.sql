-- Migration 067: property_intel JSONB column on show_leads and opportunities
-- Stores ARIA-generated + rep-verified property technology intelligence.
-- Updated throughout the sales cycle as reps verify/correct data.

ALTER TABLE show_leads
  ADD COLUMN IF NOT EXISTS property_intel jsonb,
  ADD COLUMN IF NOT EXISTS property_intel_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS property_intel_source text DEFAULT 'aria'; -- aria | rep_verified | tavily

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS property_intel jsonb,
  ADD COLUMN IF NOT EXISTS property_intel_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS property_intel_source text DEFAULT 'aria';

CREATE INDEX IF NOT EXISTS show_leads_property_intel_idx ON show_leads USING gin(property_intel);
CREATE INDEX IF NOT EXISTS opportunities_property_intel_idx ON opportunities USING gin(property_intel);

COMMENT ON COLUMN show_leads.property_intel IS 'ARIA-generated + rep-verified property tech stack: ISP, video, gate, access control, cameras, intercoms, smart locks, resident apps. Updated during sales cycle.';
COMMENT ON COLUMN opportunities.property_intel IS 'ARIA-generated + rep-verified property tech stack. Carries forward from lead. Updated as reps learn more during sales cycle.';
