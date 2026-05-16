-- ============================================================
-- GateGuard OS — Migration 011: Work Orders + Technicians
--
-- NOTE: work_orders already exists from migration 001 with a
-- different schema. This migration patches it with the columns
-- the portal needs, converts enum columns to text, and creates
-- the technicians table + scheduling infrastructure.
--
-- Safe to re-run — all operations use IF NOT EXISTS / IF EXISTS
-- or are idempotent CREATE OR REPLACE.
-- ============================================================


-- ── 1. Technicians (new table — safe) ─────────────────────────────

CREATE TABLE IF NOT EXISTS technicians (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  initials     TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'Tech',    -- Lead Tech | Installer | Tech
  status       TEXT NOT NULL DEFAULT 'offline', -- available | on_site | driving | offline
  phone        TEXT,
  email        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);


-- ── 2. Patch work_orders — add missing columns ─────────────────────
-- The table exists from migration 001 without these fields.

-- Make org_id nullable — app layer enforces scoping, not DB constraint
-- (allows seed data without a real org, and simplifies onboarding flow)
ALTER TABLE work_orders ALTER COLUMN org_id DROP NOT NULL;

-- Convert priority enum → text so API can freely use any value
ALTER TABLE work_orders ALTER COLUMN priority DROP DEFAULT;
ALTER TABLE work_orders ALTER COLUMN priority TYPE text USING priority::text;
ALTER TABLE work_orders ALTER COLUMN priority SET DEFAULT 'normal';

-- Convert status enum → text
ALTER TABLE work_orders ALTER COLUMN status DROP DEFAULT;
ALTER TABLE work_orders ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE work_orders ALTER COLUMN status SET DEFAULT 'open';

