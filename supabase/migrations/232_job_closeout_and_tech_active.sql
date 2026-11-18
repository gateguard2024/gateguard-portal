-- Migration 232: job close-out rules + removing a tech without losing history.
--
-- A job can't be completed until it has
--   1. time on site — at least one arrive/leave entry (work_order_time_entries), none running
--   2. parts — at least one part used/replaced (work_order_parts), or "No parts used" ticked
-- Corporate may close a job without them, with a reason (logged here).
-- ALTER only — no new tables, so no GRANT needed.

ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS parts_none        boolean NOT NULL DEFAULT false;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS parts_none_at     timestamptz;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS parts_none_by     text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS closeout_override_reason text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS closeout_override_by     text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS closeout_override_at     timestamptz;

-- "Remove" a tech = inactive: off dispatch / assignment lists and the field-app code
-- stops working, but every past job and hour stays theirs. Reactivate any time.
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS active      boolean NOT NULL DEFAULT true;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS removed_at  timestamptz;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS removed_by  text;

-- Service stats read these by site / tech / date.
CREATE INDEX IF NOT EXISTS work_orders_site_completed_idx ON public.work_orders (site_id, completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS work_orders_assignee_completed_idx ON public.work_orders (assignee_id, completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS wote_work_order_idx ON public.work_order_time_entries (work_order_id);
CREATE INDEX IF NOT EXISTS technicians_active_idx ON public.technicians (org_id, active);
