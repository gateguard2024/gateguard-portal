-- Migration 047: link opportunities to customer orgs
-- Allows quotes created from an opportunity to also carry client_org_id

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS related_org_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_related_org ON opportunities(related_org_id);

COMMENT ON COLUMN opportunities.related_org_id IS
  'FK to organizations — set when this opportunity is associated with an existing customer/prospect org. Propagated to quotes as client_org_id.';
