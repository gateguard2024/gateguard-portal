-- Migration 128: per-site, per-vendor integration credentials vault.
-- Each property site has its OWN credentials for Brivo, Eagle Eye, Shelly, and
-- UniFi. Secrets are AES-256-GCM encrypted in credentials_enc (app-layer, one
-- master key) — never stored or returned in plaintext.

CREATE TABLE IF NOT EXISTS public.site_integrations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  vendor           TEXT NOT NULL,            -- brivo | eagle_eye | shelly | unifi
  credentials_enc  TEXT,                     -- AES-256-GCM blob (v1:iv:tag:ct)
  status           TEXT DEFAULT 'configured',-- configured | verified | error
  last_verified_at TIMESTAMPTZ,
  last_error       TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (site_id, vendor)
);

CREATE INDEX IF NOT EXISTS idx_site_integrations_site ON public.site_integrations (site_id);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.site_integrations TO postgres, anon, authenticated, service_role;
