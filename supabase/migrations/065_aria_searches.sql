-- Migration 065: aria_searches — save ARIA research results for 30 days
-- Run on beta first, verify /aria page save/import, then prod.

CREATE TABLE IF NOT EXISTS aria_searches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid REFERENCES organizations(id) ON DELETE SET NULL,
  query            text NOT NULL,
  query_interpretation text,
  results          jsonb NOT NULL,           -- full ARIA response (mode, prospects)
  imported_count   integer DEFAULT 0,        -- how many leads were imported
  imported_at      timestamptz,              -- when import was last run
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aria_searches_org_id_idx      ON aria_searches(org_id);
CREATE INDEX IF NOT EXISTS aria_searches_expires_at_idx  ON aria_searches(expires_at);
CREATE INDEX IF NOT EXISTS aria_searches_created_at_idx  ON aria_searches(created_at DESC);

ALTER TABLE aria_searches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_all" ON aria_searches
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
