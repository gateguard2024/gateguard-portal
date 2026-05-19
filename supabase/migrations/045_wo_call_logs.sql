-- Migration 045: Work order call logs — tech call tracking per job

CREATE TABLE IF NOT EXISTS wo_call_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  direction       text NOT NULL DEFAULT 'outbound'
                  CHECK (direction IN ('inbound','outbound')),
  contact_name    text,
  phone           text,
  duration_mins   integer,
  notes           text,
  ai_summary      text,
  outcome         text CHECK (outcome IN ('reached','no_answer','left_voicemail','wrong_number','callback_requested')),
  made_by         text,   -- tech name
  called_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_calls_wo ON wo_call_logs(work_order_id);

ALTER TABLE wo_call_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_all_wo_calls" ON wo_call_logs FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
