-- ============================================================
-- Migration 180 — Opportunity deal-value fields for TCV forecasting
-- Run on BETA first, verify, then prod.
--
-- Powers Total Contract Value + weighted forecast on the opportunity window:
--   TCV = (est_mrr × contract_term months) + install_fee
--   Weighted = TCV × estimated win %
-- The window is drift-safe (it strips these if missing), but adding the columns
-- lets install fee + term actually persist so dealer/company forecasting rolls up.
-- ============================================================

ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS install_fee   NUMERIC;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS contract_term INTEGER;  -- months

-- Managing admin (the person who oversees the rep on this deal — NOT the property
-- management company, which is management_co). Selected from org admins.
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS manager_id   TEXT;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS manager_name TEXT;

-- Manually-attached quote (stopgap until the quote builder is locked in).
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS quote_url    TEXT;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS quote_total  NUMERIC;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS quote_status TEXT;
