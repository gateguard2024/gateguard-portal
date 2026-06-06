-- ============================================================
-- Migration 097 — Work Order Scheduled Visit Calendar Sync
-- Purpose:
-- When a work order gets scheduled, create/update a hosted Nexus
-- calendar event so Jobs, Calendar, and My Day stay aligned.
--
-- User-facing rule:
-- Schedule Visit in Job Glass should show up in Today's Schedule.
-- ============================================================

CREATE OR REPLACE FUNCTION sync_work_order_calendar_event()
RETURNS trigger AS $$
DECLARE
  existing_event_id uuid;
  event_start timestamptz;
  event_end timestamptz;
  event_title text;
BEGIN
  -- If there is no scheduled date, do not create a calendar event.
  IF NEW.scheduled_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Do not create/update active calendar events for cancelled jobs.
  IF COALESCE(NEW.status, '') = 'cancelled' THEN
    UPDATE calendar_events
    SET status = 'cancelled', updated_at = now()
    WHERE related_type = 'work_order'
      AND related_id = NEW.id;
    RETURN NEW;
  END IF;

  event_start := (NEW.scheduled_date::timestamp + time '09:00')::timestamptz;
  event_end := (NEW.scheduled_date::timestamp + time '10:00')::timestamptz;
  event_title := COALESCE(NULLIF(NEW.title, ''), NULLIF(NEW.wo_number, ''), 'Scheduled Job');

  SELECT id INTO existing_event_id
  FROM calendar_events
  WHERE related_type = 'work_order'
    AND related_id = NEW.id
  ORDER BY created_at ASC
  LIMIT 1;

  IF existing_event_id IS NULL THEN
    INSERT INTO calendar_events (
      org_id,
      user_id,
      created_by,
      title,
      description,
      location,
      start_time,
      end_time,
      is_all_day,
      status,
      source,
      related_type,
      related_id,
      sync_status
    ) VALUES (
      NEW.org_id,
      COALESCE(NEW.created_by::text, 'system'),
      COALESCE(NEW.created_by::text, 'system'),
      'Job Visit: ' || event_title,
      NEW.notes,
      NEW.location,
      event_start,
      event_end,
      false,
      CASE WHEN COALESCE(NEW.status, '') = 'completed' THEN 'completed' ELSE 'confirmed' END,
      'nexus',
      'work_order',
      NEW.id,
      'not_synced'
    );
  ELSE
    UPDATE calendar_events
    SET
      org_id = NEW.org_id,
      title = 'Job Visit: ' || event_title,
      description = NEW.notes,
      location = NEW.location,
      start_time = event_start,
      end_time = event_end,
      status = CASE WHEN COALESCE(NEW.status, '') = 'completed' THEN 'completed' ELSE 'confirmed' END,
      updated_at = now()
    WHERE id = existing_event_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_work_order_calendar_event ON work_orders;

CREATE TRIGGER trg_sync_work_order_calendar_event
AFTER INSERT OR UPDATE OF scheduled_date, status, title, wo_number, notes, location
ON work_orders
FOR EACH ROW
EXECUTE FUNCTION sync_work_order_calendar_event();
