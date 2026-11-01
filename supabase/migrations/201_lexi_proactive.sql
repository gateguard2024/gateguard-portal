-- Migration 201: Lexi Phase 3 (proactive) — per-user settings for the morning
-- brief and snoozed "I noticed…" nudges. user_settings already exists (053) and
-- is service-role only, so no GRANT is needed for ALTER TABLE.
-- Run on beta first, then prod.

ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS lexi_brief_email     boolean NOT NULL DEFAULT false;  -- email me the brief on weekdays
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS lexi_brief_last_sent date;                            -- stops double-sends on retries
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS lexi_snoozed         jsonb   NOT NULL DEFAULT '{}'::jsonb; -- { "<nudge key>": "<snoozed until ISO>" }

CREATE INDEX IF NOT EXISTS user_settings_lexi_brief_idx ON public.user_settings (lexi_brief_email) WHERE lexi_brief_email;
