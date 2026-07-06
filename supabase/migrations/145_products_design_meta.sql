-- Migration 145: products.design_meta
-- ─────────────────────────────────────────────────────────────────────────────
-- Make `products` the single source of truth for the design tool too. Each
-- product can carry its design detail so drawings, quotes and invoices all pull
-- from the same catalog record.
--
-- design_meta shape (all optional):
--   {
--     "role": "camera" | "board" | "gateway" | "reader" | "switch" | "power" | ...,
--     "abbr": "SDC",                         -- short badge if no image
--     "color": "#10B981",                    -- marker/accent color
--     "isBoard": true,                       -- shows a terminal strip
--     "wiringImageUrl": "https://…",         -- the TERMINAL/wiring image (detail view)
--     "terminals": [ { "name": "LOCK+", "dx": -30, "dy": 12 }, ... ],
--     "defaultCable": "18/6"
--   }
--
-- Two images per product: the GENERAL product photo lives in the existing
-- products.image_url (used for the overview marker); the WIRING/terminal image
-- lives in design_meta.wiringImageUrl (used for the terminal detail view).
-- ALTER only — no GRANT needed (existing table permissions are unchanged).

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS design_meta jsonb;

-- Force PostgREST to reload its schema cache immediately.
NOTIFY pgrst, 'reload schema';
