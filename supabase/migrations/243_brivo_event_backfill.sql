-- Migration 243: Brivo event sync — fill history in small pieces (Nov 24 2026).
-- Accounts with Brivo's Eagle Eye link log a "Camera Motion" event every few seconds.
-- The first 30-day sync tried to read all of it at once, Brivo throttled the API key,
-- and it could also skip most of the month. Now each run reads new events first, then
-- fills older history back from `backfilled_from` toward 30 days ago.
-- ALTER only (no new table → no GRANT needed). Safe to re-run.

ALTER TABLE public.brivo_event_sync ADD COLUMN IF NOT EXISTS backfilled_from timestamptz;

-- What the first sync stored before can't be trusted to be complete: re-read the whole
-- month (duplicates are skipped by the unique key).
UPDATE public.brivo_event_sync SET backfilled_from = synced_through WHERE backfilled_from IS NULL;

-- Camera / video events don't belong in the door log.
DELETE FROM public.brivo_events
 WHERE action ~* '\m(camera|video|motion|clip|snapshot|recording|onair|eagle ?eye|stream|analytics?)\M';
