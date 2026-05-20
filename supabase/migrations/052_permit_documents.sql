-- Migration 052: Permit documents + extended fields
-- Run on beta Supabase first, verify, then prod.

ALTER TABLE permits ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
ALTER TABLE permits ADD COLUMN IF NOT EXISTS inspector_name text;
ALTER TABLE permits ADD COLUMN IF NOT EXISTS inspection_date date;
ALTER TABLE permits ADD COLUMN IF NOT EXISTS jurisdiction text;
ALTER TABLE permits ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE permits ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- Bucket for permit document uploads is created in code (api/permits/[id]/upload/route.ts)
-- Supabase Storage bucket: "permit-docs" (public: false, file size limit: 20MB)
