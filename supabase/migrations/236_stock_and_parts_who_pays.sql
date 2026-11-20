-- Migration 236: Catalog phase 1 — "parts you can trust".
--
-- ADD-ON ONLY. Nothing is dropped, renamed or overwritten:
--   • 3 NEW tables (stock_locations, stock_moves, stock_minimums) + 1 NEW view (stock_levels)
--   • NEW nullable columns on work_order_parts and purchase_order_items
--   • a ONE-TIME COPY of today's inventory_items counts into the new stock tables
--     (inventory_items itself is left exactly as it is). Safe to run twice:
--     every insert checks "already there" first.
--
-- The model:
--   stock_locations  where parts sit: the warehouse, each truck, each property's spare shelf.
--                    org_id NULL = Gate Guard's own; otherwise the dealer's company.
--   stock_moves      every receive / transfer / use / return / count. On hand at a place
--                    = what moved in − what moved out (view stock_levels).
--   stock_minimums   low-stock line per company + product.
--   work_order_parts + from_location_id (where the part came from), bill_to (who pays:
--                    plan · property (billable) · warranty · internal), cost_basis
--                    (gg = Gate Guard cost, dealer = dealer cost, manual). unit_cost is
--                    frozen at the moment the part is used.
--   purchase_order_items + site_id: bought for this property's service plan.
--
-- Rules live in lib/stock.ts. Security: every table is RLS on, service-role only
-- (the API decides who sees what — dealers never see Gate Guard cost).

-- ── 1. Where parts sit ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_locations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid REFERENCES public.organizations(id) ON DELETE CASCADE,  -- NULL = Gate Guard
  kind           text NOT NULL CHECK (kind IN ('warehouse', 'truck', 'site')),
  name           text NOT NULL,
  technician_id  uuid REFERENCES public.technicians(id) ON DELETE SET NULL,    -- trucks
  site_id        uuid REFERENCES public.sites(id) ON DELETE CASCADE,          -- property spare shelf
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.stock_locations TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS stock_locations_org_idx  ON public.stock_locations (org_id);
CREATE INDEX IF NOT EXISTS stock_locations_site_idx ON public.stock_locations (site_id) WHERE site_id IS NOT NULL;
-- One spare shelf per company per property, one truck per tech.
CREATE UNIQUE INDEX IF NOT EXISTS stock_locations_site_uniq
  ON public.stock_locations (COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid), site_id) WHERE kind = 'site';
CREATE UNIQUE INDEX IF NOT EXISTS stock_locations_truck_uniq
  ON public.stock_locations (technician_id) WHERE kind = 'truck' AND technician_id IS NOT NULL;

