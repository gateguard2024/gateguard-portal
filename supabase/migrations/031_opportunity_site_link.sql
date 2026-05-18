-- Migration 031: Link opportunities → sites (one-to-many support)
-- An opportunity converts to a site. Multiple opportunities can exist per site
-- (e.g., expansion, add-on services). sites.crm_opp_id tracks the ORIGINATING opp.
-- This FK on opportunities lets each opp optionally reference the site it created.

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS opportunities_site_id_idx ON opportunities (site_id);

COMMENT ON COLUMN opportunities.site_id IS
  'The site (property) that was created from this opportunity. Null until opp is Won and site is created.';
