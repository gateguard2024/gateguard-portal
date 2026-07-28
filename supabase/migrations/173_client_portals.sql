-- Migration 173: customer-facing portals.
-- One row per property portal = its DATA (which site, address, modules, cameras,
-- branding, login type). The DESIGN is not here — every portal renders through a
-- single shared template component, so redesigning the template updates every site.
CREATE TABLE IF NOT EXISTS public.client_portals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,   -- dealer org that owns it (tenant key)
  site_id       UUID REFERENCES public.sites(id) ON DELETE SET NULL,                   -- the property
  slug          TEXT NOT NULL UNIQUE,                                                   -- portal.gateguard.co/<slug>
  login_type    TEXT NOT NULL DEFAULT 'property'  CHECK (login_type IN ('property', 'resident')),
  modules       TEXT[] NOT NULL DEFAULT ARRAY['gate','cameras','passes','activity','billing','service']::text[],
  camera_ids    TEXT[],                            -- NULL/empty = all cameras; otherwise only these
  branding      JSONB  NOT NULL DEFAULT '{}'::jsonb,  -- { display_name, logo_url, accent }
  status        TEXT NOT NULL DEFAULT 'draft'     CHECK (status IN ('draft', 'live', 'disabled')),
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.client_portals TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_client_portals_org  ON public.client_portals(org_id);
CREATE INDEX IF NOT EXISTS idx_client_portals_site ON public.client_portals(site_id) WHERE site_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portals_slug ON public.client_portals(lower(slug));
