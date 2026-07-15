-- Migration 151: connect procurement to the work order (and to the catalog).
--
-- THE PROBLEM: three tables that should tell one story were three islands.
--
--   purchase_orders       -> org only. NO work_order_id — POs floated free of jobs.
--   purchase_order_items  -> inventory_items only. NO product_id (the catalog).
--   work_order_parts      -> work_orders + inventory_items. NO po_id, no location.
--
-- Net effect: a tech opening his job could NOT find out whether his parts were
-- ordered, shipped, or sitting at the office — the data had no path to say so.
-- Dispatch couldn't see it either. That's what this closes.
--
-- After this:
--   work order  ->  its POs             (purchase_orders.work_order_id)
--   PO line     ->  the catalog item    (purchase_order_items.product_id)
--   job part    ->  the PO buying it    (work_order_parts.po_id)
--   job part    ->  where it physically is (work_order_parts.supply_status)
--
-- NOTE: the live parts table is `work_order_parts` (migration 035). There is a
-- legacy `wo_parts_used` from migration 014 that the API does NOT use —
-- migration 135 documents that exact confusion ("wo_parts_used (different
-- table) — so added parts showed 'None yet'"). Do not add columns to it.
--
-- ALTER TABLE only — no new tables, no GRANT needed. Every column is NULLABLE
-- (or defaulted), so existing POs, parts and work orders keep working untouched.

-- 1) A PO can belong to a job. NULL = a general/stock PO, which stays valid.
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS purchase_orders_work_order_id_idx
  ON public.purchase_orders (work_order_id);

-- 2) A PO line points at the shared products catalog — the single source of
--    truth for name / sku / image / design_meta — not just loose text.
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS purchase_order_items_product_id_idx
  ON public.purchase_order_items (product_id);

-- 3) A part on a job knows which PO buys it, and where it physically is.
ALTER TABLE public.work_order_parts
  ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

ALTER TABLE public.work_order_parts
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- Where the part actually IS — the one thing a tech needs before driving out.
-- Deliberately plain values: these are shown to techs, not just stored.
-- NOTE: distinct from the existing `action` column ('used','installed',
-- 'returned','warranty'), which records what HAPPENED to a part. This records
-- where it is on the way there. Do not conflate them.
ALTER TABLE public.work_order_parts
  ADD COLUMN IF NOT EXISTS supply_status TEXT
    CHECK (supply_status IN (
      'not_ordered',   -- nobody has bought it yet
      'ordered',       -- on a PO, not shipped
      'shipped',       -- supplier shipped it
      'at_office',     -- received at the office / warehouse
      'on_truck',      -- tech has it
      'installed'      -- in the wall
    ))
    DEFAULT 'not_ordered';

ALTER TABLE public.work_order_parts
  ADD COLUMN IF NOT EXISTS expected_at DATE;

CREATE INDEX IF NOT EXISTS work_order_parts_po_id_idx         ON public.work_order_parts (po_id);
CREATE INDEX IF NOT EXISTS work_order_parts_supply_status_idx ON public.work_order_parts (supply_status);
CREATE INDEX IF NOT EXISTS work_order_parts_product_id_idx    ON public.work_order_parts (product_id);

-- ON DELETE SET NULL throughout is deliberate: deleting a PO must NEVER delete
-- a job's parts list, and deleting a catalog product must never delete a part a
-- tech actually installed. The history survives; only the link drops.

NOTIFY pgrst, 'reload schema';
