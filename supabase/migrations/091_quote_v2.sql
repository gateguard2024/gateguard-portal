-- ============================================================
-- 091_quote_v2.sql
-- Enhancements for the quote builder + client proposal workflow.
-- Adds: what's included checklist, payment schedule override,
--       SOW text, agreement template, file attachments,
--       signature capture, and rep-accept capability.
-- ============================================================

-- What's included checklist (array of strings shown on proposal)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS whats_included       jsonb DEFAULT '[]'::jsonb,

-- Payment schedule override (null = auto-calculated from totals)
-- Format: [{ label, description, amount, pct }]
  ADD COLUMN IF NOT EXISTS payment_schedule_json jsonb DEFAULT NULL,

-- Scope of Work free text (markdown/HTML accepted)
  ADD COLUMN IF NOT EXISTS sow_text              text,

-- Agreement type drives which sections appear in the proposal
  ADD COLUMN IF NOT EXISTS agreement_type        text DEFAULT 'install_only'
    CHECK (agreement_type IN ('install_only','install_service','gate_maintenance','full_service')),

-- Full agreement HTML stored after dealer edits and saves it
  ADD COLUMN IF NOT EXISTS agreement_html        text,

-- File attachments: [{ name, url, size, type }]
  ADD COLUMN IF NOT EXISTS attachments           jsonb DEFAULT '[]'::jsonb,

-- Signature capture
  ADD COLUMN IF NOT EXISTS signed_at             timestamptz,
  ADD COLUMN IF NOT EXISTS signer_name           text,
  ADD COLUMN IF NOT EXISTS signer_email          text,
  ADD COLUMN IF NOT EXISTS signer_ip             text,
  ADD COLUMN IF NOT EXISTS signature_data        text,   -- base64 PNG of drawn signature

-- Rep can accept on behalf of client from inside the portal
  ADD COLUMN IF NOT EXISTS accepted_by_rep       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_by_rep_name  text;

-- Index for signature lookups
CREATE INDEX IF NOT EXISTS idx_quotes_signed
  ON public.quotes (signed_at) WHERE signed_at IS NOT NULL;
