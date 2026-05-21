-- Migration 062 — TRINITY voice AI call log
-- Creates trinity_calls table for inbound/outbound call tracking with AI analysis
-- Run on beta Supabase first, verify /trinity dashboard, then prod

CREATE TABLE IF NOT EXISTS trinity_calls (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  direction          text        NOT NULL DEFAULT 'outbound', -- inbound | outbound
  phone_number       text        NOT NULL,
  contact_name       text,
  duration_seconds   integer     DEFAULT 0,
  transcript         text,
  sentiment          text,       -- positive | neutral | negative | interested | not_interested
  outcome            text,       -- no_answer | voicemail | callback_requested | qualified | not_interested | transferred
  lead_id            uuid        REFERENCES leads(id) ON DELETE SET NULL,
  opportunity_id     uuid        REFERENCES opportunities(id) ON DELETE SET NULL,
  dealer_org_id      uuid        REFERENCES organizations(id) ON DELETE SET NULL,
  ai_summary         text,       -- Claude-generated 1-sentence call summary
  recording_url      text,
  twilio_call_sid    text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trinity_calls_lead_id_idx       ON trinity_calls(lead_id);
CREATE INDEX IF NOT EXISTS trinity_calls_org_id_idx        ON trinity_calls(dealer_org_id);
CREATE INDEX IF NOT EXISTS trinity_calls_created_at_idx    ON trinity_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS trinity_calls_direction_idx     ON trinity_calls(direction);
CREATE INDEX IF NOT EXISTS trinity_calls_sentiment_idx     ON trinity_calls(sentiment);
CREATE INDEX IF NOT EXISTS trinity_calls_twilio_sid_idx    ON trinity_calls(twilio_call_sid) WHERE twilio_call_sid IS NOT NULL;

ALTER TABLE trinity_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON trinity_calls
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Optional: updated_at trigger
CREATE OR REPLACE FUNCTION update_trinity_calls_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trinity_calls_updated_at
  BEFORE UPDATE ON trinity_calls
  FOR EACH ROW EXECUTE FUNCTION update_trinity_calls_updated_at();
