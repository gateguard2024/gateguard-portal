-- Migration 069: ARIA search usage tracking
-- Self-contained: creates aria_searches if it doesn't exist (covers skipped 065),
-- then adds user tracking columns + rollup views.
-- Run on beta first, verify /aria usage panel, then prod.

-- ── 1. Create aria_searches if it doesn't exist yet (idempotent) ──────────────
CREATE TABLE IF NOT EXISTS aria_searches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid REFERENCES organizations(id) ON DELETE SET NULL,
  query            text NOT NULL,
  query_interpretation text,
  results          jsonb NOT NULL DEFAULT '{}',
  imported_count   integer DEFAULT 0,
  imported_at      timestamptz,
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aria_searches_org_id_idx      ON aria_searches(org_id);
CREATE INDEX IF NOT EXISTS aria_searches_expires_at_idx  ON aria_searches(expires_at);
CREATE INDEX IF NOT EXISTS aria_searches_created_at_idx  ON aria_searches(created_at DESC);

-- ── 2. Add user tracking + search type columns ────────────────────────────────
ALTER TABLE aria_searches
  ADD COLUMN IF NOT EXISTS user_id        text,          -- Clerk user ID
  ADD COLUMN IF NOT EXISTS user_name      text,          -- display name at time of search
  ADD COLUMN IF NOT EXISTS user_email     text,          -- email at time of search
  ADD COLUMN IF NOT EXISTS search_type    text NOT NULL DEFAULT 'base',  -- 'base' | 'deep'
  ADD COLUMN IF NOT EXISTS deep_search_id uuid;          -- links deep search back to base search id

CREATE INDEX IF NOT EXISTS aria_searches_user_id_idx     ON aria_searches(user_id);
CREATE INDEX IF NOT EXISTS aria_searches_search_type_idx ON aria_searches(search_type);

-- ── 3. RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE aria_searches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_all" ON aria_searches
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. aria_usage_stats view — org-level rollup ───────────────────────────────
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

-- ── 5. aria_usage_by_user view — per-user counts ─────────────────────────────
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
