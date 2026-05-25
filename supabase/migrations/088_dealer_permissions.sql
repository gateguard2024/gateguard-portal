-- Migration 088: dealer_permissions table
-- Stores per-section feature access level for each dealer org
-- Levels: none | view | edit | administer
-- none        = section hidden/grayed out in portal nav
-- view        = read-only, scoped to their org level and below
-- edit        = can make changes to their org level and below
-- administer  = full control + can invite/manage users from their org level down

CREATE TABLE IF NOT EXISTS dealer_permissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  section_id      text NOT NULL,  -- e.g. 'crm', 'work_orders', 'billing', etc.
  level           text NOT NULL DEFAULT 'view'
                  CHECK (level IN ('none', 'view', 'edit', 'administer')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (org_id, section_id)
);

-- Index for fast lookups by org
CREATE INDEX IF NOT EXISTS idx_dealer_permissions_org ON dealer_permissions(org_id);

-- RLS
ALTER TABLE dealer_permissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dealer_permissions' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON dealer_permissions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_dealer_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dealer_permissions_updated_at ON dealer_permissions;
CREATE TRIGGER dealer_permissions_updated_at
  BEFORE UPDATE ON dealer_permissions
  FOR EACH ROW EXECUTE FUNCTION update_dealer_permissions_updated_at();

-- Section IDs reference (for documentation)
-- crm          CRM & Sales (leads, opportunities, pipeline)
-- customers    Customers (accounts, contacts, activity)
-- quotes       Quotes & Proposals
-- billing      Billing & Invoices
-- work_orders  Work Orders (field jobs, dispatch)
-- sites        Properties & Sites (installed properties, assets)
-- inventory    Inventory (parts, van stock, POs)
-- tech_tool    Tech Tool & Surveys (/tech diagnostics, site surveys)
-- training     Training & Certifications
-- compliance   Compliance & Permits
-- reps         Reps & Commissions
-- design       Design Suite (floor plans, as-builts, e-sign)
-- security     Security Hardware (cameras, access control, network)
-- ai_army      AI Intelligence (ARIA, SCOUT, NEXUS, agents)
-- admin        Admin & Dealers (dealer mgmt, users, scorecard, map)
