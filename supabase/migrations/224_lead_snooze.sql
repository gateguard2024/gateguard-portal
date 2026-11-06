-- Migration 224: "Not now" for leads — snooze a lead for 3 / 6 / 12 months.
-- A snoozed lead leaves the working lists until snoozed_until, then comes back with a
-- "Revisit" follow-up waiting (created as a todo when it's snoozed).
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS snoozed_until DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS snooze_reason TEXT;
CREATE INDEX IF NOT EXISTS leads_snoozed_until_idx ON public.leads (snoozed_until) WHERE snoozed_until IS NOT NULL;
