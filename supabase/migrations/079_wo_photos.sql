-- Migration 079: Work Order Photo Evidence
-- Ensures work_order_photos table exists with full schema.
-- NOTE: Base table was created in migration 077_operational.sql.
-- This migration adds caption + taken_at columns for richer field tech evidence capture.

CREATE TABLE IF NOT EXISTS work_order_photos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id  uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  org_id         uuid REFERENCES organizations(id),
  file_url       text NOT NULL,
  file_name      text,
  uploaded_by    text,
  caption        text,
  taken_at       timestamptz DEFAULT now(),
  created_at     timestamptz DEFAULT now()
);

-- Add caption column if table already exists (from 077)
ALTER TABLE work_order_photos ADD COLUMN IF NOT EXISTS caption   text;
ALTER TABLE work_order_photos ADD COLUMN IF NOT EXISTS taken_at  timestamptz DEFAULT now();

-- Index for fast WO lookups
CREATE INDEX IF NOT EXISTS wo_photos_wo_id_idx ON work_order_photos(work_order_id);

-- RLS
ALTER TABLE work_order_photos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'work_order_photos' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON work_order_photos USING (true) WITH CHECK (true);
  END IF;
END $$;
