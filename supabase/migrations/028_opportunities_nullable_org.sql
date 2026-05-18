-- Migration 028: Make dealer_org_id nullable on opportunities
-- Reason: GateGuard Corporate (SO) users have no org_id in Clerk metadata.
-- Corporate users can legitimately create opportunities that aren't scoped
-- to a specific dealer org. RLS / org-scoping handles the null case by
-- returning all records for corporate users (isCorporate check).

ALTER TABLE opportunities
  ALTER COLUMN dealer_org_id DROP NOT NULL;

-- Also ensure the org scope query in applyOrgScope handles null gracefully
-- (no SQL change needed — IS NULL filter is handled in application code)
