-- Migration 185: Property Partnership proposal config on a quote.
-- Stores the letter's per-property variables (contact, access-point breakdown,
-- setup fee, resident fee, billing mode, add-ons) for the PartnershipProposal
-- renderer. quote_mode = 'partnership' switches the client-facing proposal to the
-- Partnership letter. ALTER only — no GRANT needed.

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS partnership JSONB;
