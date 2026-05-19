-- Migration 044: Structured field tickets — task outcomes + equipment manifest

-- ── Enhance wo_checklist_items with outcome + category tracking ─────────────
ALTER TABLE wo_checklist_items
  ADD COLUMN IF NOT EXISTS outcome           text CHECK (outcome IN ('pass','fail','na')),
  ADD COLUMN IF NOT EXISTS notes             text,
  ADD COLUMN IF NOT EXISTS category          text NOT NULL DEFAULT 'task'
                            CHECK (category IN ('task','safety','inspection','verification')),
  ADD COLUMN IF NOT EXISTS added_by          text NOT NULL DEFAULT 'management'
                            CHECK (added_by IN ('management','tech')),
  ADD COLUMN IF NOT EXISTS completed_by_name text;

-- ── Equipment manifest per work order ───────────────────────────────────────
-- Management pre-loads expected equipment; tech confirms with serial/location
CREATE TABLE IF NOT EXISTS wo_installed_equipment (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id    uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  name             text NOT NULL,
  make             text,
  model            text,
  sku              text,
  serial_number    text,
  location         text,
  qty              integer NOT NULL DEFAULT 1,
  condition        text CHECK (condition IN ('new','existing','replaced')),
  notes            text,
  added_by         text NOT NULL DEFAULT 'management'
                   CHECK (added_by IN ('management','tech')),
  confirmed        boolean NOT NULL DEFAULT false,
  confirmed_by     text,
  confirmed_at     timestamptz,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_equip_wo ON wo_installed_equipment(work_order_id);

ALTER TABLE wo_installed_equipment ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_all_wo_equipment" ON wo_installed_equipment FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
