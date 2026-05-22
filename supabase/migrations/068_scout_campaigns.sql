-- Migration 068: SCOUT campaign tracking on show_leads
-- Adds per-lead SCOUT outreach status so ARIA imports can be auto-enrolled
-- in AI-powered outreach campaigns and reps get alerted on engagement.

ALTER TABLE show_leads
  ADD COLUMN IF NOT EXISTS scout_status       text DEFAULT 'pending'
    CHECK (scout_status IN ('pending','queued','sent','opened','replied','paused','opted_out')),
  ADD COLUMN IF NOT EXISTS scout_enrolled_at  timestamptz,
  ADD COLUMN IF NOT EXISTS scout_sent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS scout_opened_at    timestamptz;

-- Fast lookups: alert feed queries for opened leads, campaign queue
CREATE INDEX IF NOT EXISTS show_leads_scout_status_idx
  ON show_leads (scout_status);

CREATE INDEX IF NOT EXISTS show_leads_scout_opened_idx
  ON show_leads (scout_opened_at DESC)
  WHERE scout_opened_at IS NOT NULL;

-- Note: email variants are stored in property_intel JSONB under key "email_variants"
-- so SCOUT always has the ARIA-generated copy available without a separate table.
