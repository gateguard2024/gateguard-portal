-- ============================================================
-- Migration 146 — calendar_events Data API grants + schema-cache reload
--
-- Fixes the runtime error:
--   "Could not find the table 'public.calendar_events' in the schema cache."
--
-- Root cause: migrations 096 and 121 created public.calendar_events but never
-- issued a GRANT to the PostgREST roles, so the Data API could not see the
-- table (and PostgREST never reloaded its schema cache after creation).
--
-- This migration is fully idempotent:
--   * ensures the table exists (matching the migration 121 column set),
--   * grants Data API access to all PostgREST roles,
--   * forces PostgREST to reload its schema cache.
-- If the table already exists this only re-applies grants + reloads the cache.
-- ============================================================

-- 1. Ensure the table exists (no-op if migration 096/121 already created it)
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid REFERENCES organizations(id) ON DELETE SET NULL,
  user_id               text,
  created_by            text,
  title                 text NOT NULL,
  description           text,
  location              text,
  start_time            timestamptz NOT NULL,
  end_time              timestamptz NOT NULL,
  is_all_day            boolean NOT NULL DEFAULT false,
  status                text NOT NULL DEFAULT 'confirmed',
  source                text NOT NULL DEFAULT 'nexus',
  related_type          text,
  related_id            text,
  sync_status           text NOT NULL DEFAULT 'not_synced',
  external_calendar_id  text,
  external_event_id     text,
  metadata              jsonb NOT NULL DEFAULT '{}',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- 2. Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.calendar_events TO postgres, anon, authenticated, service_role;

-- 3. Force PostgREST to reload its schema cache so the table becomes visible
NOTIFY pgrst, 'reload schema';