-- Add missing columns (all safe with IF NOT EXISTS)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS customer_name  TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS assignee_id    UUID REFERENCES technicians(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS assignee_name  TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS job_type       TEXT NOT NULL DEFAULT 'Repair';
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS notes          TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS site_id        UUID; -- FK to sites added in 012

-- Back-fill customer_name for any existing rows that have a client_org_id
-- (pulls the org name as a best-effort display value)
UPDATE work_orders wo
SET customer_name = o.name
FROM organizations o
WHERE wo.client_org_id = o.id
  AND wo.customer_name IS NULL;


-- ── 3. Add current_job_id to technicians (circular dep, safe) ─────

ALTER TABLE technicians ADD COLUMN IF NOT EXISTS current_job_id UUID REFERENCES work_orders(id) ON DELETE SET NULL;


-- ── 4. WO number auto-generation ──────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS wo_number_seq START 90;

CREATE OR REPLACE FUNCTION assign_wo_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.wo_number IS NULL OR NEW.wo_number = '' THEN
    NEW.wo_number := 'WO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('wo_number_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wo_number ON work_orders;
CREATE TRIGGER trg_wo_number
  BEFORE INSERT ON work_orders
  FOR EACH ROW EXECUTE FUNCTION assign_wo_number();


-- ── 5. updated_at trigger ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_wo_updated   ON work_orders;
DROP TRIGGER IF EXISTS trg_tech_updated ON technicians;

CREATE TRIGGER trg_wo_updated
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tech_updated
  BEFORE UPDATE ON technicians
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 6. RLS ────────────────────────────────────────────────────────

ALTER TABLE work_orders  ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_wo"   ON work_orders;
DROP POLICY IF EXISTS "service_role_all_tech" ON technicians;

-- Service role bypass — portal API always uses service role key
CREATE POLICY "service_role_all_wo"   ON work_orders  FOR ALL USING (true);
CREATE POLICY "service_role_all_tech" ON technicians  FOR ALL USING (true);


-- ── 7. Seed: technicians ──────────────────────────────────────────

INSERT INTO technicians (id, name, initials, role, status) VALUES
  ('00000000-0000-0000-0000-000000000101', 'Marcus Webb',   'MW', 'Lead Tech',  'on_site'),
  ('00000000-0000-0000-0000-000000000102', 'Jordan Hill',   'JH', 'Installer',  'driving'),
  ('00000000-0000-0000-0000-000000000103', 'Danny Cruz',    'DC', 'Installer',  'available'),
  ('00000000-0000-0000-0000-000000000104', 'Priya Sharma',  'PS', 'Lead Tech',  'on_site'),
  ('00000000-0000-0000-0000-000000000105', 'Carlos Vega',   'CV', 'Tech',       'offline'),
  ('00000000-0000-0000-0000-000000000106', 'Alex Kim',      'AK', 'Installer',  'available')
ON CONFLICT (id) DO NOTHING;


-- ── 8. Seed: work orders ──────────────────────────────────────────
-- wo_number is explicitly set so the trigger doesn't override it.
-- org_id is NULL — allowed after step 2 above.

INSERT INTO work_orders (wo_number, title, customer_name, assignee_id, assignee_name, priority, status, job_type, due_date, created_at) VALUES
  ('WO-2026-089', 'Camera offline — Main Gate',           'Stonegate Townhomes',  '00000000-0000-0000-0000-000000000101', 'Marcus Webb',  'high',   'in_progress', 'Repair',  '2026-04-24', NOW() - INTERVAL '2 days'),
  ('WO-2026-088', 'Brivo panel firmware update',          'Pegasus Properties',   '00000000-0000-0000-0000-000000000102', 'Jordan Hill',  'normal', 'open',        'PM',      '2026-04-30', NOW() - INTERVAL '3 days'),
  ('WO-2026-087', 'Annual camera lens cleaning',          'Angel Oak',            '00000000-0000-0000-0000-000000000101', 'Marcus Webb',  'low',    'scheduled',   'PM',      '2026-05-01', NOW() - INTERVAL '5 days'),
  ('WO-2026-086', 'Access control reader replacement',    '3888 Peachtree',       '00000000-0000-0000-0000-000000000102', 'Jordan Hill',  'high',   'open',        'Repair',  '2026-04-25', NOW() - INTERVAL '4 days'),
  ('WO-2026-085', 'NVR hard drive replacement',           'Midwood Gardens',      '00000000-0000-0000-0000-000000000101', 'Marcus Webb',  'normal', 'completed',   'Repair',  '2026-04-22', NOW() - INTERVAL '7 days'),
  ('WO-2026-084', 'New camera installation x3',           'Mitul Patel',          '00000000-0000-0000-0000-000000000103', 'Danny Cruz',   'low',    'completed',   'Install', '2026-04-19', NOW() - INTERVAL '10 days'),
  ('WO-2026-083', 'Gate operator install — Ashford Glen', 'Ashford Glen',         '00000000-0000-0000-0000-000000000104', 'Priya Sharma', 'high',   'open',        'Install', '2026-04-28', NOW() - INTERVAL '1 day'),
  ('WO-2026-082', 'Peachtree Commons PM visit',           'Peachtree Commons',    '00000000-0000-0000-0000-000000000102', 'Jordan Hill',  'normal', 'in_progress', 'PM',      '2026-04-26', NOW() - INTERVAL '1 day')
ON CONFLICT (wo_number) DO NOTHING;


-- ── 9. Link techs to current jobs ─────────────────────────────────

UPDATE technicians SET current_job_id = (SELECT id FROM work_orders WHERE wo_number = 'WO-2026-089')
  WHERE id = '00000000-0000-0000-0000-000000000101';
UPDATE technicians SET current_job_id = (SELECT id FROM work_orders WHERE wo_number = 'WO-2026-088')
  WHERE id = '00000000-0000-0000-0000-000000000102';
UPDATE technicians SET current_job_id = (SELECT id FROM work_orders WHERE wo_number = 'WO-2026-082')
  WHERE id = '00000000-0000-0000-0000-000000000104';
