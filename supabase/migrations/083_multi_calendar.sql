-- ============================================================
-- Migration 083 — Multi-Calendar: ICS subscriptions + Microsoft 365
-- Run on BETA first, verify, then prod.
-- ============================================================

-- Add source column to gcal_events so we can store events from any provider
ALTER TABLE gcal_events
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'google';  -- google | microsoft | ics

-- Fix user_settings: add columns the calendar routes actually need
-- (migration 053 created dedicated columns; sync routes need selected IDs + last synced)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS gcal_selected_calendar_ids jsonb DEFAULT '["primary"]'::jsonb,
  ADD COLUMN IF NOT EXISTS gcal_push_map              jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ms_refresh_token           text,
  ADD COLUMN IF NOT EXISTS ms_connected_at            timestamptz,
  ADD COLUMN IF NOT EXISTS ms_last_synced_at          timestamptz,
  ADD COLUMN IF NOT EXISTS ms_selected_calendar_ids   jsonb DEFAULT '["primary"]'::jsonb,
  ADD COLUMN IF NOT EXISTS ms_push_map                jsonb DEFAULT '{}'::jsonb;

-- calendar_connections: one row per connected calendar provider per user
CREATE TABLE IF NOT EXISTS calendar_connections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           text NOT NULL,        -- Clerk user ID
  provider          text NOT NULL,        -- 'google' | 'microsoft' | 'ics'
  name              text NOT NULL,        -- display name e.g. "Work Calendar", "iCloud Personal"
  color             text DEFAULT '#6B7EFF',

  -- ICS-specific
  ics_url           text,                 -- webcal:// or https:// ICS feed URL

  -- OAuth-specific (Google / Microsoft)
  refresh_token     text,
  selected_ids      jsonb DEFAULT '["primary"]'::jsonb,  -- calendar IDs to sync within this provider

  -- Sync state
  last_synced_at    timestamptz,
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_calendar_connections"
  ON calendar_connections FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS calendar_connections_user_id_idx ON calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS gcal_events_source_col_idx       ON gcal_events(source);
