-- ============================================================
-- GateGuard OS — Migration 011: Work Orders + Technicians
-- Adds field service scheduling tables for /maintenance + /dispatch
-- ============================================================

-- ── technicians ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS technicians (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  initials     TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'Tech',   -- 'Lead Tech' | 'Installer' | 'Tech'
  status       TEXT NOT NULL DEFAULT 'offline', -- 'available' | 'on_site' | 'driving' | 'offline'
  phone        TEXT,
  email        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── work_orders ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  wo_number       TEXT,                          -- e.g. WO-2026-089 (auto-generated)
  title           TEXT NOT NULL,
  description     TEXT,
  customer_name   TEXT NOT NULL,
  assignee_id     UUID REFERENCES technicians(id) ON DELETE SET NULL,
  assignee_name   TEXT,                          -- denormalized for display speed
  priority        TEXT NOT NULL DEFAULT 'medium', -- 'urgent' | 'high' | 'medium' | 'low'
  status          TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'in_progress' | 'scheduled' | 'completed' | 'cancelled'
  job_type        TEXT NOT NULL DEFAULT 'Repair', -- 'Install' | 'Repair' | 'PM' | 'Site Walk'
  scheduled_date  DATE,
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── current job link (separate from FK to avoid circular dep) ─────────────────
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS current_job_id UUID REFERENCES work_orders(id) ON DELETE SET NULL;

-- ── auto-increment WO number ──────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS wo_number_seq START 90;

CREATE OR REPLACE FUNCTION assign_wo_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.wo_number IS NULL THEN
    NEW.wo_number := 'WO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('wo_number_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wo_number ON work_orders;
CREATE TRIGGER trg_wo_number
  BEFORE INSERT ON work_orders
  FOR EACH ROW EXECUTE FUNCTION assign_wo_number();

-- ── updated_at triggers ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_wo_updated ON work_orders;
CREATE TRIGGER trg_wo_updated
  BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tech_updated ON technicians;
CREATE TRIGGER trg_tech_updated
  BEFORE UPDATE ON technicians
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE work_orders  ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians  ENABLE ROW LEVEL SECURITY;

-- Service role bypass (portal API always uses service role key)
DROP POLICY IF EXISTS "service_role_all_wo"   ON work_orders;
DROP POLICY IF EXISTS "service_role_all_tech" ON technicians;

CREATE POLICY "service_role_all_wo"   ON work_orders  FOR ALL USING (true);
CREATE POLICY "service_role_all_tech" ON technicians  FOR ALL USING (true);

-- ── Demo seed data ────────────────────────────────────────────────────────────
-- Seed technicians
INSERT INTO technicians (id, name, initials, role, status) VALUES
  ('00000000-0000-0000-0000-000000000101', 'Marcus Webb',   'MW', 'Lead Tech',  'on_site'),
  ('00000000-0000-0000-0000-000000000102', 'Jordan Hill',   'JH', 'Installer',  'driving'),
  ('00000000-0000-0000-0000-000000000103', 'Danny Cruz',    'DC', 'Installer',  'available'),
  ('00000000-0000-0000-0000-000000000104', 'Priya Sharma',  'PS', 'Lead Tech',  'on_site'),
  ('00000000-0000-0000-0000-000000000105', 'Carlos Vega',   'CV', 'Tech',       'offline'),
  ('00000000-0000-0000-0000-000000000106', 'Alex Kim',      'AK', 'Installer',  'available')
ON CONFLICT (id) DO NOTHING;

-- Seed work orders
INSERT INTO work_orders (wo_number, title, customer_name, assignee_id, assignee_name, priority, status, job_type, due_date, created_at) VALUES
  ('WO-2026-089', 'Camera offline — Main Gate',        'Stonegate Townhomes', '00000000-0000-0000-0000-000000000101', 'Marcus Webb',  'high',   'in_progress', 'Repair',    '2026-04-24', NOW() - INTERVAL '2 days'),
  ('WO-2026-088', 'Brivo panel firmware update',       'Pegasus Properties',  '00000000-0000-0000-0000-000000000102', 'Jordan Hill',  'medium', 'open',        'PM',         '2026-04-30', NOW() - INTERVAL '3 days'),
  ('WO-2026-087', 'Annual camera lens cleaning',       'Angel Oak',           '00000000-0000-0000-0000-000000000101', 'Marcus Webb',  'low',    'scheduled',   'PM',         '2026-05-01', NOW() - INTERVAL '5 days'),
  ('WO-2026-086', 'Access control reader replacement', '3888 Peachtree',      '00000000-0000-0000-0000-000000000102', 'Jordan Hill',  'high',   'open',        'Repair',    '2026-04-25', NOW() - INTERVAL '4 days'),
  ('WO-2026-085', 'NVR hard drive replacement',        'Midwood Gardens',     '00000000-0000-0000-0000-000000000101', 'Marcus Webb',  'medium', 'completed',   'Repair',    '2026-04-22', NOW() - INTERVAL '7 days'),
  ('WO-2026-084', 'New camera installation x3',        'Mitul Patel',         '00000000-0000-0000-0000-000000000103', 'Danny Cruz',   'low',    'completed',   'Install',   '2026-04-19', NOW() - INTERVAL '10 days'),
  ('WO-2026-083', 'Gate operator install — Ashford Glen', 'Ashford Glen',     '00000000-0000-0000-0000-000000000104', 'Priya Sharma', 'urgent', 'open',        'Install',   '2026-04-28', NOW() - INTERVAL '1 day'),
  ('WO-2026-082', 'Peachtree Commons PM visit',        'Peachtree Commons',   '00000000-0000-0000-0000-000000000102', 'Jordan Hill',  'normal', 'in_progress', 'PM',         '2026-04-26', NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- Link techs to current jobs
UPDATE technicians SET current_job_id = (SELECT id FROM work_orders WHERE wo_number = 'WO-2026-089')
  WHERE id = '00000000-0000-0000-0000-000000000101';
UPDATE technicians SET current_job_id = (SELECT id FROM work_orders WHERE wo_number = 'WO-2026-088')
  WHERE id = '00000000-0000-0000-0000-000000000102';
UPDATE technicians SET current_job_id = (SELECT id FROM work_orders WHERE wo_number = 'WO-2026-082')
  WHERE id = '00000000-0000-0000-0000-000000000104';
