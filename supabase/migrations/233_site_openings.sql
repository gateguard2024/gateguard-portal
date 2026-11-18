-- Migration 233: Openings — the gates / doors / entrances at a property.
-- An opening groups everything at one spot (Front vehicle gate, Pool gate,
-- Leasing door): installed devices, the Brivo door, cameras, Shelly relays and
-- Gate Watch. Jobs name the opening they were for, so a return trip is counted
-- on the SAME opening (not just the same property).

CREATE TABLE IF NOT EXISTS public.site_openings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  org_id          uuid,
  name            text NOT NULL,                 -- "Front vehicle gate"
  kind            text NOT NULL DEFAULT 'gate',  -- gate | pedestrian | door | elevator | garage | other
  brivo_door_ids  text[] NOT NULL DEFAULT '{}',
  camera_ids      text[] NOT NULL DEFAULT '{}',  -- Eagle Eye / Edge camera ids
  relay_ids       text[] NOT NULL DEFAULT '{}',  -- Shelly relay ids
  gate_watch_ids  uuid[] NOT NULL DEFAULT '{}',
  notes           text,
  sort            int NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true, -- false = removed (kept for job history)
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.site_openings TO postgres, anon, authenticated, service_role;

ALTER TABLE public.site_openings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_openings_service ON public.site_openings;
CREATE POLICY site_openings_service ON public.site_openings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS site_openings_site_idx ON public.site_openings (site_id, active, sort);

-- Installed devices belong to an opening.
ALTER TABLE public.site_assets ADD COLUMN IF NOT EXISTS opening_id uuid REFERENCES public.site_openings(id) ON DELETE SET NULL;

-- Which opening a job was for. opening_property = "Whole property / other".
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS opening_id uuid REFERENCES public.site_openings(id) ON DELETE SET NULL;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS opening_property boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS work_orders_opening_idx ON public.work_orders (opening_id, completed_at);
