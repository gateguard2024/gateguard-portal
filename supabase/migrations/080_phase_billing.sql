-- Migration 080: Phase Billing
-- Adds phase billing columns to invoices so a single project can be split
-- into multiple installments (Deposit / Milestone / Final) linked by a group UUID.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS phase_group_id       uuid,
  ADD COLUMN IF NOT EXISTS phase_number         integer,
  ADD COLUMN IF NOT EXISTS phase_label          text,
  ADD COLUMN IF NOT EXISTS phase_total_amount   numeric;  -- total contract value for reference

CREATE INDEX IF NOT EXISTS invoices_phase_group_idx
  ON invoices (phase_group_id)
  WHERE phase_group_id IS NOT NULL;
