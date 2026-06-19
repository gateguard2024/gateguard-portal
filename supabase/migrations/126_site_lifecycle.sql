-- Migration 126: site lifecycle + activation rule (#60)
-- A site becomes ACTIVE only when the contract is signed AND the deposit is paid.
-- These columns let the deposit→job automation stamp activation and let the UI
-- show status + what's blocking activation. ALTER only — no GRANT needed.

ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS lifecycle_status   TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS deposit_paid_at    TIMESTAMPTZ;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS activated_at       TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sites_lifecycle_status ON public.sites (lifecycle_status);
