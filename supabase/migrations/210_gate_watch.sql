-- Migration 210: Gate Watch — AI that watches gate cameras and alerts when a
-- gate is left open (replaces the old dispatch / ggsoc gate-monitor).
--
--   gate_watches        one row per gate: camera, outline, type, time limit,
--                       hold-open hours, who to text — plus its live state.
--   gate_watch_refs     pictures of THIS gate open and closed (taught in setup
--                       or saved from "that was wrong" feedback). The AI compares
--                       every check against them — that's what handles odd angles.
--   gate_watch_checks   log of every check (method, verdict, confidence) for
--                       tuning and audit; pruned after 14 days by the job.
--
-- Server-only (service role). Run on beta, then prod.

CREATE TABLE IF NOT EXISTS public.gate_watches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  camera_key       text NOT NULL,                       -- 'een:<camera id>' | 'edge:<frigate camera name>'
  camera_name      text,
  label            text NOT NULL,                       -- "Main entrance", "Exit gate"
  gate_type        text NOT NULL DEFAULT 'swing' CHECK (gate_type IN ('swing','slide','barrier_arm','vertical_lift','other')),
  region           jsonb,                               -- [{x,y}, …] 0–1 fractions of the frame (the gate outline)
  threshold_sec    int  NOT NULL DEFAULT 300 CHECK (threshold_sec BETWEEN 60 AND 86400),
  enabled          boolean NOT NULL DEFAULT true,
  brivo_door_id    text,                                -- links manager "hold open" commands + the Open button in setup
  hold_open_hours  jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ "days":[1,2,3,4,5], "start":"09:00", "end":"18:00" }] — expected open, no alerts
  notify_phones    text[] NOT NULL DEFAULT '{}',
  notes            text,                                -- anything that helps the AI ("gate swings away from camera")
  created_by       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- live state
  state            text NOT NULL DEFAULT 'unknown' CHECK (state IN ('unknown','closed','open','left_open','blind')),
  state_since      timestamptz,
  open_since       timestamptz,
  pending_state    text,
  pending_count    int  NOT NULL DEFAULT 0,
  pending_since    timestamptz,
  unclear_count    int  NOT NULL DEFAULT 0,
  last_checked_at  timestamptz,
  last_verdict     text,
  last_confidence  int,
  last_method      text,
  last_reason      text,
  last_frame       text,                                -- small JPEG (base64) of the gate close-up from the last check
  next_check_at    timestamptz NOT NULL DEFAULT now(),
  incident_id      uuid REFERENCES public.incidents(id) ON DELETE SET NULL,
  alerted_at       timestamptz
);
-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.gate_watches TO postgres, anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_gate_watches_site ON public.gate_watches(site_id);
CREATE INDEX IF NOT EXISTS idx_gate_watches_due  ON public.gate_watches(next_check_at) WHERE enabled;

CREATE TABLE IF NOT EXISTS public.gate_watch_refs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_id     uuid NOT NULL REFERENCES public.gate_watches(id) ON DELETE CASCADE,
  state       text NOT NULL CHECK (state IN ('open','closed')),
  image       text NOT NULL,                            -- JPEG (base64) of the gate close-up
  sig         real[] NOT NULL,                          -- tiny grayscale fingerprint for the free quick check
  source      text NOT NULL DEFAULT 'setup' CHECK (source IN ('setup','feedback')),
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.gate_watch_refs TO postgres, anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_gate_watch_refs_gate ON public.gate_watch_refs(gate_id, state, created_at DESC);

CREATE TABLE IF NOT EXISTS public.gate_watch_checks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_id     uuid NOT NULL REFERENCES public.gate_watches(id) ON DELETE CASCADE,
  checked_at  timestamptz NOT NULL DEFAULT now(),
  method      text NOT NULL,                            -- quick | fast_ai | strong_ai
  verdict     text NOT NULL,                            -- open | closed | partial | unclear | error
  confidence  int,
  vehicle     boolean,
  reason      text,
  ms          int,
  state_after text
);
-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.gate_watch_checks TO postgres, anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS idx_gate_watch_checks_gate ON public.gate_watch_checks(gate_id, checked_at DESC);

-- Server-only: RLS on, service role only (the API checks who may see/edit).
ALTER TABLE public.gate_watches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_watch_refs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_watch_checks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY gate_watches_service ON public.gate_watches FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY gate_watch_refs_service ON public.gate_watch_refs FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY gate_watch_checks_service ON public.gate_watch_checks FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
