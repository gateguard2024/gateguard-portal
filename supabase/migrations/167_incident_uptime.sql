-- Migration 167: extend `incidents` into a full site uptime / fault ledger.
-- Manual-entry today; the SAME table + columns are what the AI anomaly watcher
-- and ggsoc.com will write to later (distinguished by `source`).
--
-- Uptime math is derived from started_at (went down) + resolved_at (came back):
--   downtime          = resolved_at - started_at   (or now() - started_at while open)
--   time since last   = now() - max(started_at) for the site
--   MTTR              = avg(resolved_at - started_at) over resolved incidents
--   uptime %          = 1 - (sum downtime in window / window length)
--
-- ALTER TABLE only — no GRANT block required (existing table permissions stand).

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS category      TEXT,                         -- network | camera | gate | access | door | intercom | relay | other
  ADD COLUMN IF NOT EXISTS cause         TEXT,                         -- structured reason code (see lib/incident-taxonomy.ts)
  ADD COLUMN IF NOT EXISTS source        TEXT DEFAULT 'manual',        -- manual | ai | ggsoc | monitor
  ADD COLUMN IF NOT EXISTS asset_id      UUID REFERENCES public.site_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_ref  TEXT,                         -- ggsoc.com / monitor incident id (future integration)
  ADD COLUMN IF NOT EXISTS started_at    TIMESTAMPTZ DEFAULT now();    -- when the system actually went down

-- Backfill: existing rows started when they were created.
UPDATE public.incidents SET started_at = created_at WHERE started_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_site      ON public.incidents(site_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status    ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_asset     ON public.incidents(asset_id);
CREATE INDEX IF NOT EXISTS idx_incidents_category  ON public.incidents(category);
