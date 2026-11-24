-- Migration 244: who is in which Brivo group, saved (Nov 24 2026).
-- Brivo's /users list leaves out each person's groups, so membership is one Brivo
-- call per group. A property with a group per unit = hundreds of calls; doing them on
-- every Residents load timed the page out (and queued gate opens behind them).
-- Now each load looks up a few groups and saves them here (refreshed every 6 h, and
-- at once when a person is added to / removed from a group in Nexus).

CREATE TABLE IF NOT EXISTS public.brivo_group_members (
  brivo_site_id text NOT NULL,
  group_id      text NOT NULL,
  user_ids      text[] NOT NULL DEFAULT '{}',
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brivo_site_id, group_id)
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.brivo_group_members TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_brivo_group_members_group ON public.brivo_group_members (group_id);

-- Service-role only (the app reads/writes with the service key).
ALTER TABLE public.brivo_group_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='brivo_group_members' AND policyname='brivo_group_members_service_role') THEN
    CREATE POLICY brivo_group_members_service_role ON public.brivo_group_members FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
