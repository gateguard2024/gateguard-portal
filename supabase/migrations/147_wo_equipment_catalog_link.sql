-- Migration 147: link work-order equipment to the products catalog
-- ─────────────────────────────────────────────────────────────────────────────
-- Closes the products-unification loop into the field: equipment placed on a
-- work order references the same catalog product a drawing/quote used. The photo
-- is NOT copied here — it is read live from the products catalog via product_id,
-- so products stay the single source of truth (no duplicated image data).
--
-- ALTER only — no GRANT needed (existing table permissions are unchanged).

ALTER TABLE public.wo_installed_equipment ADD COLUMN IF NOT EXISTS product_id UUID;

CREATE INDEX IF NOT EXISTS idx_wo_installed_equipment_product_id
  ON public.wo_installed_equipment (product_id);

-- Force PostgREST to reload its schema cache immediately.
NOTIFY pgrst, 'reload schema';
