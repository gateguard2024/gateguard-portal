-- Migration 027: Two-party e-sign workflow
-- Adds countersignature fields, org linkage for lifecycle tracking,
-- and expands status to cover the full two-party flow.

-- ── Countersignature fields ────────────────────────────────────────────────
ALTER TABLE document_signatures
  ADD COLUMN IF NOT EXISTS countersigned_name   text,
  ADD COLUMN IF NOT EXISTS countersigned_by     text,          -- Clerk user ID (GateGuard signer)
  ADD COLUMN IF NOT EXISTS countersigned_title  text DEFAULT 'CEO',
  ADD COLUMN IF NOT EXISTS countersigned_at     timestamptz,
  ADD COLUMN IF NOT EXISTS countersigned_ip     text,
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz,   -- when GateGuard was notified to countersign
  ADD COLUMN IF NOT EXISTS executed_at          timestamptz,   -- when fully executed by both parties
  ADD COLUMN IF NOT EXISTS executed_cert_url    text;          -- Supabase URL of the completion certificate PDF

-- ── Org linkage for lifetime record tracking ──────────────────────────────
-- Documents follow: lead → opportunity → org (customer/vendor)
ALTER TABLE document_signatures
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_doc_sigs_org ON document_signatures(org_id) WHERE org_id IS NOT NULL;

-- ── Expand status enum ─────────────────────────────────────────────────────
-- Drop old constraint, replace with expanded set
ALTER TABLE document_signatures DROP CONSTRAINT IF EXISTS document_signatures_status_check;
ALTER TABLE document_signatures ADD CONSTRAINT document_signatures_status_check
  CHECK (status IN (
    'pending',             -- sent, awaiting counterparty signature
    'counterparty_signed', -- counterparty signed, awaiting GateGuard countersignature
    'fully_executed',      -- both parties signed — binding contract
    'declined',            -- counterparty declined
    'expired',             -- link expired before signing
    'cancelled'            -- voided before completion
  ));

-- ── Notification index ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_doc_sigs_needs_countersig
  ON document_signatures(status)
  WHERE status = 'counterparty_signed';
