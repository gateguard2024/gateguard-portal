-- ============================================================
-- GateGuard OS — Migration 015: Work Order Request Portal
--
-- Adds a property-level maintenance request inbox.
-- Property managers submit requests via a public URL;
-- dealers see them in the Sites > Requests tab and can
-- convert them to work orders with one click.
--
-- Also extends work_orders with in_route/on_site statuses
-- for tech check-in flow + notification triggers.
-- ============================================================

-- ── 1. Work Order Requests ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wo_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID        REFERENCES sites(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL,
  description       TEXT,
  area              TEXT,                     -- e.g. "Main Gate", "Building A"
  priority_requested TEXT       DEFAULT 'normal', -- urgent | high | normal | low
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  status            TEXT        NOT NULL DEFAULT 'new',
                                               -- new | acknowledged | converted | closed
  converted_wo_id   UUID        REFERENCES work_orders(id) ON DELETE SET NULL,
  notes             TEXT,                      -- dealer internal notes
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_requests_site_id ON wo_requests(site_id);
CREATE INDEX IF NOT EXISTS idx_wo_requests_status   ON wo_requests(status);

-- ── 2. RLS ────────────────────────────────────────────────────────

ALTER TABLE wo_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_wo_requests" ON wo_requests;
CREATE POLICY "service_role_bypass_wo_requests"
  ON wo_requests TO service_role
  USING (true) WITH CHECK (true);

-- Allow anonymous INSERT (public request form — no auth)
DROP POLICY IF EXISTS "anon_insert_wo_requests" ON wo_requests;
CREATE POLICY "anon_insert_wo_requests"
  ON wo_requests FOR INSERT TO anon
  WITH CHECK (true);

-- ── 3. WO notification log ────────────────────────────────────────
-- Tracks every status-change email sent so we don't double-send.

CREATE TABLE IF NOT EXISTS wo_notification_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id  UUID        NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  event_type     TEXT        NOT NULL, -- created | updated | scheduled | in_route | on_site | completed
  recipient_email TEXT       NOT NULL,
  sent_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_notif_wo_id ON wo_notification_log(work_order_id);

ALTER TABLE wo_notification_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass_wo_notif" ON wo_notification_log;
CREATE POLICY "service_role_bypass_wo_notif"
  ON wo_notification_log TO service_role
  USING (true) WITH CHECK (true);

-- ── 4. Extend work_orders with in_route / on_site statuses ───────
-- These are valid text values — no enum to alter, just document them.
-- Valid statuses (text): open | scheduled | in_route | on_site | in_progress | completed | cancelled
-- in_route  = tech is driving to the property
-- on_site   = tech has arrived and is working

-- Add a comment column if not present (for tech arrival notes)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS tech_eta TEXT;     -- free text ETA, e.g. "15 min"
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ; -- when tech marked on_site
