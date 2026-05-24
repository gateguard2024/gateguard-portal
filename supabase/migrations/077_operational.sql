-- Migration 077: Operational tables — site_events, incidents, org_documents, work_order_photos

-- ─── Site Events ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid REFERENCES organizations(id),
  site_id      uuid REFERENCES sites(id) ON DELETE CASCADE,
  event_type   text NOT NULL CHECK (event_type IN ('install','offline','online','work_order','inspection','alert','access','visitor','other')),
  title        text NOT NULL,
  description  text,
  severity     text DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  resolved     boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

-- ─── Incidents ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid REFERENCES organizations(id),
  site_id      uuid REFERENCES sites(id),
  title        text NOT NULL,
  description  text,
  severity     text DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status       text DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','closed')),
  reported_by  text,
  resolved_at  timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ─── Org Documents ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES organizations(id),
  site_id       uuid REFERENCES sites(id),
  name          text NOT NULL,
  category      text DEFAULT 'other' CHECK (category IN ('contract','permit','certificate','insurance','manual','report','legal','other')),
  file_url      text,
  file_size_kb  integer,
  uploaded_by   text,
  expires_at    date,
  created_at    timestamptz DEFAULT now()
);

-- ─── Work Order Photos ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_order_photos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id  uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  org_id         uuid REFERENCES organizations(id),
  file_url       text NOT NULL,
  file_name      text,
  uploaded_by    text,
  created_at     timestamptz DEFAULT now()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE site_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_photos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_events'       AND policyname = 'service_role_all') THEN
    CREATE POLICY "service_role_all" ON site_events       USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incidents'         AND policyname = 'service_role_all') THEN
    CREATE POLICY "service_role_all" ON incidents         USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_documents'     AND policyname = 'service_role_all') THEN
    CREATE POLICY "service_role_all" ON org_documents     USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'work_order_photos' AND policyname = 'service_role_all') THEN
    CREATE POLICY "service_role_all" ON work_order_photos USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── updated_at trigger on incidents ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ language 'plpgsql';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_incidents_updated_at') THEN
    CREATE TRIGGER update_incidents_updated_at
      BEFORE UPDATE ON incidents
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END $$;
