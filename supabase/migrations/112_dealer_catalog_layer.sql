-- ════════════════════════════════════════════════════════════════════════════
-- Migration 112 — Dealer catalog layer
-- ════════════════════════════════════════════════════════════════════════════
-- The `products` table is the single source of truth (survey picker, KB, pricing,
-- /tech tool). This adds a per-dealer LAYER on top of it:
--   • products.org_id NULL  = global GateGuard catalog (everyone sees, corp edits)
--   • products.org_id SET    = private to that dealer's org (only they see)
--   • labor_rates            = dealer labor (+ global defaults) for pricing/repair $
-- Additive + idempotent. Safe to run anytime.
-- ════════════════════════════════════════════════════════════════════════════

-- 1 ── Per-dealer ownership on the catalog. NULL = global.
ALTER TABLE products ADD COLUMN IF NOT EXISTS org_id uuid;
CREATE INDEX IF NOT EXISTS products_org_id_idx ON products (org_id);

-- 2 ── Labor rates: dealer-defined (+ global defaults). org_id NULL = global default.
CREATE TABLE IF NOT EXISTS public.labor_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID,                              -- NULL = global default
  name        TEXT NOT NULL,                     -- e.g. "Standard Install Labor"
  rate        NUMERIC NOT NULL DEFAULT 0,        -- dollars
  unit        TEXT NOT NULL DEFAULT 'hour',      -- hour | flat | trip | visit | day
  notes       TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_by  TEXT,                              -- profiles.id of creator
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.labor_rates TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS labor_rates_org_id_idx ON public.labor_rates (org_id);

-- 3 ── A few global defaults so the pricing calc / survey have something to start from.
INSERT INTO public.labor_rates (org_id, name, rate, unit)
SELECT * FROM (VALUES
  (NULL::uuid, 'Standard Install Labor', 125, 'hour'),
  (NULL::uuid, 'Service Call',            95, 'trip'),
  (NULL::uuid, 'After-Hours / Emergency',185, 'hour')
) AS v(org_id, name, rate, unit)
WHERE NOT EXISTS (
  SELECT 1 FROM public.labor_rates l WHERE l.org_id IS NULL AND l.name = v.name
);
