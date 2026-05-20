-- ============================================================
-- Migration 054 — Add missing AI columns to surveys table
-- Safe to run even if columns already exist (IF NOT EXISTS).
-- Run on BETA first, verify, then prod.
-- ============================================================

ALTER TABLE surveys
  ADD COLUMN IF NOT EXISTS ai_urgent_items   jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ai_install_notes  jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ai_timeline       text;
