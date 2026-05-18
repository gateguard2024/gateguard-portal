-- Migration 028: Make dealer_org_id nullable + add show_lead_id to opportunities
--
-- 1. dealer_org_id: GateGuard Corporate (SO) users have no org_id in Clerk metadata.
--    Corporate users can legitimately create opportunities not scoped to a dealer org.
--
-- 2. show_lead_id: Show leads live in show_leads table (not the crm leads table).
--    opportunities.lead_id has a FK → leads(id), which rejects show lead UUIDs.
--    Add a dedicated show_lead_id column with a FK → show_leads(id).

ALTER TABLE opportunities
  ALTER COLUMN dealer_org_id DROP NOT NULL;

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS show_lead_id uuid REFERENCES show_leads(id) ON DELETE SET NULL;
