-- ============================================================
-- Migration 178 — QuickBooks "View and Pay" link cache on invoices
-- Run on BETA first, verify, then prod.
--
-- The customer portal's Pay button opens the QBO invoice's online payment link.
-- We fetch it lazily (GET /invoice/{id}?include=invoiceLink) the first time a
-- portal shows the invoice, then cache it here so we don't re-hit QBO every load.
-- ============================================================

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS qbo_invoice_link TEXT;
