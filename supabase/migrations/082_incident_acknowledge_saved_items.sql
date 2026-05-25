-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 082: Incident acknowledgement + user-scoped saved line items
-- Run on beta Supabase first, then prod.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Incident acknowledgement ─────────────────────────────────────────────────
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS acknowledged_at   timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by   text;

CREATE INDEX IF NOT EXISTS incidents_acknowledged_idx
  ON incidents (acknowledged_at)
  WHERE acknowledged_at IS NOT NULL;

-- ── Saved line items (invoice product/service picker) ────────────────────────
-- user_id = NULL  → global (visible to all users, set by admin from products)
-- user_id = text  → Clerk user ID, visible only to that user

CREATE TABLE IF NOT EXISTS saved_line_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text,                           -- NULL = global; Clerk user ID = user-private
  org_id        uuid        REFERENCES organizations(id) ON DELETE SET NULL,
  name          text        NOT NULL,           -- display name shown in picker
  description   text,                           -- default line item description
  service_type  text        NOT NULL DEFAULT 'one_time',
  unit_price    numeric     NOT NULL DEFAULT 0,
  default_qty   numeric     NOT NULL DEFAULT 1,
  is_recurring  boolean     NOT NULL DEFAULT false,
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_line_items_user_idx
  ON saved_line_items (user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS saved_line_items_global_idx
  ON saved_line_items (sort_order) WHERE user_id IS NULL;

ALTER TABLE saved_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON saved_line_items FOR ALL USING (true);

-- ── Seed global items (ON CONFLICT DO NOTHING is safe to re-run) ─────────────
INSERT INTO saved_line_items (user_id, name, description, service_type, unit_price, default_qty, is_recurring, sort_order)
VALUES
  (NULL, 'Video Monitoring',   'Video Monitoring Fee — Monthly',                                                          'video_monitoring', 500.00, 1, true,  1),
  (NULL, 'Access Plan',        'GateGuard Access Plan — $5.00/unit/mo (gate service, Brivo, PMS integration, 36-month)',  'access_plan',        5.00, 1, true,  2),
  (NULL, 'Service Call',       'On-site service call',                                                                    'service_call',        0.00, 1, false, 3),
  (NULL, 'Labor — Install',    'Installation / labor',                                                                    'labor',               0.00, 1, false, 4),
  (NULL, 'Labor — Service',    'Service labor (hourly)',                                                                   'labor',               0.00, 1, false, 5),
  (NULL, 'Equipment',          '',                                                                                         'equipment',           0.00, 1, false, 6),
  (NULL, 'Permit Fee',         'Permit filing fee',                                                                        'one_time',            0.00, 1, false, 7),
  (NULL, 'Trip Charge',        'Trip charge / travel fee',                                                                 'one_time',           75.00, 1, false, 8)
ON CONFLICT DO NOTHING;
