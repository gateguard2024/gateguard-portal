-- Migration 190: survey document (pre-proposal survey record) variable data +
-- send/review bookkeeping. ALTER TABLE only — no GRANT needed (existing table).

ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS survey_doc  jsonb,
  ADD COLUMN IF NOT EXISTS sent_at     timestamptz,
  ADD COLUMN IF NOT EXISTS survey_number text;

-- survey_doc holds every variable the client-facing Survey Record renders:
-- record_no, version, issued_date, prepared_for, scope/method notes, exec summary,
-- property facts, priority findings, site pins, per-area narratives/observations,
-- open items, and recommendations. Everything else is derived from surveys.devices.
