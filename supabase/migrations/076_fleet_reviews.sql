-- Tech GPS location pings
CREATE TABLE IF NOT EXISTS tech_location_pings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id  uuid REFERENCES technicians(id) ON DELETE CASCADE,
  work_order_id  uuid REFERENCES work_orders(id) ON DELETE SET NULL,
  org_id         uuid REFERENCES organizations(id),
  lat            numeric(10,7) NOT NULL,
  lng            numeric(10,7) NOT NULL,
  accuracy_m     numeric,
  event_type     text DEFAULT 'ping' CHECK (event_type IN ('job_start','job_end','en_route','on_site','ping')),
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tech_location_tech ON tech_location_pings(technician_id, created_at DESC);

-- COI (Certificate of Insurance) records
CREATE TABLE IF NOT EXISTS coi_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
  policy_number   text,
  insurer_name    text,
  coverage_type   text CHECK (coverage_type IN ('general_liability','workers_comp','auto','umbrella','professional','other')),
  coverage_amount numeric,
  effective_date  date,
  expiry_date     date NOT NULL,
  document_url    text,
  status          text GENERATED ALWAYS AS (
    CASE
      WHEN expiry_date < CURRENT_DATE THEN 'expired'
      WHEN expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
      ELSE 'active'
    END
  ) STORED,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coi_org ON coi_records(org_id);
CREATE INDEX IF NOT EXISTS idx_coi_expiry ON coi_records(expiry_date);

-- Post-WO reviews
CREATE TABLE IF NOT EXISTS work_order_reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id  uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  org_id         uuid REFERENCES organizations(id),
  technician_id  uuid REFERENCES technicians(id),
  reviewer_name  text,
  reviewer_email text,
  reviewer_phone text,
  rating         integer CHECK (rating BETWEEN 1 AND 5),
  review_text    text,
  sms_sent_at    timestamptz,
  sms_sid        text,
  response_at    timestamptz,
  google_posted  boolean DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE tech_location_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE coi_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON tech_location_pings USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON coi_records USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON work_order_reviews USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ language 'plpgsql';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_coi_updated_at') THEN
    CREATE TRIGGER update_coi_updated_at BEFORE UPDATE ON coi_records FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END $$;
