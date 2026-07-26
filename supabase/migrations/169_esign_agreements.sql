-- Migration 169: track e-signature agreements (Acrobat Sign or built-in) sent
-- from the Document Library, so status flows back into the portal via webhook.

CREATE TABLE IF NOT EXISTS public.esign_agreements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES public.organizations(id),
  document_id   UUID REFERENCES public.org_documents(id) ON DELETE SET NULL,
  provider      TEXT NOT NULL DEFAULT 'adobe_sign',   -- adobe_sign | builtin
  agreement_id  TEXT,                                  -- provider's id (Adobe agreementId)
  name          TEXT NOT NULL,
  signer_email  TEXT,
  signer_name   TEXT,
  status        TEXT NOT NULL DEFAULT 'sent',          -- sent | out_for_signature | signed | completed | cancelled
  signed_url    TEXT,                                  -- stored signed PDF (once completed)
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.esign_agreements TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_esign_agreements_org ON public.esign_agreements(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_esign_agreements_agreementid ON public.esign_agreements(agreement_id);
CREATE INDEX IF NOT EXISTS idx_esign_agreements_document ON public.esign_agreements(document_id);
