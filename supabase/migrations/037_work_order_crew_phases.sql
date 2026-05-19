-- Migration 037: Multi-crew + multi-phase work orders

-- ── work_order_crew: many technicians per job ───────────────────────
CREATE TABLE IF NOT EXISTS work_order_crew (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id    uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  technician_id    uuid NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
  role             text NOT NULL DEFAULT 'crew'
                   CHECK (role IN ('lead', 'crew', 'supervisor', 'owner')),
  sort_order       integer NOT NULL DEFAULT 0,
  added_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_order_id, technician_id)
);

CREATE INDEX IF NOT EXISTS idx_wo_crew_wo   ON work_order_crew(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_crew_tech ON work_order_crew(technician_id);

ALTER TABLE work_order_crew ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_all_wo_crew" ON work_order_crew FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── work_order_phases: multi-day / multi-phase jobs ─────────────────
CREATE TABLE IF NOT EXISTS work_order_phases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id    uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  name             text NOT NULL,           -- e.g. "Day 1 – Rough-in", "Phase 2 – Commissioning"
  scheduled_date   date,
  end_date         date,                    -- optional end date for multi-day spans
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','in_progress','complete','skipped')),
  notes            text,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_phases_wo ON work_order_phases(work_order_id);

ALTER TABLE work_order_phases ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_all_wo_phases" ON work_order_phases FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
