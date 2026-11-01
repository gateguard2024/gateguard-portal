-- Migration 209: QuickBooks two-way sync (Phases 1 + 2).
-- Gate Guard corporate's ONE QuickBooks company. Run on beta first, then prod.
-- Needs 174 (qbo_connection) and 179 (sites.qbo_customer_id).
--
--   qbo_settings      — one row: account/item choices, auto-sync switch, start date
--   qbo_sync_log      — what was sent / received, so nothing is a mystery
--   qbo_report_cache  — short-lived cache of QuickBooks reports (reads are metered)
--   + link columns on products, invoices, commission_payouts, organizations
--   + qbo_claim_sync()  — one sync at a time

-- ── Settings (single row, id = 1) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qbo_settings (
  id                     integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auto_sync              boolean NOT NULL DEFAULT false,   -- off until mapping is reviewed
  sync_start_date        date,                             -- only invoices/commissions on or after this go to QuickBooks
  default_item_id        text,                             -- QuickBooks item for lines with no better match
  item_map               jsonb NOT NULL DEFAULT '{}'::jsonb, -- service_type → QuickBooks item id
  income_account_id      text,                             -- used when creating items from the catalog
  deposit_account_id     text,                             -- where payments land (default: Undeposited Funds)
  commission_account_id  text,                             -- expense account for dealer commission bills
  sync_commissions       boolean NOT NULL DEFAULT false,
  auto_create_customers  boolean NOT NULL DEFAULT true,
  updated_by             text,
  updated_at             timestamptz DEFAULT now()
);
-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.qbo_settings TO postgres, anon, authenticated, service_role;
ALTER TABLE public.qbo_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qbo_settings_service ON public.qbo_settings;
CREATE POLICY qbo_settings_service ON public.qbo_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
INSERT INTO public.qbo_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── Sync log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qbo_sync_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction   text NOT NULL,          -- 'to_qb' | 'from_qb'
  entity      text NOT NULL,          -- invoice | payment | customer | item | bill | vendor | run
  nexus_id    text,
  qbo_id      text,
  status      text NOT NULL,          -- ok | error | skipped
  message     text,
  created_at  timestamptz DEFAULT now()
);
-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.qbo_sync_log TO postgres, anon, authenticated, service_role;
ALTER TABLE public.qbo_sync_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qbo_sync_log_service ON public.qbo_sync_log;
CREATE POLICY qbo_sync_log_service ON public.qbo_sync_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS qbo_sync_log_created_idx ON public.qbo_sync_log (created_at DESC);

-- ── Report cache ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qbo_report_cache (
  key         text PRIMARY KEY,
  data        jsonb NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);
-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.qbo_report_cache TO postgres, anon, authenticated, service_role;
ALTER TABLE public.qbo_report_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qbo_report_cache_service ON public.qbo_report_cache;
CREATE POLICY qbo_report_cache_service ON public.qbo_report_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Link columns ────────────────────────────────────────────────────────────
ALTER TABLE public.qbo_connection     ADD COLUMN IF NOT EXISTS last_cdc_at        timestamptz;
ALTER TABLE public.qbo_connection     ADD COLUMN IF NOT EXISTS last_sync_at       timestamptz;
ALTER TABLE public.qbo_connection     ADD COLUMN IF NOT EXISTS sync_started_at    timestamptz;
ALTER TABLE public.qbo_connection     ADD COLUMN IF NOT EXISTS company_name       text;

ALTER TABLE public.products           ADD COLUMN IF NOT EXISTS qbo_item_id        text;
ALTER TABLE public.products           ADD COLUMN IF NOT EXISTS qbo_synced_at      timestamptz;

ALTER TABLE public.invoices           ADD COLUMN IF NOT EXISTS qb_paid_amount     numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices           ADD COLUMN IF NOT EXISTS qb_sync_error      text;
ALTER TABLE public.invoices           ADD COLUMN IF NOT EXISTS stripe_payment_link_id text;
ALTER TABLE public.invoice_line_items ADD COLUMN IF NOT EXISTS product_id         uuid;

ALTER TABLE public.organizations      ADD COLUMN IF NOT EXISTS qbo_vendor_id      text;

ALTER TABLE public.commission_payouts ADD COLUMN IF NOT EXISTS qb_bill_id         text;
ALTER TABLE public.commission_payouts ADD COLUMN IF NOT EXISTS qb_synced_at       timestamptz;
ALTER TABLE public.commission_payouts ADD COLUMN IF NOT EXISTS qb_sync_error      text;

CREATE UNIQUE INDEX IF NOT EXISTS products_qbo_item_uniq ON public.products (qbo_item_id) WHERE qbo_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_stripe_link_idx ON public.invoices (stripe_payment_link_id) WHERE stripe_payment_link_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commission_payouts_qb_bill_idx ON public.commission_payouts (qb_bill_id) WHERE qb_bill_id IS NOT NULL;

-- ── One sync at a time (a run older than 5 minutes is treated as dead) ──────
CREATE OR REPLACE FUNCTION public.qbo_claim_sync(p_conn uuid, p_stale_seconds integer DEFAULT 300)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (
    UPDATE qbo_connection SET sync_started_at = now()
     WHERE id = p_conn
       AND (sync_started_at IS NULL OR sync_started_at < now() - make_interval(secs => p_stale_seconds))
    RETURNING id
  ) SELECT EXISTS (SELECT 1 FROM c);
$$;
REVOKE ALL ON FUNCTION public.qbo_claim_sync(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qbo_claim_sync(uuid, integer) TO service_role;
