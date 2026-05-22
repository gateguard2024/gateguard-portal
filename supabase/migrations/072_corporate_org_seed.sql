-- Migration 072: Ensure GateGuard corporate org row exists
-- Run on beta first, then prod.
--
-- Every portal user must have an org_id that references organizations.id.
-- Corporate users (GateGuard staff) previously had org_id=null in Clerk metadata
-- because the corporate org was never seeded. This migration creates it.
--
-- After running this migration, call GET /api/admin/setup-corporate while logged in
-- as rfeldman@gateguard.co to stamp your Clerk publicMetadata.org_id with this UUID.

INSERT INTO organizations (
  name,
  org_tier,
  is_active
)
SELECT
  'GateGuard',
  'corporate',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE org_tier = 'corporate'
);
