-- Migration 161: product_costs — Gate Guard's true COGS per catalog product.
--
-- Deliberately SERVER-ONLY. The product page reads/writes `products` with the
-- browser's anon key, so any cost column on `products` would leak through
-- products.select('*'). Instead our COGS lives here, in a table the anon/
-- authenticated roles cannot touch at all. Only the corporate-gated
-- /api/admin/product-costs route (service_role key) reads or writes it.
--
-- dealer_cost stays on `products` (dealers may legitimately see their own cost);
-- the API derives dealer_cost = gg_cost + 10% and writes it there. gg_cost never
-- leaves the server.

CREATE TABLE IF NOT EXISTS public.product_costs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  gg_cost    numeric,                              -- Gate Guard COGS; null = not entered
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies on purpose → all client reads/writes are denied.
-- The server API uses the service_role key, which bypasses RLS.

-- Server-only grant. We intentionally do NOT grant anon or authenticated (unlike
-- the standard catalog tables), so our COGS can never reach a dealer's browser.
GRANT ALL ON TABLE public.product_costs TO postgres, service_role;
