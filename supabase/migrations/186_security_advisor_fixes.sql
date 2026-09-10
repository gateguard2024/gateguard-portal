-- Migration 186: resolve Supabase security advisor CRITICAL findings (Sep 2026)
--
-- (1) Enable RLS on public.products. RLS was OFF while policies already existed
--     ("Policy Exists RLS Disabled" + "RLS Disabled in Public"). All product
--     writes now go through /api/products (service-role key → bypasses RLS), and
--     the pre-existing public-read policy keeps catalog reads working. Result:
--     anon-key writes via the public key are now blocked; the app is unaffected.
--
-- (2) Convert 5 SECURITY DEFINER views to security_invoker. Each is read only by
--     server-side API routes using the service-role key (scorecard, permits,
--     cron), so invoker semantics are safe and clear the advisor.
--
-- ALTER TABLE / ALTER VIEW need no GRANT (existing permissions are unchanged).

-- ── (1) products RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ── (2) SECURITY DEFINER views → security_invoker ────────────────────────────
-- Guarded so a view missing on a given environment can't abort the migration.
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'permits_with_status',
    'renewals_view',
    'aria_usage_stats',
    'aria_usage_by_user',
    'coi_records_with_status'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = v) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v);
    END IF;
  END LOOP;
END $$;
