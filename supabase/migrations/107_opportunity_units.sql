-- Migration 107: capture the two pricing-critical fields on the opportunity,
-- entered in Overview and carried forward into Financials.
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS units integer;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS unit_automation boolean DEFAULT false;
-- Editable contact snapshot on the opportunity (Overview deal details).
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contact_phone text;
-- (ALTER TABLE on an existing table needs no GRANT.)
