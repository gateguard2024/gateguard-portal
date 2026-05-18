-- Migration 026: document_templates
-- Stores canonical template PDFs for each document type.
-- The send route auto-looks up the active template when no document_url is provided.

CREATE TABLE IF NOT EXISTS document_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type   text        NOT NULL,   -- nda | master_agent_agreement | dealer_agreement | ...
  applies_to      text[]      NOT NULL,   -- org tiers this template covers
  version         text        NOT NULL DEFAULT 'v1.0',
  storage_path    text        NOT NULL,   -- 'document-templates/nda_v1.0.pdf'
  public_url      text        NOT NULL,   -- full public URL (Supabase Storage public)
  is_active       boolean     NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text                    -- Clerk user ID of uploader
);

-- Only one active template per document_type at a time
CREATE UNIQUE INDEX IF NOT EXISTS document_templates_active_type
  ON document_templates (document_type)
  WHERE is_active = true;

-- RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON document_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON document_templates
  FOR SELECT TO authenticated USING (true);

-- Seed: NDA template (update public_url after uploading to Supabase Storage)
INSERT INTO document_templates (document_type, applies_to, version, storage_path, public_url, notes)
VALUES (
  'nda',
  ARRAY['master_agent', 'master_dealer', 'full_dealer', 'install_contractor', 'service_dealer', 'sales_partner'],
  'v1.0',
  'document-templates/GateGuard_Mutual_NDA_v1.0.pdf',
  'PLACEHOLDER_UPDATE_AFTER_UPLOAD',
  'GateGuard Mutual NDA — Georgia law — May 2026'
)
ON CONFLICT DO NOTHING;

-- Placeholder rows for other templates (activate when documents are ready)
INSERT INTO document_templates (document_type, applies_to, version, storage_path, public_url, is_active, notes)
VALUES
  ('master_agent_agreement', ARRAY['master_agent'], 'v1.0', 'document-templates/GateGuard_Master_Agent_Agreement_v1.0.pdf', 'PLACEHOLDER_UPDATE_AFTER_UPLOAD', false, 'Master Agent Agreement — pending upload'),
  ('dealer_agreement',       ARRAY['master_dealer','full_dealer'], 'v1.0', 'document-templates/GateGuard_Dealer_Agreement_v1.0.pdf', 'PLACEHOLDER_UPDATE_AFTER_UPLOAD', false, 'Dealer Agreement — pending upload'),
  ('install_partner_agreement', ARRAY['install_contractor'], 'v1.0', 'document-templates/GateGuard_Install_Partner_Agreement_v1.0.pdf', 'PLACEHOLDER_UPDATE_AFTER_UPLOAD', false, 'Install Partner Agreement — pending upload'),
  ('service_agreement',      ARRAY['service_dealer'], 'v1.0', 'document-templates/GateGuard_Service_Agreement_v1.0.pdf', 'PLACEHOLDER_UPDATE_AFTER_UPLOAD', false, 'Service Partner Agreement — pending upload'),
  ('sales_partner_agreement', ARRAY['sales_partner'], 'v1.0', 'document-templates/GateGuard_Sales_Partner_Agreement_v1.0.pdf', 'PLACEHOLDER_UPDATE_AFTER_UPLOAD', false, 'Sales Partner Agreement — pending upload')
ON CONFLICT DO NOTHING;
