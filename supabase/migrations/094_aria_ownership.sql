-- Migration 094: ARIA lead ownership + temp hold
-- Adds per-rep ownership and 7-day temp hold to show_leads.
-- Run on beta first, then prod.

ALTER TABLE show_leads ADD COLUMN IF NOT EXISTS assigned_to_user_id TEXT;
ALTER TABLE show_leads ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;
ALTER TABLE show_leads ADD COLUMN IF NOT EXISTS temp_hold_expires_at TIMESTAMPTZ;

-- Index so we can quickly query "leads held by this user" or "expired holds"
CREATE INDEX IF NOT EXISTS show_leads_assigned_user_idx ON show_leads(assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS show_leads_temp_hold_idx ON show_leads(temp_hold_expires_at) WHERE temp_hold_expires_at IS NOT NULL;
