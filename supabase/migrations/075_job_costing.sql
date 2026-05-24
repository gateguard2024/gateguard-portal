-- job_costs: tracks actual cost entries per work order
CREATE TABLE IF NOT EXISTS job_costs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  org_id          uuid REFERENCES organizations(id),
  cost_type       text NOT NULL CHECK (cost_type IN ('labor','parts','subcontractor','travel','overhead','other')),
  description     text,
  quantity        numeric NOT NULL DEFAULT 1,
  unit_cost       numeric NOT NULL DEFAULT 0,
  total_cost      numeric GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  source          text DEFAULT 'manual' CHECK (source IN ('manual','time_entry','parts_used','auto')),
  source_id       uuid,   -- FK to time_entry or work_order_parts row
  burdened_rate   numeric, -- loaded labor rate (wage * burden factor)
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- warranty + RMA fields on site_assets
ALTER TABLE site_assets
  ADD COLUMN IF NOT EXISTS warranty_months     integer,
  ADD COLUMN IF NOT EXISTS warranty_expires_at date,
  ADD COLUMN IF NOT EXISTS warranty_provider   text,
  ADD COLUMN IF NOT EXISTS warranty_notes      text,
  ADD COLUMN IF NOT EXISTS rma_status          text CHECK (rma_status IN ('none','pending','shipped','received','resolved')) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS rma_ticket_number   text,
  ADD COLUMN IF NOT EXISTS rma_initiated_at    date,
  ADD COLUMN IF NOT EXISTS rma_resolved_at     date,
  ADD COLUMN IF NOT EXISTS rma_notes           text;

-- rma_records: full RMA workflow per asset
CREATE TABLE IF NOT EXISTS rma_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_asset_id   uuid REFERENCES site_assets(id) ON DELETE CASCADE,
  work_order_id   uuid REFERENCES work_orders(id),
  org_id          uuid REFERENCES organizations(id),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','shipped','received','resolved','denied')),
  ticket_number   text,
  reason          text,
  resolution      text,
  initiated_at    date DEFAULT CURRENT_DATE,
  shipped_at      date,
  received_at     date,
  resolved_at     date,
  replacement_asset_id uuid REFERENCES site_assets(id),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE job_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rma_records ENABLE ROW LEVEL SECURITY;

-- service_role bypass
CREATE POLICY "service_role_all" ON job_costs USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON rma_records USING (true) WITH CHECK (true);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ language 'plpgsql';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_job_costs_updated_at') THEN
    CREATE TRIGGER update_job_costs_updated_at BEFORE UPDATE ON job_costs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_rma_records_updated_at') THEN
    CREATE TRIGGER update_rma_records_updated_at BEFORE UPDATE ON rma_records FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END $$;
