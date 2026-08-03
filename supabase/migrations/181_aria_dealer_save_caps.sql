-- ============================================================
-- Migration 181 — ARIA per-dealer monthly save cap (corporate control)
-- Run on BETA first, verify, then prod.
--
-- Corporate can cap how many NEW properties a dealer org may save to the ARIA
-- Intel DB per calendar month (cost control — saving is what triggers the
-- expensive research + storage). One row per org; NULL/absent = unlimited.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.aria_dealer_save_caps (
  org_id        UUID PRIMARY KEY,
  monthly_limit INTEGER,                       -- NULL = unlimited
  note          TEXT,
  updated_by    TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.aria_dealer_save_caps TO postgres, anon, authenticated, service_role;
