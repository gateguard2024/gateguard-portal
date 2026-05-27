-- Migration 097: Add document_html to document_signatures
-- Stores the full editable document content at send time so the signer
-- sees the exact text that was reviewed/edited by the GateGuard user.
-- Used when no document_url (PDF) exists — covers NDA and agreements
-- generated from our TypeScript templates.

ALTER TABLE public.document_signatures
  ADD COLUMN IF NOT EXISTS document_html TEXT;

COMMENT ON COLUMN public.document_signatures.document_html IS
  'Full plain-text or HTML of the document at time of send. Displayed on the signing page when no document_url PDF is available. Editable before send.';
