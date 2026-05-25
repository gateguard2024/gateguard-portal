-- 086: Ensure organizations has all customer-detail columns
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS)

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS address                text,
  ADD COLUMN IF NOT EXISTS city                   text,
  ADD COLUMN IF NOT EXISTS state                  text,
  ADD COLUMN IF NOT EXISTS notes                  text,
  ADD COLUMN IF NOT EXISTS primary_contact_name   text,
  ADD COLUMN IF NOT EXISTS primary_contact_email  text,
  ADD COLUMN IF NOT EXISTS primary_contact_phone  text,
  ADD COLUMN IF NOT EXISTS website                text,
  ADD COLUMN IF NOT EXISTS updated_at             timestamptz DEFAULT now();

-- Ensure crm_activities has universal FK columns (migration 036 may not have run)
ALTER TABLE crm_activities
  ADD COLUMN IF NOT EXISTS org_id         uuid REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_id        uuid REFERENCES sites(id)         ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS work_order_id  uuid REFERENCES work_orders(id)   ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_activities_org ON crm_activities(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_activities_site ON crm_activities(site_id) WHERE site_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_activities_wo ON crm_activities(work_order_id) WHERE work_order_id IS NOT NULL;

-- Ensure org_contacts and org_attachments exist (migration 046 may not have run)
CREATE TABLE IF NOT EXISTS org_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          text NOT NULL,
  title         text,
  email         text,
  phone         text,
  is_primary    boolean DEFAULT false,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          text NOT NULL,
  file_url      text NOT NULL,
  file_size     bigint,
  mime_type     text,
  category      text DEFAULT 'general',
  uploaded_by   text,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE org_contacts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_attachments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='org_contacts' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON org_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='org_attachments' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON org_attachments FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
