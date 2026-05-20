-- ============================================================
-- Migration 053 — Calendar: user_settings, gcal_events
-- Run on BETA first, verify, then prod.
-- ============================================================

-- user_settings: per-user preferences and OAuth tokens (keyed by Clerk user ID)
CREATE TABLE IF NOT EXISTS user_settings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 text UNIQUE NOT NULL,   -- Clerk user ID
  org_id                  uuid REFERENCES organizations(id),

  -- Google Calendar OAuth
  gcal_refresh_token      text,
  gcal_access_token       text,
  gcal_token_expiry       timestamptz,
  gcal_connected_at       timestamptz,
  gcal_last_synced_at     timestamptz,
  gcal_calendar_id        text DEFAULT 'primary', -- which GCal to sync to/from

  -- UI preferences (extensible)
  calendar_default_view   text DEFAULT 'week',    -- week | month
  timezone                text DEFAULT 'America/New_York',
  notifications_enabled   boolean DEFAULT true,

  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- gcal_events: Google Calendar events pulled during sync
CREATE TABLE IF NOT EXISTS gcal_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 text NOT NULL,          -- Clerk user ID (owner)
  org_id                  uuid REFERENCES organizations(id),

  gcal_event_id           text NOT NULL,          -- Google's event ID
  gcal_calendar_id        text NOT NULL DEFAULT 'primary',

  title                   text NOT NULL,
  description             text,
  location                text,
  start_time              timestamptz NOT NULL,
  end_time                timestamptz NOT NULL,
  is_all_day              boolean DEFAULT false,
  status                  text DEFAULT 'confirmed', -- confirmed | tentative | cancelled
  html_link               text,                   -- deep link to GCal event
  organizer_email         text,
  attendees               jsonb,                  -- array of {email, displayName, responseStatus}

  -- GateGuard link (optional — if synced FROM portal TO gcal)
  source_type             text,                   -- todo | work_order | null
  source_id               uuid,

  synced_at               timestamptz DEFAULT now(),
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),

  UNIQUE(user_id, gcal_event_id)
);

-- RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_user_settings"
  ON user_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_gcal_events"
  ON gcal_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- indexes
CREATE INDEX IF NOT EXISTS user_settings_user_id_idx     ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS user_settings_org_id_idx      ON user_settings(org_id);
CREATE INDEX IF NOT EXISTS gcal_events_user_id_idx       ON gcal_events(user_id);
CREATE INDEX IF NOT EXISTS gcal_events_start_time_idx    ON gcal_events(start_time);
CREATE INDEX IF NOT EXISTS gcal_events_org_id_idx        ON gcal_events(org_id);
CREATE INDEX IF NOT EXISTS gcal_events_source_idx        ON gcal_events(source_type, source_id);
