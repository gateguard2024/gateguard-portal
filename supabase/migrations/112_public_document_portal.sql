-- Migration 112: Public Document Portal — unify outbound documents
--
-- Extends document_signatures to be the single record behind every external
-- document (NDA, agreements, customer contracts, proposals) served at the public
-- /document/[slug] glass portal.
--
--   public_slug  — readable URL slug (e.g. acme-gate-100626-00481293). The TOKEN
--                  remains the true credential; the slug is for readability only.
--   customer_id  — client org the document is for (organizations).
--   property_id  — related site (sites).
--
-- Also extends document_type to cover customer contracts + proposals.
-- Run on beta first, then prod. ALTER only — no GRANT needed.
-- ============================================================

ALTER TABLE public.document_signatures
  ADD COLUMN IF NOT EXISTS public_slug  text,
  ADD COLUMN IF NOT EXISTS customer_id  uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_id  uuid REFERENCES public.sites(id) ON DELETE SET NULL;

-- Readable public slug must be unique (when set). The token stays the real credential.
CREATE UNIQUE INDEX IF NOT EXISTS document_signatures_public_slug_key
  ON public.document_signatures (public_slug)
  WHERE public_slug IS NOT NULL;

-- Extend document_type to cover customer contracts and proposals.
ALTER TABLE public.document_signatures DROP CONSTRAINT IF EXISTS document_signatures_document_type_check;
ALTER TABLE public.document_signatures ADD CONSTRAINT document_signatures_document_type_check
  CHECK (document_type IN (
    'nda',
    'master_agent_agreement',
    'dealer_agreement',
    'service_agreement',
    'install_partner_agreement',
    'sales_partner_agreement',
    'customer_contract',
    'proposal'
  ));
