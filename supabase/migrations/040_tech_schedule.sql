ALTER TABLE technicians
  ADD COLUMN IF NOT EXISTS schedule jsonb;
