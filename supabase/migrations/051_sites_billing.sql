-- ============================================================
-- Migration 051 — Sites: billing configuration columns
-- Run on BETA first, verify, then prod.
-- ============================================================

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS billing_video_fee    numeric(10,2) DEFAULT 500.00,
  ADD COLUMN IF NOT EXISTS billing_unit_rate    numeric(5,2)  DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS billing_units        int,
  ADD COLUMN IF NOT EXISTS contract_months      int DEFAULT 36,
  ADD COLUMN IF NOT EXISTS contract_start_date  date,
  ADD COLUMN IF NOT EXISTS contract_end_date    date,
  ADD COLUMN IF NOT EXISTS billing_notes        text;
