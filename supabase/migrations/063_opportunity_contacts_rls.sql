-- Migration 063: Ensure opportunity_contacts has RLS + service_role policy
-- Migration 008 created the table without enabling RLS or adding a service_role policy.
-- Depending on project defaults, this may silently block inserts/selects.
-- This migration is safe to run multiple times.

ALTER TABLE opportunity_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_all" ON opportunity_contacts
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Also ensure opportunity_stage_history has same coverage (created in same migration)
ALTER TABLE opportunity_stage_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_all" ON opportunity_stage_history
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
