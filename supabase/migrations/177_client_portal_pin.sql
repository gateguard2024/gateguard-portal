-- ============================================================
-- Migration 177 — Customer portal access PIN (per-portal passcode gate)
-- Run on BETA first, verify, then prod.
--
-- Stores a SHA-256 hash of the portal's passcode (never the raw PIN). When
-- access_pin is set, the public /portal/[slug] page shows a lock screen until
-- the visitor enters the matching code. NULL = no gate (open portal).
-- ============================================================

ALTER TABLE public.client_portals ADD COLUMN IF NOT EXISTS access_pin TEXT;
