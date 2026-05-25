-- Migration 081: Add payment_type to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_type text;  -- check | ach | credit_card | wire | cash | zelle | other
