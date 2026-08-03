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
