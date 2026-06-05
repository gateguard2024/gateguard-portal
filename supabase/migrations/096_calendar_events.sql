-- ============================================================
-- Migration 096 — Hosted Nexus Calendar Events
-- Purpose:
-- Nexus Calendar is the internal source of truth.
-- Google/Microsoft calendar syncs are optional mirrors.
-- Users can add and view events even when no external calendar is connected.
-- ============================================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership / visibility
  org_id                uuid REFERENCES organizations(id) ON DELETE SET NULL,
  user_id               text NOT NULL,                 -- Clerk user ID of event owner
  created_by            text,                          -- Clerk user ID that created the event

  -- Simple 5th-grader event fields
  title                 text NOT NULL,
  description           text,
  location              text,
  start_time            timestamptz NOT NULL,
  end_time              timestamptz NOT NULL,
  is_all_day            boolean DEFAULT false,
  status                text DEFAULT 'confirmed',      -- confirmed | tentative | cancelled

  -- Source and workflow context
  source                text DEFAULT 'nexus',          -- nexus | google | microsoft | import
  related_type          text,                          -- lead | opportunity | job | work_order | site | project | todo | manual
  related_id            uuid,

  -- External calendar mirror IDs. Nexus still owns the event.
  google_event_id       text,
  google_calendar_id    text,
  microsoft_event_id    text,
  microsoft_calendar_id text,

  -- Sync bookkeeping
  last_synced_at        timestamptz,
  sync_status           text DEFAULT 'not_synced',     -- not_synced | synced | sync_failed
  sync_error            text,

  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),

  CONSTRAINT calendar_events_end_after_start CHECK (end_time > start_time)
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_calendar_events"
  ON calendar_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS calendar_events_org_id_idx
  ON calendar_events(org_id);

CREATE INDEX IF NOT EXISTS calendar_events_user_id_idx
  ON calendar_events(user_id);

CREATE INDEX IF NOT EXISTS calendar_events_start_time_idx
  ON calendar_events(start_time);

CREATE INDEX IF NOT EXISTS calendar_events_related_idx
  ON calendar_events(related_type, related_id);

CREATE INDEX IF NOT EXISTS calendar_events_google_idx
  ON calendar_events(user_id, google_event_id);

CREATE INDEX IF NOT EXISTS calendar_events_microsoft_idx
  ON calendar_events(user_id, microsoft_event_id);
