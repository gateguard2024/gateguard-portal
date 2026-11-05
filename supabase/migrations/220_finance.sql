-- Migration 220: Finance (Admin → Finance). Gate Guard corporate senior admins only.
-- Run on beta first, then prod. Needs 209 (qbo_* tables). 217–219 are Lexi's.
--
--   finance_access        — one row per senior admin who can open Finance: hashed code,
--                           wrong-try counter + lock, session nonce (rotated on lock / reset)
--   finance_audit         — every unlock, failed try, lock, code change, settings change
--   finance_settings      — one row: cash floor, idle lock, payroll, recurring costs,
--                           how long customers usually take to pay
--   finance_vendor_tiers  — each QuickBooks vendor's tier for the pay plan
--
-- All service-role only. Nothing here is readable with the anon key.

-- ── Who can open Finance ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_access (
  clerk_user_id    text PRIMARY KEY,
  email            text NOT NULL,
  name             text,
  code_hash        text NOT NULL,                 -- scrypt, "s1:<salt b64>:<hash b64>"
  active           boolean NOT NULL DEFAULT true,
  failed_attempts  integer NOT NULL DEFAULT 0,
  locked_until     timestamptz,                   -- set after 5 wrong tries
  session_nonce    text NOT NULL,                 -- changes on lock / reset → old sessions die
  last_unlock_at   timestamptz,
  set_by           text,                          -- clerk user id of the owner who set the code
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.finance_access TO postgres, anon, authenticated, service_role;
ALTER TABLE public.finance_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finance_access_service ON public.finance_access;
CREATE POLICY finance_access_service ON public.finance_access FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX IF NOT EXISTS finance_access_email_uniq ON public.finance_access (lower(email));

-- ── Audit log ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_audit (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id  text,                            -- who did it
  email          text,
  action         text NOT NULL,                   -- unlock | unlock_failed | locked_out | lock | code_set | code_reset | code_removed | settings | vendor_tier
  target         text,                            -- e.g. the email whose code changed
  detail         jsonb,
  ip             text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.finance_audit TO postgres, anon, authenticated, service_role;
ALTER TABLE public.finance_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finance_audit_service ON public.finance_audit;
CREATE POLICY finance_audit_service ON public.finance_audit FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS finance_audit_created_idx ON public.finance_audit (created_at DESC);

-- ── Settings (single row, id = 1) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_settings (
  id                 integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cash_floor         numeric(12,2) NOT NULL DEFAULT 0,
  idle_minutes       integer NOT NULL DEFAULT 15 CHECK (idle_minutes BETWEEN 5 AND 60),
  -- Payroll is not in QuickBooks bills, so it is entered here.
  payroll_amount     numeric(12,2) NOT NULL DEFAULT 0,   -- one run, incl. employer taxes
  payroll_frequency  text NOT NULL DEFAULT 'biweekly' CHECK (payroll_frequency IN ('weekly','biweekly','semimonthly','monthly')),
  payroll_next_date  date,                               -- next pay date (anchor for weekly / biweekly)
  -- Recurring costs that aren't entered as QuickBooks bills ahead of time:
  -- [{ "name": "Eagle Eye", "amount": 9400, "day": 1, "tier": "keeps_running" }]
  recurring_costs    jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Days after the 1st that monthly site billing usually arrives
  collect_lag_days   integer NOT NULL DEFAULT 15 CHECK (collect_lag_days BETWEEN 0 AND 120),
  updated_by         text,
  updated_at         timestamptz DEFAULT now()
);
-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.finance_settings TO postgres, anon, authenticated, service_role;
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finance_settings_service ON public.finance_settings;
CREATE POLICY finance_settings_service ON public.finance_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
INSERT INTO public.finance_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── Vendor tiers for the pay plan ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_vendor_tiers (
  qbo_vendor_id  text PRIMARY KEY,
  vendor_name    text,
  tier           text NOT NULL DEFAULT 'flexible' CHECK (tier IN ('must_pay','keeps_running','flexible')),
  updated_by     text,
  updated_at     timestamptz DEFAULT now()
);
-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.finance_vendor_tiers TO postgres, anon, authenticated, service_role;
ALTER TABLE public.finance_vendor_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finance_vendor_tiers_service ON public.finance_vendor_tiers;
CREATE POLICY finance_vendor_tiers_service ON public.finance_vendor_tiers FOR ALL TO service_role USING (true) WITH CHECK (true);
