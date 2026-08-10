-- ============================================================
-- Migration 182 — Module-based proposals (Phase 1)
-- Run on BETA first, verify a proposal renders, then prod.
--
-- proposal_blocks stores the ordered module stack for a quote's proposal:
--   [{ "type": "hero", "enabled": true, "vars": { ... } }, ...]
-- When NULL, the renderer derives a sensible default stack from the quote's
-- existing fields (whats_included, line items, agreement, etc.) — so every
-- existing quote keeps rendering with zero backfill.
--
-- proposal_theme lets a quote pick a visual theme later (default 'steel').
-- ALTER only — no GRANT needed (existing table permissions unchanged).
-- ============================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS proposal_blocks jsonb,
  ADD COLUMN IF NOT EXISTS proposal_theme  text DEFAULT 'steel';
