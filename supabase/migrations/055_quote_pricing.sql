-- Migration 055 — Quote pricing: line discounts + ramp-up payment plan
-- Run on BETA first, verify, then prod.

-- Add per-line discount to quote_line_items
ALTER TABLE quote_line_items
  ADD COLUMN IF NOT EXISTS line_discount_percent numeric(5,2) NOT NULL DEFAULT 0;

-- Add payment plan fields to quotes
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS payment_plan        text NOT NULL DEFAULT 'standard',  -- standard | ramp_up
  ADD COLUMN IF NOT EXISTS ramp_up_start_pct   numeric(5,2) DEFAULT 10.0,         -- month 2 %
  ADD COLUMN IF NOT EXISTS ramp_up_step_pct    numeric(5,2) DEFAULT 7.5,          -- added each month
  ADD COLUMN IF NOT EXISTS ramp_up_full_month  int DEFAULT 14;                    -- month that hits 100%
