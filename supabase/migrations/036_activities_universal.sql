-- Extend crm_activities to link to any record type
ALTER TABLE crm_activities
  ADD COLUMN IF NOT EXISTS site_id         uuid REFERENCES sites(id)         ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS work_order_id   uuid REFERENCES work_orders(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_id          uuid REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_activities_site     ON crm_activities(site_id)       WHERE site_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_activities_wo       ON crm_activities(work_order_id) WHERE work_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_activities_org      ON crm_activities(org_id)        WHERE org_id IS NOT NULL;
