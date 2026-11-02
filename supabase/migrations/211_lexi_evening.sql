-- Migration 211: Lexi nightly "Close out today, plan tomorrow" (opt-in).
-- Per-user settings on user_settings (migration 053; service-role only) — ALTER
-- TABLE only, so no GRANT is needed.
-- Run on beta first, then prod.

ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS lexi_evening_on        boolean NOT NULL DEFAULT false;            -- opt-in
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS lexi_evening_time      text    NOT NULL DEFAULT '18:00';          -- HH:MM Eastern
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS lexi_evening_days      int[]   NOT NULL DEFAULT '{0,1,2,3,4}';    -- evenings it runs (0 = Sunday); default Sun–Thu = plan Mon–Fri
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS lexi_evening_phone     text;                                       -- where the text goes
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS lexi_evening_email     boolean NOT NULL DEFAULT false;            -- also email it
-- Never NULL so the nightly job can claim a send atomically with one .neq() update.
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS lexi_evening_last_sent date    NOT NULL DEFAULT '2000-01-01';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS lexi_top3              jsonb;                                      -- { "for": "YYYY-MM-DD", "items": [{ "title": "...", "task_id": "uuid" }] }
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS lexi_bring_always      text[]  NOT NULL DEFAULT '{}';             -- "always bring" list

CREATE INDEX IF NOT EXISTS user_settings_lexi_evening_idx ON public.user_settings (lexi_evening_on) WHERE lexi_evening_on;
