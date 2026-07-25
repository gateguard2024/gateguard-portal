-- Migration 163: site_members — property owners / site managers ↔ sites (many-to-many)
--
-- A property user (org_tier 'client') logs in and sees ONLY their site(s).
-- A property-management GROUP may manage many sites — possibly across different
-- owning orgs — so ONE login (one clerk_user_id) can hold many membership rows.
-- This table is the single source of "which sites can this person see."

CREATE TABLE IF NOT EXISTS public.site_members (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  clerk_user_id  text NOT NULL,                          -- the property user's Clerk id
  email          text,                                   -- invite / display email
  role           text NOT NULL DEFAULT 'manager',        -- owner | manager | viewer
  org_id         uuid REFERENCES public.organizations(id) ON DELETE SET NULL, -- optional: the mgmt group's client org
  is_primary     boolean NOT NULL DEFAULT false,         -- the property main contact (can invite others)
  invited_by     text,                                   -- clerk id of whoever granted access
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, clerk_user_id)
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.site_members TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_site_members_user ON public.site_members (clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_site_members_site ON public.site_members (site_id);
CREATE INDEX IF NOT EXISTS idx_site_members_org  ON public.site_members (org_id) WHERE org_id IS NOT NULL;
