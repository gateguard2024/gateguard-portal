-- ============================================================
-- Migration 183 — cost + labor per quote line (dealer P&L)
-- Run on BETA first, verify, then prod. ALTER only — no GRANT needed.
--
-- Lets the builder show a true dealer P&L: setup profit and term-of-contract
-- profit. These are INTERNAL cost columns — never exposed on the customer-facing
-- proposal (the public API does not select them).
--   unit_cost   = expected material cost per unit (one-time) or per-unit-per-month (recurring)
--   labor_hours = expected install labor hours per unit (one-time lines)
-- ============================================================

ALTER TABLE public.quote_line_items
  ADD COLUMN IF NOT EXISTS unit_cost   NUMERIC,
  ADD COLUMN IF NOT EXISTS labor_hours NUMERIC;
