-- Migration 149: backfill aria_properties.city / .state
--
-- WHY: migration 108 added city/state, but nothing ever WROTE them — the upsert
-- in app/api/aria/properties/route.ts had 54 keys and neither of these. They were
-- read in 4 places (savedRowToItem, /api/aria/cache, /api/aria/search-runs, and
-- the Community lookup) and were NULL on every row.
--
-- The practical damage: the Community/social lookup requires a city, so with
-- city = NULL it silently returned zero posts on every saved property.
--
-- Migration 148 added `facts` JSONB with no backfill, so older rows have
-- facts = NULL too — for those we parse the city out of `address`, which has
-- always been written ("123 Main St, Dallas, TX 75201" → "Dallas" / "TX").
--
-- ALTER/UPDATE only — no GRANT needed (no new tables).

-- 1) Prefer the canonical facts bundle where migration 148 populated it.
UPDATE public.aria_properties
   SET city = NULLIF(TRIM(facts->'property'->>'city'), '')
 WHERE city IS NULL
   AND facts IS NOT NULL
   AND NULLIF(TRIM(facts->'property'->>'city'), '') IS NOT NULL;

UPDATE public.aria_properties
   SET state = NULLIF(TRIM(facts->'property'->>'state'), '')
 WHERE state IS NULL
   AND facts IS NOT NULL
   AND NULLIF(TRIM(facts->'property'->>'state'), '') IS NOT NULL;

-- 2) Fall back to parsing `address` for legacy rows (facts IS NULL).
--    "123 Main St, Dallas, TX 75201" → split_part(...,',',2) = " Dallas"
UPDATE public.aria_properties
   SET city = NULLIF(TRIM(split_part(address, ',', 2)), '')
 WHERE city IS NULL
   AND address IS NOT NULL
   AND array_length(string_to_array(address, ','), 1) >= 3;

-- 3) State = first token of the 3rd address segment (" TX 75201" → "TX").
UPDATE public.aria_properties
   SET state = NULLIF(TRIM(split_part(TRIM(split_part(address, ',', 3)), ' ', 1)), '')
 WHERE state IS NULL
   AND address IS NOT NULL
   AND array_length(string_to_array(address, ','), 1) >= 3;

CREATE INDEX IF NOT EXISTS aria_properties_city_idx ON public.aria_properties (city);

NOTIFY pgrst, 'reload schema';
