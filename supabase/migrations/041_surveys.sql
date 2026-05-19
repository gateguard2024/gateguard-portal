CREATE TABLE IF NOT EXISTS surveys (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id              uuid REFERENCES organizations(id) ON DELETE CASCADE,
  survey_number       text UNIQUE,
  property_name       text NOT NULL DEFAULT '',
  property_address    text,
  site_id             uuid REFERENCES sites(id) ON DELETE SET NULL,
  opportunity_id      uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  surveyor_name       text,
  surveyor_type       text NOT NULL DEFAULT 'sales'
                        CHECK (surveyor_type IN ('tech', 'sales', 'admin')),
  survey_date         date DEFAULT CURRENT_DATE,
  voice_transcript    text,
  notes_raw           text,
  devices             jsonb NOT NULL DEFAULT '[]',
  ai_summary          text,
  ai_sow              text,
  ai_bom              jsonb NOT NULL DEFAULT '[]',
  ai_recommendations  jsonb NOT NULL DEFAULT '[]',
  ai_urgent_items     jsonb NOT NULL DEFAULT '[]',
  ai_install_notes    jsonb NOT NULL DEFAULT '[]',
  ai_timeline         text,
  photos              jsonb NOT NULL DEFAULT '[]',
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','reviewed','quote_created','archived')),
  quote_id            uuid,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_surveys_org        ON surveys (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_surveys_site       ON surveys (site_id) WHERE site_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_surveys_status     ON surveys (org_id, status);

ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY surveys_service_role_all ON surveys
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION set_survey_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  seq int;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(survey_number FROM 'GGS-\d{4}-(\d+)') AS int)), 0) + 1
    INTO seq
    FROM surveys
    WHERE survey_number LIKE 'GGS-' || EXTRACT(YEAR FROM now())::text || '-%';
  NEW.survey_number := 'GGS-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(seq::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_survey_number
  BEFORE INSERT ON surveys
  FOR EACH ROW
  WHEN (NEW.survey_number IS NULL)
  EXECUTE FUNCTION set_survey_number();
