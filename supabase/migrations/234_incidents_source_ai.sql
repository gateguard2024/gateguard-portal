-- Migration 234: let Gate Watch save its Faults.
-- The shared incidents table has a CHECK rule "incidents_source_check" (added outside this
-- repo — likely the SOC/dispatch app) that doesn't allow source = 'ai', so every Gate Watch
-- Fault failed to save (Nov 18 2026). Rebuild the rule as: every value it allows today
-- + every value already in the table + the portal's values (manual, ai, ggsoc, monitor).
-- Nothing another app uses is taken away.
DO $$
DECLARE
  def  text;
  vals text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO def
  FROM pg_constraint c
  WHERE c.conname = 'incidents_source_check' AND c.conrelid = 'public.incidents'::regclass;

  IF def IS NULL THEN
    RAISE NOTICE 'No incidents_source_check rule — nothing to change.';
    RETURN;
  END IF;

  SELECT string_agg(DISTINCT quote_literal(v), ', ') INTO vals FROM (
    SELECT (regexp_matches(coalesce(def, ''), '''([^'']+)''', 'g'))[1] AS v
    UNION SELECT DISTINCT source FROM public.incidents WHERE source IS NOT NULL
    UNION SELECT unnest(ARRAY['manual', 'ai', 'ggsoc', 'monitor'])
  ) x;

  RAISE NOTICE 'incidents_source_check was: %', coalesce(def, '(none)');
  ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS incidents_source_check;
  EXECUTE format('ALTER TABLE public.incidents ADD CONSTRAINT incidents_source_check CHECK (source IS NULL OR source IN (%s))', vals);
END $$;
