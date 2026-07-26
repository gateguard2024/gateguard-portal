-- Migration 168: turn org_documents into a shared Document Library with tier access.
--
-- visibility:
--   'org'    (default) — a document that belongs to one org, visible to that org's
--             subtree exactly as today (applyOrgScope on org_id).
--   'shared'          — a corporate-published library document. Who can see it is
--             controlled by allowed_tiers: NULL/empty = ALL tiers; otherwise only
--             the listed org_tiers (e.g. ARRAY['corporate'] = corporate-only).
--
-- ALTER TABLE only — existing table permissions stand (no GRANT block required).

ALTER TABLE public.org_documents
  ADD COLUMN IF NOT EXISTS visibility    TEXT DEFAULT 'org',   -- 'org' | 'shared'
  ADD COLUMN IF NOT EXISTS allowed_tiers TEXT[],               -- shared: which org_tiers (NULL = all)
  ADD COLUMN IF NOT EXISTS description   TEXT,
  ADD COLUMN IF NOT EXISTS is_template   BOOLEAN DEFAULT false, -- reusable "start from" doc
  ADD COLUMN IF NOT EXISTS storage_path  TEXT;                  -- Supabase Storage object path (vs external file_url)

CREATE INDEX IF NOT EXISTS idx_org_documents_visibility ON public.org_documents(visibility);
CREATE INDEX IF NOT EXISTS idx_org_documents_tiers      ON public.org_documents USING GIN (allowed_tiers);
