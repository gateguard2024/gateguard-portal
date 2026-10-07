-- Migration 191: portal_managers — per-manager personal sign-in for the customer
-- ops portal. The shared client_portals.access_pin stays view-only; control actions
-- (gate open, hold-open, force-close, lockdown, arming) require a manager's personal
-- PIN so every command in site_events names a real person.

CREATE TABLE IF NOT EXISTS public.portal_managers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_portal_id uuid NOT NULL REFERENCES public.client_portals(id) ON DELETE CASCADE,
  org_id           uuid,
  site_id          uuid,
  name             text NOT NULL,
  email            text,
  pin_hash         text NOT NULL,          -- sha256("gg-portal-mgr:" || pin)
  active           boolean NOT NULL DEFAULT true,
  created_by       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_managers_portal ON public.portal_managers(client_portal_id);
CREATE INDEX IF NOT EXISTS idx_portal_managers_site ON public.portal_managers(site_id) WHERE site_id IS NOT NULL;

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.portal_managers TO postgres, anon, authenticated, service_role;

-- Service-role-only (the portal app touches this via the service key, like client_portals).
ALTER TABLE public.portal_managers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='portal_managers' AND policyname='portal_managers_service_role') THEN
    CREATE POLICY portal_managers_service_role ON public.portal_managers FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
