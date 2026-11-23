-- Migration 241: Brivo door-event history (30 days, synced hourly).
-- Brivo only answers 2 days of events per request, so every screen used to ask
-- Brivo live, a few days at most. Now an hourly job (inngest brivo-events-sync,
-- lib/brivo-events-store.ts) copies each property's new events here and deletes
-- anything older than 30 days. Screens read this table + a live top-up since the
-- last sync. (240 is taken by lead sequences.)

CREATE TABLE IF NOT EXISTS public.brivo_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  brivo_event_id text NOT NULL,              -- Brivo's id (or a stable key built from the event)
  occurred_at    timestamptz NOT NULL,
  action         text,
  actor          text,
  door           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brivo_events_site_event_uniq UNIQUE (site_id, brivo_event_id)
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.brivo_events TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_brivo_events_site_time ON public.brivo_events (site_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_brivo_events_time ON public.brivo_events (occurred_at);

-- One row per property: how far the sync has got.
CREATE TABLE IF NOT EXISTS public.brivo_event_sync (
  site_id         uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
  synced_through  timestamptz,               -- events up to here are stored
  last_run_at     timestamptz,
  last_count      integer NOT NULL DEFAULT 0,
  last_error      text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.brivo_event_sync TO postgres, anon, authenticated, service_role;

-- Service-role only (the app reads/writes with the service key).
ALTER TABLE public.brivo_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brivo_event_sync ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='brivo_events' AND policyname='brivo_events_service_role') THEN
    CREATE POLICY brivo_events_service_role ON public.brivo_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='brivo_event_sync' AND policyname='brivo_event_sync_service_role') THEN
    CREATE POLICY brivo_event_sync_service_role ON public.brivo_event_sync FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
