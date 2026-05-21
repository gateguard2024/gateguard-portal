-- Migration 060 — partner_docs + contact fields on organizations
-- Adds compliance document storage (JSONB array) and named contact fields
-- Run on beta Supabase first, verify /admin/dealers/[id] Compliance tab, then prod

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS partner_docs jsonb DEFAULT '[]'::jsonb;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_phone text;

-- Index for JSONB queries on doc status
CREATE INDEX IF NOT EXISTS idx_organizations_partner_docs ON organizations USING GIN (partner_docs);

COMMENT ON COLUMN organizations.partner_docs IS
'Array of compliance document records. Each entry: { type, label, status, url, expires_at, uploaded_at, notes }
 type: w9 | 1099 | coi | license | nda | agreement | background_check
 status: missing | pending | on_file | expired';

COMMENT ON COLUMN organizations.contact_name  IS 'Primary contact name for this partner org';
COMMENT ON COLUMN organizations.contact_email IS 'Primary contact email for this partner org';
COMMENT ON COLUMN organizations.contact_phone IS 'Primary contact phone for this partner org';
