-- Migration 020: Email send + open tracking
-- Adds fields to crm_activities for Resend-sent emails and open tracking

ALTER TABLE crm_activities
  ADD COLUMN IF NOT EXISTS sent_via_resend    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS resend_message_id  text,
  ADD COLUMN IF NOT EXISTS opened_at          timestamptz,
  ADD COLUMN IF NOT EXISTS open_count         integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS to_email           text,
  ADD COLUMN IF NOT EXISTS from_email         text DEFAULT 'crm@mail.gateguard.co',
  ADD COLUMN IF NOT EXISTS email_status       text DEFAULT 'draft';
  -- email_status values: draft | sent | delivered | opened | bounced | failed

-- Index for tracking lookups (pixel fires with activity id)
CREATE INDEX IF NOT EXISTS idx_crm_activities_resend_id
  ON crm_activities (resend_message_id)
  WHERE resend_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_activities_type_email
  ON crm_activities (type, created_at DESC)
  WHERE type = 'email';

-- Inbound email log table (separate from activities — parsed then matched)
CREATE TABLE IF NOT EXISTS crm_inbound_emails (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at     timestamptz DEFAULT now(),
  from_email      text NOT NULL,
  from_name       text,
  to_email        text,
  subject         text,
  body_text       text,
  body_html       text,
  message_id      text,
  in_reply_to     text,
  matched_opp_id  uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  matched_lead_id uuid,
  activity_id     uuid REFERENCES crm_activities(id) ON DELETE SET NULL,
  raw_payload     jsonb
);

CREATE INDEX IF NOT EXISTS idx_inbound_email_from ON crm_inbound_emails (from_email);
CREATE INDEX IF NOT EXISTS idx_inbound_email_opp  ON crm_inbound_emails (matched_opp_id) WHERE matched_opp_id IS NOT NULL;
