-- ============================================================
-- GateGuard OS — Migration 035: Inventory + Quote Enhancements
--
-- Part 1: Add missing columns to quotes table
-- Part 2: inventory_items — warehouse + van stock
-- Part 3: work_order_parts — parts consumed on a job
-- Part 4: purchase_orders + purchase_order_items
-- ============================================================


-- ============================================================
-- PART 1 — Quotes table enhancements
-- ============================================================

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS site_id          uuid REFERENCES sites(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at          timestamptz,
  ADD COLUMN IF NOT EXISTS dealer_mrr       numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_order_id    uuid REFERENCES work_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS property_name    text,   -- denormalized for display
  ADD COLUMN IF NOT EXISTS units            int;

-- Also add declined_at (distinct from existing statuses)
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS declined_at      timestamptz;

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_quotes_org        ON quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client_org ON quotes(client_org_id) WHERE client_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_site        ON quotes(site_id)       WHERE site_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_status      ON quotes(status);

-- RLS
ALTER TABLE quotes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_all_quotes"
    ON quotes USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_quote_line_items"
    ON quote_line_items USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- PART 2 — inventory_items
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES organizations(id) ON DELETE SET NULL,

  name            text NOT NULL,
  sku             text,
  category        text NOT NULL DEFAULT 'Other',
  description     text,

  -- Pricing
  unit_cost       numeric(10,2) DEFAULT 0,   -- what we pay
  unit_price      numeric(10,2) DEFAULT 0,   -- what we charge

  -- Stock levels
  on_hand         integer NOT NULL DEFAULT 0,  -- warehouse
  on_truck        integer NOT NULL DEFAULT 0,  -- in field vans
  min_stock       integer NOT NULL DEFAULT 0,  -- reorder threshold
  reorder_qty     integer NOT NULL DEFAULT 1,  -- how many to order

  -- Location / supplier
  location        text,                          -- shelf / bin
  supplier        text,
  supplier_sku    text,

  -- Link to product catalog
  product_id      uuid REFERENCES products(id) ON DELETE SET NULL,

  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_org      ON inventory_items(org_id)     WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_sku      ON inventory_items(sku)        WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_product  ON inventory_items(product_id) WHERE product_id IS NOT NULL;

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_all_inventory"
    ON inventory_items USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- PART 3 — work_order_parts
-- Parts consumed / installed during a work order
-- ============================================================

CREATE TABLE IF NOT EXISTS work_order_parts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id       uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  inventory_item_id   uuid REFERENCES inventory_items(id) ON DELETE SET NULL,

  name                text NOT NULL,
  sku                 text,
  qty                 integer NOT NULL DEFAULT 1,
  unit_cost           numeric(10,2) DEFAULT 0,

  -- What happened to this part
  action              text NOT NULL DEFAULT 'used'
                      CHECK (action IN ('used', 'installed', 'returned', 'warranty')),

  -- If installed as a site asset, link here
  site_asset_id       uuid REFERENCES site_assets(id) ON DELETE SET NULL,

  notes               text,
  added_by            text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_parts_wo   ON work_order_parts(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_parts_item ON work_order_parts(inventory_item_id) WHERE inventory_item_id IS NOT NULL;

ALTER TABLE work_order_parts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_all_wo_parts"
    ON work_order_parts USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- PART 4 — purchase_orders + purchase_order_items
-- ============================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES organizations(id) ON DELETE SET NULL,
  po_number       text,
  supplier        text,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','confirmed','partial','received','cancelled')),
  notes           text,
  subtotal        numeric(10,2) DEFAULT 0,
  tax             numeric(10,2) DEFAULT 0,
  total           numeric(10,2) DEFAULT 0,
  ordered_at      timestamptz,
  expected_at     date,
  received_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id               uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id   uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
  name                text NOT NULL,
  sku                 text,
  qty                 integer NOT NULL DEFAULT 1,
  unit_cost           numeric(10,2) DEFAULT 0,
  received_qty        integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_org  ON purchase_orders(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_poi_po  ON purchase_order_items(po_id);

ALTER TABLE purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_all_purchase_orders"
    ON purchase_orders USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_all_purchase_order_items"
    ON purchase_order_items USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
