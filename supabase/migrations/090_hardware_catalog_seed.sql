-- ============================================================
-- 090_products_schema.sql
-- Schema additions for the products table.
-- Products are managed via /products UI — never seeded via SQL.
-- ============================================================

-- Ensure field_service column exists (safe if already present)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS field_service boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS list_price   numeric(10,2) NOT NULL DEFAULT 0;
