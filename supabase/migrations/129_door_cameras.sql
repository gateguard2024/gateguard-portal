-- Migration 129: map a camera to a door, per site.
-- Lets the timeline show which camera watches a door when it's unlocked, so you
-- can pull the footage for that moment. Not secret data (no GRANT-sensitive
-- fields); standard grant.

CREATE TABLE IF NOT EXISTS public.door_cameras (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  door_id     TEXT NOT NULL,        -- Brivo access-point id
  door_name   TEXT,
  camera_id   TEXT,                 -- vendor camera id (optional)
  camera_name TEXT NOT NULL,
  stream_url  TEXT,                 -- live/playback link (optional)
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (site_id, door_id)
);

CREATE INDEX IF NOT EXISTS idx_door_cameras_site ON public.door_cameras (site_id);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.door_cameras TO postgres, anon, authenticated, service_role;
