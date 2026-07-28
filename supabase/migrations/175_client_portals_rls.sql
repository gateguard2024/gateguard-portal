-- ============================================================
-- Migration 175 — Enable RLS on client_portals (fixes Supabase: rls_disabled_in_public)
-- Run on BETA first, verify, then PROD.
--
-- WHY: migration 173 created client_portals and GRANTed it to anon/authenticated
-- for Data-API access, but never enabled Row-Level Security. With the grant and
-- no RLS, anyone with the project URL + anon key can read, edit, or DELETE every
-- portal config row (branding, camera ids, slugs).
--
-- SAFE: the app reads/writes client_portals ONLY through the service-role key
-- (app/portal/[slug]/page.tsx + the admin API). service_role bypasses RLS, so
-- enabling RLS locks out anon with zero application impact.
-- ============================================================

ALTER TABLE public.client_portals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_client_portals" ON public.client_portals;
CREATE POLICY "service_role_all_client_portals"
  ON public.client_portals FOR ALL TO service_role USING (true) WITH CHECK (true);
