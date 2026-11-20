-- Migration 237: Catalog phase 2 — one record per installed unit (site_assets).
--
-- ADD-ON ONLY. Nothing is dropped, renamed or deleted:
--   • NEW nullable columns on site_assets (parent unit, replaced-by, QR code, the job
--     part that installed it), on wo_installed_equipment (the unit it became) and on
--     wo_requests (the unit a request is about)
--   • every unit gets a QR code
--   • a ONE-TIME copy of CONFIRMED job equipment (wo_installed_equipment) into
--     site_assets, so equipment confirmed on jobs finally shows at the property.
--     A row is linked (not copied) when the property already has that unit — same
--     serial, or same job + same name. Safe to run twice: linked rows are skipped.
-- Rules live in lib/assets.ts.

-- ── 1. New columns ──────────────────────────────────────────────────────────
ALTER TABLE public.site_assets ADD COLUMN IF NOT EXISTS parent_asset_id      uuid REFERENCES public.site_assets(id) ON DELETE SET NULL;
ALTER TABLE public.site_assets ADD COLUMN IF NOT EXISTS replaced_by_asset_id uuid REFERENCES public.site_assets(id) ON DELETE SET NULL;
ALTER TABLE public.site_assets ADD COLUMN IF NOT EXISTS installed_part_id    uuid REFERENCES public.work_order_parts(id) ON DELETE SET NULL;
ALTER TABLE public.site_assets ADD COLUMN IF NOT EXISTS qr_code              text;
-- (075 / 213 / 233 added these; repeated here so 237 never depends on them having run)
ALTER TABLE public.site_assets ADD COLUMN IF NOT EXISTS warranty_expires_at  date;
ALTER TABLE public.site_assets ADD COLUMN IF NOT EXISTS removed_at           timestamptz;
ALTER TABLE public.site_assets ADD COLUMN IF NOT EXISTS removal_wo_id        uuid;

ALTER TABLE public.wo_installed_equipment ADD COLUMN IF NOT EXISTS site_asset_id uuid REFERENCES public.site_assets(id) ON DELETE SET NULL;
ALTER TABLE public.wo_installed_equipment ADD COLUMN IF NOT EXISTS product_id    uuid;  -- (147)
ALTER TABLE public.wo_requests            ADD COLUMN IF NOT EXISTS asset_id      uuid REFERENCES public.site_assets(id) ON DELETE SET NULL;

-- ── 2. A QR code for every unit (10 letters/digits, no look-alikes) ─────────
CREATE OR REPLACE FUNCTION public.gg_unit_code() RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  FROM generate_series(1, 10)
$$;
UPDATE public.site_assets SET qr_code = public.gg_unit_code() WHERE qr_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS site_assets_qr_code_uniq ON public.site_assets (qr_code) WHERE qr_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS site_assets_parent_idx ON public.site_assets (parent_asset_id) WHERE parent_asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS site_assets_part_idx   ON public.site_assets (installed_part_id) WHERE installed_part_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wo_requests_asset_idx  ON public.wo_requests (asset_id) WHERE asset_id IS NOT NULL;

-- ── 3. One-time copy of confirmed job equipment ─────────────────────────────
DO $$
DECLARE e record; aid uuid; n int; i int;
BEGIN
  FOR e IN
    SELECT q.*, w.site_id AS wo_site, w.org_id AS wo_org, w.opening_id AS wo_opening, w.completed_at AS wo_done
      FROM public.wo_installed_equipment q
      JOIN public.work_orders w ON w.id = q.work_order_id
     WHERE q.confirmed IS TRUE AND q.site_asset_id IS NULL AND w.site_id IS NOT NULL
  LOOP
    aid := NULL;
    -- already at the property? same serial …
    IF COALESCE(trim(e.serial_number), '') <> '' THEN
      SELECT id INTO aid FROM public.site_assets
       WHERE site_id = e.wo_site AND lower(trim(serial_number)) = lower(trim(e.serial_number)) LIMIT 1;
    END IF;
    -- … or same job + same name
    IF aid IS NULL THEN
      SELECT id INTO aid FROM public.site_assets
       WHERE site_id = e.wo_site AND work_order_id = e.work_order_id AND lower(product_name) = lower(e.name) LIMIT 1;
    END IF;

    IF aid IS NULL THEN
      n := LEAST(GREATEST(COALESCE(e.qty, 1), 1), 20);
      FOR i IN 1..n LOOP
        INSERT INTO public.site_assets (site_id, org_id, product_id, product_name, product_sku, serial_number,
                                        location_note, opening_id, work_order_id, installed_by, installed_at,
                                        install_notes, status, qr_code)
        VALUES (e.wo_site, e.wo_org, e.product_id,
                COALESCE(NULLIF(trim(concat_ws(' ', NULLIF(e.make, ''), NULLIF(e.model, ''))), ''), e.name),
                e.sku, CASE WHEN i = 1 THEN NULLIF(trim(e.serial_number), '') END,
                COALESCE(NULLIF(e.location, ''), 'Main Gate'), e.wo_opening, e.work_order_id, e.confirmed_by,
                COALESCE(e.confirmed_at, e.wo_done, e.created_at), 'From the job’s equipment list (migration 237)', 'active',
                public.gg_unit_code())
        RETURNING id INTO aid;
      END LOOP;
    END IF;
    UPDATE public.wo_installed_equipment SET site_asset_id = aid WHERE id = e.id;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
