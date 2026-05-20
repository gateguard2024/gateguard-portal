-- Migration 046: Quote ↔ Opportunity link, org multi-contacts, org attachments

-- 1. Add opportunity_id to quotes
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_opportunity_id ON quotes(opportunity_id);

-- 2. org_contacts — multiple contacts per organization
CREATE TABLE IF NOT EXISTS org_contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         text NOT NULL,
  title        text,
  email        text,
  phone        text,
  is_primary   boolean NOT NULL DEFAULT false,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_contacts_org_id ON org_contacts(org_id);

-- RLS
ALTER TABLE org_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON org_contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. org_attachments — file attachments per organization
CREATE TABLE IF NOT EXISTS org_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         text NOT NULL,          -- display filename
  file_url     text NOT NULL,          -- Supabase Storage URL
  file_size    bigint,                 -- bytes
  mime_type    text,
  category     text DEFAULT 'general', -- general | contract | invoice | permit | photo | other
  uploaded_by  text,                   -- Clerk user display name
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_attachments_org_id ON org_attachments(org_id);

-- RLS
ALTER TABLE org_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON org_attachments
  FOR ALL TO service_role USING (true) WITH CHECK (true);
