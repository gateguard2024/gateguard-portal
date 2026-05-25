-- Migration 087: ATLAS Resident Lifecycle Middleware
-- Creates the atlas_events table for tracking resident provisioning/deprovisioning events

CREATE TABLE IF NOT EXISTS atlas_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid        REFERENCES sites(id) ON DELETE SET NULL,
  property_name   text        NOT NULL,
  unit_number     text,
  resident_name   text        NOT NULL,
  event_type      text        NOT NULL CHECK (event_type IN ('move_in', 'move_out', 'name_change', 'renewal')),
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'provisioning', 'active', 'deactivated', 'failed', 'skipped')),
  directv_account text,
  sara_order_id   text,
  error_message   text,
  processed_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atlas_events_site   ON atlas_events(site_id);
CREATE INDEX IF NOT EXISTS idx_atlas_events_status ON atlas_events(status);
CREATE INDEX IF NOT EXISTS idx_atlas_events_created ON atlas_events(created_at DESC);

ALTER TABLE atlas_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'atlas_events'
      AND policyname = 'service_role_all'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY service_role_all ON atlas_events
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $policy$;
  END IF;
END
$$;
