-- ============================================================
-- Migration 174 — QuickBooks Online: OAuth connection + customer mapping + inbound invoices
-- Run on BETA first, verify, then prod.
--
-- Adds:
--   1. qbo_connection        — single-company OAuth token store (access + refresh + realm),
--                              so tokens auto-refresh instead of expiring hourly.
--   2. organizations.qbo_customer_id — the stored QBO Customer Id per client org,
--                              so invoices reference CustomerRef.value (not fragile name match).
--   3. invoices.source + a unique index on qb_invoice_id — lets the inbound importer
--                              upsert QBO-origin open invoices without duplicating.
-- ============================================================

-- 1. OAuth connection token store (Gate Guard corporate connects ONE QBO company) --------
CREATE TABLE IF NOT EXISTS public.qbo_connection (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id            text NOT NULL,                       -- QBO company id
  environment         text NOT NULL DEFAULT 'production',  -- production | sandbox
  access_token        text,
  refresh_token       text,
  access_expires_at   timestamptz,                         -- ~1 hour out
  refresh_expires_at  timestamptz,                         -- ~100 days out
  connected_by        text,                                -- clerk user id who authorized
  is_active           boolean NOT NULL DEFAULT true,
  last_refreshed_at   timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- One row per company connection.
CREATE UNIQUE INDEX IF NOT EXISTS qbo_connection_realm_uniq ON public.qbo_connection(realm_id);

ALTER TABLE public.qbo_connection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_qbo_connection"
  ON public.qbo_connection FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.qbo_connection TO postgres, anon, authenticated, service_role;

-- 2. Per-client-org QBO Customer mapping ------------------------------------------------
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS qbo_customer_id text;
CREATE INDEX IF NOT EXISTS organizations_qbo_customer_idx ON public.organizations(qbo_customer_id);

-- 3. Inbound invoice support ------------------------------------------------------------
-- 'source' distinguishes portal-created vs QBO-imported invoices.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'portal';
-- Unique on qb_invoice_id (only where present) so the importer can upsert by it.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_qb_invoice_id_uniq
  ON public.invoices(qb_invoice_id) WHERE qb_invoice_id IS NOT NULL;
