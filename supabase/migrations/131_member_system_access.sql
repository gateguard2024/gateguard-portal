-- Migration 131: dealer-admin-managed "Site Systems" access per user.
-- Capability switches (doors, cameras, relays, door_users) scoped to all sites
-- or a chosen list. Corporate + admins bypass; non-admin staff need a grant.
-- This is access-control data → RLS on, server-only.

CREATE TABLE IF NOT EXISTS public.member_system_access (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  org_id        UUID,
  capabilities  TEXT[] NOT NULL DEFAULT '{}',   -- doors | cameras | relays | door_users
  all_sites     BOOLEAN NOT NULL DEFAULT false,
  site_ids      UUID[] NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (clerk_user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_member_system_access_user ON public.member_system_access (clerk_user_id);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.member_system_access TO postgres, anon, authenticated, service_role;

-- Server-only access (our scoped routes use the service role, which bypasses RLS).
ALTER TABLE public.member_system_access ENABLE ROW LEVEL SECURITY;
