-- Migration 208 (205–207 are taken by Nexus Resident in the same database): Events — safe email sending, automatic sends, atomic reschedule, fast roll-ups.
-- ALTER + functions only (no new tables) — no GRANT needed. Run on beta first, then prod.
-- (Run 204 first.)

-- 1) Per-recipient send log on each campaign email, so a retry or "send again"
--    only goes to guests who haven't had it, and a lock so two clicks can't both send.
ALTER TABLE public.event_campaign_steps ADD COLUMN IF NOT EXISTS sent_guest_ids     uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.event_campaign_steps ADD COLUMN IF NOT EXISTS sending_started_at timestamptz;
ALTER TABLE public.event_campaign_steps ADD COLUMN IF NOT EXISTS sent_at            timestamptz;
-- "Send automatically on the send date" (daily job, 9am Eastern).
ALTER TABLE public.event_campaign_steps ADD COLUMN IF NOT EXISTS auto_send          boolean NOT NULL DEFAULT false;
-- Saved plans keep who each email goes to.
ALTER TABLE public.event_template_campaign ADD COLUMN IF NOT EXISTS audience text;

-- 2) Move an event and every dated step with it, in ONE transaction.
--    Sent emails and finished steps stay where they were.
CREATE OR REPLACE FUNCTION public.shift_event_dates(p_event uuid, p_new_date date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old   date;
  v_delta integer;
  v_n     integer := 0;
  v_c     integer;
BEGIN
  SELECT event_date INTO v_old FROM property_events WHERE id = p_event FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;
  UPDATE property_events SET event_date = p_new_date WHERE id = p_event;
  IF v_old IS NULL OR p_new_date IS NULL OR v_old = p_new_date THEN RETURN 0; END IF;
  v_delta := p_new_date - v_old;
  UPDATE event_checklist_items SET due_date = due_date + v_delta
   WHERE event_id = p_event AND due_date IS NOT NULL AND coalesce(status, 'open') <> 'done';
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n + v_c;
  UPDATE event_supplies SET needed_by = needed_by + v_delta
   WHERE event_id = p_event AND needed_by IS NOT NULL;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n + v_c;
  UPDATE event_campaign_steps SET send_at = send_at + v_delta
   WHERE event_id = p_event AND send_at IS NOT NULL AND coalesce(status, 'draft') NOT IN ('sent', 'sending');
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n + v_c;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.shift_event_dates(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shift_event_dates(uuid, date) TO service_role;

-- 3) Per-event roll-ups for the Events list (no 1,000-row cap, one round trip).
CREATE OR REPLACE FUNCTION public.event_rollups(p_ids uuid[], p_today date)
RETURNS TABLE (event_id uuid, done integer, total integer, late integer, yes integer, invited integer, checked_in integer, spent numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id,
    (SELECT count(*) FILTER (WHERE c.status = 'done')::int FROM event_checklist_items c WHERE c.event_id = e.id),
    (SELECT count(*)::int FROM event_checklist_items c WHERE c.event_id = e.id),
    (SELECT count(*) FILTER (WHERE coalesce(c.status, 'open') <> 'done' AND c.due_date < p_today)::int FROM event_checklist_items c WHERE c.event_id = e.id),
    (SELECT count(*) FILTER (WHERE g.rsvp IN ('yes', 'attended'))::int FROM event_guests g WHERE g.event_id = e.id),
    (SELECT count(*)::int FROM event_guests g WHERE g.event_id = e.id),
    (SELECT count(*) FILTER (WHERE g.rsvp = 'attended' OR g.checked_in_at IS NOT NULL)::int FROM event_guests g WHERE g.event_id = e.id),
    (SELECT coalesce(sum(coalesce(s.cost, 0) * coalesce(s.qty, 1)), 0) FROM event_supplies s WHERE s.event_id = e.id)
  FROM property_events e WHERE e.id = ANY(p_ids);
$$;
REVOKE ALL ON FUNCTION public.event_rollups(uuid[], date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_rollups(uuid[], date) TO service_role;

-- 4) Claim an email step for sending (one sender at a time; a lock older than
--    p_stale_seconds is treated as abandoned). Returns the guests already sent to,
--    or no row when someone else is sending.
CREATE OR REPLACE FUNCTION public.claim_campaign_step(p_step uuid, p_event uuid, p_stale_seconds integer DEFAULT 600)
RETURNS TABLE (sent_guest_ids uuid[]) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE event_campaign_steps s
     SET status = 'sending', sending_started_at = now()
   WHERE s.id = p_step AND s.event_id = p_event
     AND (s.status IS DISTINCT FROM 'sending' OR s.sending_started_at IS NULL
          OR s.sending_started_at < now() - make_interval(secs => p_stale_seconds))
  RETURNING s.sent_guest_ids;
$$;
REVOKE ALL ON FUNCTION public.claim_campaign_step(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_step(uuid, uuid, integer) TO service_role;