-- ── 2. Every movement ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_moves (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid REFERENCES public.organizations(id) ON DELETE CASCADE,  -- owner (NULL = Gate Guard)
  product_id          uuid REFERENCES public.products(id) ON DELETE SET NULL,
  kind                text NOT NULL CHECK (kind IN ('opening', 'receive', 'transfer', 'use', 'return', 'count')),
  qty                 integer NOT NULL CHECK (qty > 0),
  from_location_id    uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  to_location_id      uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  unit_cost           numeric(10,2),
  work_order_id       uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  work_order_part_id  uuid REFERENCES public.work_order_parts(id) ON DELETE SET NULL,
  po_id               uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  po_item_id          uuid REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
  legacy_item_id      uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  note                text,
  created_by          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (from_location_id IS NOT NULL OR to_location_id IS NOT NULL)
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.stock_moves TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS stock_moves_product_idx ON public.stock_moves (product_id);
CREATE INDEX IF NOT EXISTS stock_moves_from_idx    ON public.stock_moves (from_location_id) WHERE from_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_moves_to_idx      ON public.stock_moves (to_location_id) WHERE to_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_moves_wo_idx      ON public.stock_moves (work_order_id) WHERE work_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_moves_part_idx    ON public.stock_moves (work_order_part_id) WHERE work_order_part_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_moves_org_idx     ON public.stock_moves (org_id, created_at DESC);
-- The one-time copy can't land twice in the same place.
CREATE UNIQUE INDEX IF NOT EXISTS stock_moves_legacy_uniq
  ON public.stock_moves (legacy_item_id, to_location_id) WHERE kind = 'opening' AND legacy_item_id IS NOT NULL;

-- ── 3. Low-stock lines ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_minimums (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  min_qty     integer NOT NULL DEFAULT 0 CHECK (min_qty >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.stock_minimums TO postgres, anon, authenticated, service_role;

CREATE UNIQUE INDEX IF NOT EXISTS stock_minimums_uniq
  ON public.stock_minimums (COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid), product_id);

-- ── 4. On hand per place (in − out) ─────────────────────────────────────────
CREATE OR REPLACE VIEW public.stock_levels AS
SELECT l.org_id, m.location_id, m.product_id, SUM(m.delta)::integer AS qty
FROM (
  SELECT to_location_id   AS location_id, product_id,  qty AS delta FROM public.stock_moves WHERE to_location_id   IS NOT NULL AND product_id IS NOT NULL
  UNION ALL
  SELECT from_location_id AS location_id, product_id, -qty AS delta FROM public.stock_moves WHERE from_location_id IS NOT NULL AND product_id IS NOT NULL
) m
JOIN public.stock_locations l ON l.id = m.location_id
GROUP BY l.org_id, m.location_id, m.product_id;

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.stock_levels TO postgres, anon, authenticated, service_role;

-- ── 5. Security: service role only (the API scopes by company) ──────────────
ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_moves     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_minimums  ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY stock_locations_service ON public.stock_locations TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY stock_moves_service     ON public.stock_moves     TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY stock_minimums_service  ON public.stock_minimums  TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- The view runs as the caller, so anon/authenticated see nothing through it.
ALTER VIEW public.stock_levels SET (security_invoker = true);

-- ── 6. New columns (all nullable — existing rows keep working) ──────────────
ALTER TABLE public.work_order_parts
  ADD COLUMN IF NOT EXISTS from_location_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL;
ALTER TABLE public.work_order_parts
  ADD COLUMN IF NOT EXISTS bill_to text CHECK (bill_to IN ('plan', 'property', 'warranty', 'internal'));
ALTER TABLE public.work_order_parts
  ADD COLUMN IF NOT EXISTS cost_basis text CHECK (cost_basis IN ('gg', 'dealer', 'manual'));
CREATE INDEX IF NOT EXISTS work_order_parts_bill_to_idx ON public.work_order_parts (bill_to) WHERE bill_to IS NOT NULL;

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS purchase_order_items_site_idx ON public.purchase_order_items (site_id) WHERE site_id IS NOT NULL;

-- ── 7. One-time copy of today's counts (inventory_items is NOT changed) ─────
-- Only items tied to a catalog product (directly, or by an exact SKU match the
-- company can see) are copied. Anything else stays listed under Catalog → Stock →
-- "Old stock not linked to a product" for someone to link by hand.
DO $$
DECLARE r record; wh uuid; tr uuid; pid uuid;
BEGIN
  FOR r IN SELECT * FROM public.inventory_items WHERE is_active IS NOT FALSE LOOP
    pid := r.product_id;
    IF pid IS NULL AND COALESCE(r.sku, '') <> '' THEN
      SELECT p.id INTO pid FROM public.products p
       WHERE upper(p.sku) = upper(r.sku) AND (p.org_id IS NULL OR p.org_id IS NOT DISTINCT FROM r.org_id)
       ORDER BY (p.org_id IS NULL) LIMIT 1;
    END IF;
    CONTINUE WHEN pid IS NULL;

    -- company warehouse
    SELECT id INTO wh FROM public.stock_locations
     WHERE kind = 'warehouse' AND org_id IS NOT DISTINCT FROM r.org_id ORDER BY created_at LIMIT 1;
    IF wh IS NULL THEN
      INSERT INTO public.stock_locations (org_id, kind, name) VALUES (r.org_id, 'warehouse', 'Warehouse') RETURNING id INTO wh;
    END IF;
    IF COALESCE(r.on_hand, 0) > 0 THEN
      INSERT INTO public.stock_moves (org_id, product_id, kind, qty, to_location_id, unit_cost, legacy_item_id, note, created_by)
      VALUES (r.org_id, pid, 'opening', r.on_hand, wh, r.unit_cost, r.id, 'Copied from the old inventory list', 'migration 236')
      ON CONFLICT DO NOTHING;
    END IF;

    -- the old single "on truck" number → one shared truck until it's split per tech
    IF COALESCE(r.on_truck, 0) > 0 THEN
      SELECT id INTO tr FROM public.stock_locations
       WHERE kind = 'truck' AND technician_id IS NULL AND name = 'Trucks (old count)' AND org_id IS NOT DISTINCT FROM r.org_id LIMIT 1;
      IF tr IS NULL THEN
        INSERT INTO public.stock_locations (org_id, kind, name) VALUES (r.org_id, 'truck', 'Trucks (old count)') RETURNING id INTO tr;
      END IF;
      INSERT INTO public.stock_moves (org_id, product_id, kind, qty, to_location_id, unit_cost, legacy_item_id, note, created_by)
      VALUES (r.org_id, pid, 'opening', r.on_truck, tr, r.unit_cost, r.id, 'Copied from the old inventory list (on trucks)', 'migration 236')
      ON CONFLICT DO NOTHING;
    END IF;

    IF COALESCE(r.min_stock, 0) > 0 THEN
      INSERT INTO public.stock_minimums (org_id, product_id, min_qty) VALUES (r.org_id, pid, r.min_stock)
      ON CONFLICT DO NOTHING;
    END IF;
    wh := NULL; tr := NULL;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
