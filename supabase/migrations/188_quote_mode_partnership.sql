-- Migration 188: allow quote_mode = 'partnership' (Sep 2026)
-- Migration 042 created quotes_quote_mode_check as CHECK (quote_mode IN ('wizard','line_item')).
-- Migration 185 added the partnership column + renderer but never widened this check,
-- so saving a Partnership proposal fails: "violates check constraint quotes_quote_mode_check".
-- Recreate the constraint with the full set. NOT VALID so it never fails on legacy rows;
-- it still enforces the set on every new write.
-- ALTER TABLE needs no GRANT (existing permissions unchanged).

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_quote_mode_check;
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_quote_mode_check
  CHECK (quote_mode IN ('wizard', 'line_item', 'partnership', 'survey_import', 'package'))
  NOT VALID;
