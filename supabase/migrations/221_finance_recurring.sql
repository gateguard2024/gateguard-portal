-- Migration 221: Finance — recurring money in/out + bank transaction marks.
-- Run on beta first, then prod. Needs 220.
--
--   finance_recurring   — one row per recurring item (rent, Comcast, a customer's ACH…):
--                         in/out, amount, how often, next date, tier. Feeds the cash outlook.
--                         Made from a bank transaction ("Recurring") or added by hand.
--   finance_txn_marks   — what a senior admin decided about one QuickBooks bank transaction:
--                         recurring (linked to the rule) or one_time (not recurring).
--   + copies finance_settings.recurring_costs (220's hand-typed list) into finance_recurring
--     once, so nothing typed in Settings is lost. The outlook reads finance_recurring only.
-- All service-role only.

-- ── Recurring items ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_recurring (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  direction      text NOT NULL CHECK (direction IN ('in','out')),
  amount         numeric(12,2) NOT NULL CHECK (amount > 0),
  frequency      text NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly','quarterly','yearly')),
  next_date      date NOT NULL,                    -- anchor: next time it happens
  day_of_month   integer CHECK (day_of_month BETWEEN 1 AND 31),  -- monthly/quarterly/yearly: which day (31 = last day)
  tier           text NOT NULL DEFAULT 'flexible' CHECK (tier IN ('must_pay','keeps_running','flexible')),
  match_key      text,                             -- "<in|out>:<payee, normalized>" when made from a bank transaction
  source         text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','bank','settings')),
  active         boolean NOT NULL DEFAULT true,
  created_by     text,
  updated_by     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.finance_recurring TO postgres, anon, authenticated, service_role;
ALTER TABLE public.finance_recurring ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finance_recurring_service ON public.finance_recurring;
CREATE POLICY finance_recurring_service ON public.finance_recurring FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS finance_recurring_active_idx ON public.finance_recurring (active, next_date);
CREATE INDEX IF NOT EXISTS finance_recurring_match_idx ON public.finance_recurring (match_key) WHERE match_key IS NOT NULL;

-- ── Marks on bank transactions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_txn_marks (
  txn_key       text PRIMARY KEY,                  -- "<QuickBooks type>:<id>", e.g. "Purchase:812"
  mark          text NOT NULL CHECK (mark IN ('recurring','one_time')),
  recurring_id  uuid REFERENCES public.finance_recurring(id) ON DELETE SET NULL,
  marked_by     text,
  marked_at     timestamptz NOT NULL DEFAULT now()
);
-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.finance_txn_marks TO postgres, anon, authenticated, service_role;
ALTER TABLE public.finance_txn_marks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finance_txn_marks_service ON public.finance_txn_marks;
CREATE POLICY finance_txn_marks_service ON public.finance_txn_marks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Move 220's hand-typed recurring costs over (once) ──────────────────────
-- next_date = that day this month (clamped to month end), or next month if it has passed.
INSERT INTO public.finance_recurring (name, direction, amount, frequency, next_date, day_of_month, tier, source)
SELECT c.name, 'out', c.amount, 'monthly',
       CASE WHEN this_m >= current_date THEN this_m ELSE next_m END,
       c.day, c.tier, 'settings'
FROM (
  SELECT trim(e->>'name') AS name,
         (e->>'amount')::numeric AS amount,
         LEAST(GREATEST(COALESCE((e->>'day')::int, 1), 1), 31) AS day,
         CASE WHEN e->>'tier' IN ('must_pay','keeps_running','flexible') THEN e->>'tier' ELSE 'flexible' END AS tier
  FROM public.finance_settings s, jsonb_array_elements(COALESCE(s.recurring_costs, '[]'::jsonb)) e
  WHERE s.id = 1
) c
CROSS JOIN LATERAL (
  SELECT
    (date_trunc('month', current_date)::date + (LEAST(c.day, EXTRACT(day FROM (date_trunc('month', current_date) + interval '1 month - 1 day'))::int) - 1)) AS this_m,
    ((date_trunc('month', current_date) + interval '1 month')::date + (LEAST(c.day, EXTRACT(day FROM (date_trunc('month', current_date) + interval '2 month - 1 day'))::int) - 1)) AS next_m
) d
WHERE c.name <> '' AND c.amount > 0
  AND NOT EXISTS (SELECT 1 FROM public.finance_recurring r WHERE r.source = 'settings');
