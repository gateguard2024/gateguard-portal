-- Migration 202: Catalog pro fields (D-Tools / MaintainX style).
--   labor_hours      install labor per unit (hours) — quotes can price labor from it
--   unit             what one "qty" means: each | ft | box | roll | hour | set
--   warranty_months  manufacturer warranty
--   accessories      items that go with this one (kit):
--                    [{ "product_id": uuid, "qty": number, "required": boolean }]
-- ALTER TABLE only — no new tables, no GRANT needed. All nullable / defaulted.
-- Run on beta first, then prod.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS labor_hours     numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit            text NOT NULL DEFAULT 'each';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS warranty_months integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS accessories     jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Speeds up "which kits include this product?" on the product page.
CREATE INDEX IF NOT EXISTS products_accessories_gin ON public.products USING gin (accessories jsonb_path_ops);
