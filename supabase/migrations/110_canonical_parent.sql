-- Migration 110: Canonical parent pointer + subtree fix
--
-- Problem (see HIERARCHY_USERS_PERMISSIONS_AUDIT.md §5):
--   organizations has TWO parent columns — parent_id (original, 001) and
--   parent_org_id (017). get_org_subtree() walks parent_id, but the dealer
--   onboarding flow writes parent_org_id. A row that only sets one of them
--   makes downward org-scoping return the wrong set — the core risk to the
--   "MSO data stays separate from its dealers/corporate" guarantee.
--
-- Fix:
--   1. Backfill both columns so they always agree.
--   2. Rewrite get_org_subtree() to walk COALESCE(parent_org_id, parent_id),
--      so it is correct regardless of which column a given row populated.
--      Also switches the tier projection from the dropped `tier` column to
--      the renamed `org_tier` column (migration 034).
--
-- Run on BETA Supabase first, then prod. ALTER/UPDATE only — no GRANT needed.
-- ============================================================

-- ── 1. Backfill: make parent_org_id and parent_id agree ──────────────────────
UPDATE public.organizations
  SET parent_org_id = parent_id
  WHERE parent_org_id IS NULL AND parent_id IS NOT NULL;

UPDATE public.organizations
  SET parent_id = parent_org_id
  WHERE parent_id IS NULL AND parent_org_id IS NOT NULL;

-- ── 2. Rewrite the subtree function to walk the canonical pointer ────────────
CREATE OR REPLACE FUNCTION get_org_subtree(root_id uuid)
RETURNS TABLE(id uuid, tier org_tier, name text, parent_id uuid)
LANGUAGE sql
SECURITY DEFINER   -- runs as definer (postgres), not the caller
STABLE
AS $$
  WITH RECURSIVE subtree AS (
    -- Base: the root org itself
    SELECT
      o.id,
      o.org_tier AS tier,
      o.name,
      COALESCE(o.parent_org_id, o.parent_id) AS parent_id
    FROM organizations o
    WHERE o.id = root_id

    UNION ALL

    -- Recursive: every org whose canonical parent is already in the subtree
    SELECT
      o.id,
      o.org_tier AS tier,
      o.name,
      COALESCE(o.parent_org_id, o.parent_id) AS parent_id
    FROM organizations o
    INNER JOIN subtree s
      ON COALESCE(o.parent_org_id, o.parent_id) = s.id
  )
  SELECT * FROM subtree;
$$;

GRANT EXECUTE ON FUNCTION get_org_subtree(uuid) TO service_role;
