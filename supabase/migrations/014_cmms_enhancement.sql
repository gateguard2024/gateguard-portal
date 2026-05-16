-- ============================================================
-- GateGuard OS — Migration 014: CMMS Enhancement
--
-- Adds sub-work orders, checklist items, comments, and parts
-- inventory to support a full MaintainX-replacement CMMS.
--
-- Safe to re-run — all operations use IF NOT EXISTS / DROP IF EXISTS.
-- ============================================================

-- ── 1. Extend work_orders with CMMS fields ─────────────────────────

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS parent_wo_id    UUID REFERENCES work_orders(id) ON DELETE CASCADE;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS category        TEXT DEFAULT 'Repair'; -- Preventive | Damage | Electrical | Mechanical | Plumbing | Safety | General
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(5,2);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS location        TEXT; -- specific room/area on property

-- ── 2. Checklist items (sub-tasks on a work order) ─────────────────

CREATE TABLE IF NOT EXISTS wo_checklist_items (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id  UUID        NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  completed      BOOLEAN     NOT NULL DEFAULT false,
  completed_at   TIMESTAMPTZ,
  completed_by   TEXT,
  sort_order     INTEGER     DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_checklist_wo_id ON wo_checklist_items(work_order_id);

-- ── 3. Comments / activity log on work orders ──────────────────────

CREATE TABLE IF NOT EXISTS wo_comments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id  UUID        NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  author_name    TEXT        NOT NULL DEFAULT 'Russel Feldman',
  author_initials TEXT       NOT NULL DEFAULT 'RF',
  content        TEXT        NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_comments_wo_id ON wo_comments(work_order_id);

-- ── 4. Parts inventory ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS parts_inventory (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  part_number       TEXT,
  name              TEXT        NOT NULL,
  description       TEXT,
  quantity_on_hand  INTEGER     NOT NULL DEFAULT 0,
  min_stock_level   INTEGER     DEFAULT 0,
  unit_cost         NUMERIC(10,2),
  part_type         TEXT        DEFAULT 'Standard', -- Critical | Standard
  location          TEXT,        -- warehouse shelf / van stock
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ── 5. Parts used on work orders ──────────────────────────────────

CREATE TABLE IF NOT EXISTS wo_parts_used (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id  UUID        NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  part_id        UUID        REFERENCES parts_inventory(id) ON DELETE SET NULL,
  part_name      TEXT        NOT NULL,
  part_number    TEXT,
  quantity       INTEGER     NOT NULL DEFAULT 1,
  unit_cost      NUMERIC(10,2),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_parts_wo_id ON wo_parts_used(work_order_id);

-- ── 6. Row-Level Security ──────────────────────────────────────────

ALTER TABLE wo_checklist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass_checklist" ON wo_checklist_items;
CREATE POLICY "service_role_bypass_checklist"
  ON wo_checklist_items TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE wo_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass_wo_comments" ON wo_comments;
CREATE POLICY "service_role_bypass_wo_comments"
  ON wo_comments TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE parts_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass_parts_inventory" ON parts_inventory;
CREATE POLICY "service_role_bypass_parts_inventory"
  ON parts_inventory TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE wo_parts_used ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass_wo_parts_used" ON wo_parts_used;
CREATE POLICY "service_role_bypass_wo_parts_used"
  ON wo_parts_used TO service_role
  USING (true) WITH CHECK (true);

-- ── 7. Seed sample checklist items on existing WOs ────────────────

-- Add checklist items to first two work orders for demo purposes
INSERT INTO wo_checklist_items (work_order_id, title, sort_order)
SELECT id, 'Verify power supply at control board', 0
FROM work_orders ORDER BY created_at LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO wo_checklist_items (work_order_id, title, sort_order)
SELECT id, 'Test gate loop detection (drive-through test)', 1
FROM work_orders ORDER BY created_at LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO wo_checklist_items (work_order_id, title, sort_order)
SELECT id, 'Confirm Brivo credential sync', 2
FROM work_orders ORDER BY created_at LIMIT 1
ON CONFLICT DO NOTHING;

-- ── 8. Seed sample parts inventory ────────────────────────────────

INSERT INTO parts_inventory (part_number, name, description, quantity_on_hand, min_stock_level, unit_cost, part_type, location)
VALUES
  ('DK-6001',  'DoorKing 6001 Control Board',      '12V gate control board for DK 6000 series', 3,  1,  245.00, 'Critical',  'Shelf A1'),
  ('CAT6-100', 'CAT6 Cable — 100ft',               'Plenum-rated CAT6 ethernet cable',          12, 4,   18.50, 'Standard', 'Shelf B2'),
  ('BRK-12V',  '12V Power Supply — 2A',            'Universal 12VDC 2A power adapter',          8,  2,   14.00, 'Standard', 'Shelf B1'),
  ('MAG-600',  'Mag Lock 600lb',                   '600lb holding force magnetic lock',          4,  1,  120.00, 'Standard', 'Shelf C3'),
  ('PB-DUAL',  'DK 9409 Dual Loop Detector',       'Dual inductive loop detector board',         2,  1,  195.00, 'Critical',  'Shelf A2'),
  ('WAGO-5',   'WAGO 5-port Lever Connector',      '5-port lever-nut connector, 24-12AWG',      50, 20,   0.75, 'Standard', 'Bin D1'),
  ('SHRINK-4', 'Heat Shrink Tubing — 4mm',         'Assorted heat shrink tubing roll',           6,  2,    3.50, 'Standard', 'Bin D2'),
  ('UNV-UCG',  'Ubiquiti UCG-Ultra',               'UniFi Cloud Gateway Ultra, 8-port',          1,  0,  199.00, 'Critical',  'Shelf A3')
ON CONFLICT DO NOTHING;
