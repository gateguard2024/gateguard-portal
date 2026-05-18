-- GateGuard OS — Migration 025: Document Signatures
-- Lightweight built-in e-sign: token-based signing links for NDAs and agreements.

CREATE TABLE IF NOT EXISTS document_signatures (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token            text UNIQUE NOT NULL,          -- secure random token for the signing URL

  -- Document metadata
  document_type    text NOT NULL                  -- 'nda' | 'master_agent_agreement' | 'dealer_agreement' | 'service_agreement'
    CHECK (document_type IN ('nda','master_agent_agreement','dealer_agreement','service_agreement','install_partner_agreement','sales_partner_agreement')),
  document_version text,                          -- e.g. "v2025-05" for tracking revision
  document_url     text,                          -- Supabase Storage URL of the PDF to display

  -- Links to CRM
  opportunity_id   uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  lead_id          text,                          -- show_leads id (text UUID)

  -- Signer info (pre-filled from CRM when sending)
  signer_name      text,
  signer_email     text NOT NULL,
  signer_title     text,
  signer_company   text,

  -- Signature capture
  signed_name      text,                          -- name as typed during signing
  signed_title     text,
  signed_ip        text,
  signed_at        timestamptz,
  signed_user_agent text,

  -- Status
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','signed','declined','expired')),

  -- Sender
  sent_by          text NOT NULL,                 -- Clerk user ID of sender
  sent_by_name     text,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '30 days'),

  -- Stage to advance to when signed (e.g. 'NDA Signed')
  advance_stage    text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_signatures"
  ON document_signatures USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_doc_sigs_token       ON document_signatures(token);
CREATE INDEX IF NOT EXISTS idx_doc_sigs_opportunity ON document_signatures(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_sigs_email       ON document_signatures(signer_email);
CREATE INDEX IF NOT EXISTS idx_doc_sigs_status      ON document_signatures(status);
