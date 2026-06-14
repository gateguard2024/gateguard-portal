-- Migration 113: link proposal documents back to their quote
--
-- Lets a 'proposal' document_signatures row reference the quote it represents,
-- so approving the proposal on the public portal can update the quote (sales path).
-- Run on beta first, then prod. ALTER only — no GRANT needed.

ALTER TABLE public.document_signatures
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS document_signatures_quote_id_idx
  ON public.document_signatures (quote_id)
  WHERE quote_id IS NOT NULL;
