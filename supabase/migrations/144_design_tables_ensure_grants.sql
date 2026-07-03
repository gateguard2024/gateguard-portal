-- Migration 144: ensure the Design tool's tables actually exist in the DB and are
-- exposed to the Data API. Migration 071 defined floor_plans/floor_plan_devices but
-- was never applied to this project, so PostgREST returns
-- "Could not find the table 'public.floor_plans' in the schema cache".
-- Idempotent: safe to run on beta and prod. Matches the 071 schema + adds GRANTs.

CREATE TABLE IF NOT EXISTS public.floor_plans (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid,
  site_id    uuid,
  name       text NOT NULL,
  level      text,
  file_url   text,
  file_type  text DEFAULT 'blank',
  status     text DEFAULT 'draft',
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.floor_plan_devices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id uuid REFERENCES public.floor_plans(id) ON DELETE CASCADE,
  product_id    uuid,
  device_type   text,
  label         text NOT NULL,
  icon_key      text,
  x_pct         numeric NOT NULL,
  y_pct         numeric NOT NULL,
  condition     text DEFAULT 'good',
  action        text DEFAULT 'keep',
  notes         text,
  photo_urls    text[],
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS floor_plan_devices_plan_idx ON public.floor_plan_devices (floor_plan_id);
CREATE INDEX IF NOT EXISTS floor_plans_site_idx ON public.floor_plans (site_id);

-- Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.floor_plans        TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.floor_plan_devices TO postgres, anon, authenticated, service_role;

-- Force PostgREST to reload its schema cache immediately.
NOTIFY pgrst, 'reload schema';
