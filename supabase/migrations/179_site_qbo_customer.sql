-- ============================================================
-- Migration 179 — Per-site QuickBooks customer link
-- Run on BETA first, verify, then prod.
--
-- Each site links to its Customer record inside Gate Guard's single QBO company,
-- set in the site's Systems "Setup & keys". The QBO invoice importer then stamps
-- invoices with site_id (via this link), so the customer portal's balance + Pay
-- links resolve per-site. One QB company; each property → one Customer.
-- ============================================================

ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS qbo_customer_id   TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS qbo_customer_name TEXT;
CREATE INDEX IF NOT EXISTS sites_qbo_customer_idx ON public.sites(qbo_customer_id);
