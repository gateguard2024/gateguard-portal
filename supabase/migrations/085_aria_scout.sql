-- Migration 085: ARIA research results + SCOUT alert tables
-- Run on beta Supabase first, verify, then prod.

-- ARIA research results (pain intel per property)
CREATE TABLE IF NOT EXISTS aria_research (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid,
  property_name    text,
  property_address text,
  city             text,
  state            text,
  pain_score       integer,
  service_score    integer,
  lead_temperature text CHECK (lead_temperature IN ('hot', 'warm', 'cold')),
  pain_signals     jsonb,
  service_signals  jsonb,
  outreach_angle   text,
  citations        jsonb,
  created_at       timestamptz DEFAULT now()
);

-- SCOUT market intelligence alerts
CREATE TABLE IF NOT EXISTS scout_alerts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid,
  alert_type       text CHECK (alert_type IN ('permit_expired', 'new_property_sale', 'competitor_news', 'pain_signal')),
  title            text,
  summary          text,
  property_name    text,
  city             text,
  state            text,
  source_url       text,
  relevance_score  integer,
  actioned         boolean DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE aria_research  ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_alerts   ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all ON aria_research  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all ON scout_alerts   FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aria_research_org     ON aria_research (org_id);
CREATE INDEX IF NOT EXISTS idx_aria_research_prop    ON aria_research (property_name);
CREATE INDEX IF NOT EXISTS idx_scout_alerts_org      ON scout_alerts (org_id);
CREATE INDEX IF NOT EXISTS idx_scout_alerts_type     ON scout_alerts (alert_type);
CREATE INDEX IF NOT EXISTS idx_scout_alerts_score    ON scout_alerts (relevance_score DESC);
