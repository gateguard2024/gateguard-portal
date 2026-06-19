-- Migration 127: dealer onboarding stage data (#48)
-- Adds the spec pieces the document-flow can't derive: vetting (stage 1) and
-- the Channel Manager assignment (stage 2). 30/60/90 reviews (stage 8) are
-- computed from organizations.onboarded_at, so no column is needed for them.
-- ALTER only — no GRANT needed.

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS channel_manager_name TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS vetting_status       TEXT;  -- not_started | in_progress | cleared | flagged
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS vetting_notes        TEXT;
