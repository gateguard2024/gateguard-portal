-- Migration 069: ARIA search usage tracking
-- Adds user_id + user_name + search_type to aria_searches.
-- Creates aria_usage_by_org view for hierarchical rollup.
-- Run on beta first, verify /aria usage panel, then prod.

-- ── 1. Add user tracking columns to aria_searches ────────────────────────────
ALTER TABLE aria_searches
  ADD COLUMN IF NOT EXISTS user_id        text,          -- Clerk user ID
  ADD COLUMN IF NOT EXISTS user_name      text,          -- display name at time of search
  ADD COLUMN IF NOT EXISTS user_email     text,          -- email at time of search
  ADD COLUMN IF NOT EXISTS search_type    text NOT NULL DEFAULT 'base',  -- 'base' | 'deep'
  ADD COLUMN IF NOT EXISTS deep_search_id uuid;          -- links deep search back to base search id

CREATE INDEX IF NOT EXISTS aria_searches_user_id_idx     ON aria_searches(user_id);
CREATE INDEX IF NOT EXISTS aria_searches_search_type_idx ON aria_searches(search_type);

-- ── 2. aria_usage_stats view — org-level rollup ───────────────────────────────
-- Returns per-org counts that can be summed up the hierarchy in application code.
CREATE OR REPLACE VIEW aria_usage_stats AS
SELECT
  o.id                                              AS org_id,
  o.name                                            AS org_name,
  o.org_tier,
  o.parent_org_id,
  COUNT(a.id)                                       AS search_count,
  COUNT(a.id) FILTER (WHERE a.search_type = 'base') AS base_count,
  COUNT(a.id) FILTER (WHERE a.search_type = 'deep') AS deep_count,
  COUNT(a.id) FILTER (WHERE a.created_at >= now() - interval '7 days')  AS searches_7d,
  COUNT(a.id) FILTER (WHERE a.created_at >= now() - interval '30 days') AS searches_30d,
  MIN(a.created_at)                                 AS first_search_at,
  MAX(a.created_at)                                 AS last_search_at
FROM organizations o
LEFT JOIN aria_searches a ON a.org_id = o.id
GROUP BY o.id, o.name, o.org_tier, o.parent_org_id;

-- ── 3. aria_usage_by_user view — per-user counts ─────────────────────────────
CREATE OR REPLACE VIEW aria_usage_by_user AS
SELECT
  user_id,
  user_name,
  user_email,
  org_id,
  COUNT(*)                                                                AS search_count,
  COUNT(*) FILTER (WHERE search_type = 'base')                           AS base_count,
  COUNT(*) FILTER (WHERE search_type = 'deep')                           AS deep_count,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')        AS searches_7d,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')       AS searches_30d,
  MAX(created_at)                                                         AS last_search_at
FROM aria_searches
WHERE user_id IS NOT NULL
GROUP BY user_id, user_name, user_email, org_id;
