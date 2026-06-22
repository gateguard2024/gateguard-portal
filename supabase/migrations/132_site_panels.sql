-- Migration 132: hardware registry — control panels + their doors per site.
-- The hybrid: corporate enters serials + programs Brivo; the registry stores the
-- serial → door-name mapping so a replacement is a fast serial swap (mapping
-- preserved), and the dealer/field tech never touches Brivo.
-- Not secret (serials/door names) → standard grant.

CREATE TABLE IF NOT EXISTS public.site_panels (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  model          TEXT,                       -- e.g. "2-door controller"
  serial         TEXT,                       -- programmed serial (live)
  pending_serial TEXT,                       -- new serial a tech scanned, awaiting corporate swap
  door_count     INT,
  doors          JSONB NOT NULL DEFAULT '[]',-- [{ name, brivo_door_id? }]
  status         TEXT NOT NULL DEFAULT 'requested', -- requested | programmed | live | replace_pending
  source         TEXT NOT NULL DEFAULT 'manual',    -- manual | kickoff (auto-created when an opportunity is won)
  dealer_confirmed    BOOLEAN NOT NULL DEFAULT false, -- dealer reviewed + confirmed the door list
  dealer_confirmed_at TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- Idempotent adds (safe if the table already existed from an earlier run)
ALTER TABLE public.site_panels ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.site_panels ADD COLUMN IF NOT EXISTS dealer_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.site_panels ADD COLUMN IF NOT EXISTS dealer_confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_site_panels_site ON public.site_panels (site_id);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.site_panels TO postgres, anon, authenticated, service_role;
