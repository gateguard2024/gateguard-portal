-- ============================================================
-- 003_products.sql
-- Product Catalog table for GateGuard OS Portal
-- ============================================================

CREATE TABLE IF NOT EXISTS public.products (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku          text NOT NULL UNIQUE,
  name         text NOT NULL,
  brand        text NOT NULL DEFAULT '',
  category     text NOT NULL DEFAULT '',
  subcategory  text NOT NULL DEFAULT '',
  description  text NOT NULL DEFAULT '',
  specs        text NOT NULL DEFAULT '',
  msrp         numeric(10,2) NOT NULL DEFAULT 0,
  dealer_cost  numeric(10,2) NOT NULL DEFAULT 0,
  sell_price   numeric(10,2) NOT NULL DEFAULT 0,
  adi_sku      text NOT NULL DEFAULT '',
  image_url    text NOT NULL DEFAULT '',
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category);
CREATE INDEX IF NOT EXISTS products_brand_idx    ON public.products (brand);
CREATE INDEX IF NOT EXISTS products_active_idx   ON public.products (active);
CREATE INDEX IF NOT EXISTS products_sku_idx      ON public.products (sku);

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Authenticated users (dealers/admins) can read all active products
CREATE POLICY "Authenticated users can read products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

-- Only authenticated users can insert/update/delete
CREATE POLICY "Authenticated users can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (true);

-- Allow anon read for public-facing product pages (quote tool, etc.)
CREATE POLICY "Public can read active products"
  ON public.products FOR SELECT
  TO anon
  USING (active = true);
