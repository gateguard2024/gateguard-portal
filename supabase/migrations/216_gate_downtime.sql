-- Migration 216: Gate Watch up/down time log. One row per period a gate was DOWN (stuck open:
-- from the left-open alert, or a quiet ticketed left-open, until it reads closed) or BLIND
-- (Gate Watch couldn't see it — shown separately, never counted as down). Decided Nov 3 2026.
CREATE TABLE IF NOT EXISTS public.gate_downtime (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_id     uuid NOT NULL REFERENCES public.gate_watches(id) ON DELETE CASCADE,
  site_id     uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('down','blind')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  incident_id uuid,
  ticketed    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.gate_downtime TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_gate_downtime_gate ON public.gate_downtime (gate_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_gate_downtime_site ON public.gate_downtime (site_id, started_at DESC);
-- At most one open period per gate per kind.
CREATE UNIQUE INDEX IF NOT EXISTS gate_downtime_open_uniq ON public.gate_downtime (gate_id, kind) WHERE ended_at IS NULL;

ALTER TABLE public.gate_downtime ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gate_downtime_service ON public.gate_downtime;
CREATE POLICY gate_downtime_service ON public.gate_downtime TO service_role USING (true) WITH CHECK (true);
