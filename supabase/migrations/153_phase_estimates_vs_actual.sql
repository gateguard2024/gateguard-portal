-- Migration 153: phases are STAGES OF WORK, not visits — and they carry an estimate.
--
-- THE DISTINCTION (this was being conflated, and it matters):
--
--   PHASE = a stage of work that spans MULTIPLE DAYS.
--           "Wiring — find/run the wire — expect 2-3 days"
--           "Trim — install the cameras — expect 3-6 days"
--   VISIT = one day on site. A phase CONTAINS many visits.
--
-- work_order_phases was being used for both. A phase named "Headend" would show
-- up in the Overview tab as a dated "Visit", which is wrong: Headend is a stage,
-- not a day. Phases are now explicitly stages; `is_visit` keeps the old dated
-- rows working so nothing existing breaks.
--
-- WHY THE ESTIMATE MATTERS: labor is already logged per day per phase
-- (work_order_time_entries.phase_id from migration 136 + clock_in date). What was
-- missing is what we EXPECTED. Without the estimate you can log every hour
-- perfectly and still never answer "did Wiring take longer than we priced?" —
-- which is the whole point of back-checking for future pricing.
--
-- Phase templates differ by work: camera installs, gate/access control, and
-- network infrastructure each have their own sequence. work_orders.job_type
-- already exists and is the hook for that (see playbooks.category too).
--
-- ALTER TABLE only — no new tables. All nullable/defaulted; existing rows are
-- untouched and keep behaving exactly as they do today.

-- ── The estimate, so actual can be judged against it ─────────────────────────
ALTER TABLE public.work_order_phases
  ADD COLUMN IF NOT EXISTS est_days_min NUMERIC(5,2);   -- "2" in "2-3 days"

ALTER TABLE public.work_order_phases
  ADD COLUMN IF NOT EXISTS est_days_max NUMERIC(5,2);   -- "3" in "2-3 days"

-- Estimated labor hours + cost for this phase, if priced that way at quote time.
ALTER TABLE public.work_order_phases
  ADD COLUMN IF NOT EXISTS est_hours NUMERIC(7,2);

ALTER TABLE public.work_order_phases
  ADD COLUMN IF NOT EXISTS est_labor_cost NUMERIC(10,2);

-- ── Phase vs visit ───────────────────────────────────────────────────────────
-- false (default) = a STAGE of work spanning days: Wiring, Trim, Headend, Program.
-- true            = a single dated day on site (the legacy "Day 1 - Rough-in" rows).
-- The Overview "Visits" card should filter to is_visit = true; the Steps card
-- groups by stages (is_visit = false).
ALTER TABLE public.work_order_phases
  ADD COLUMN IF NOT EXISTS is_visit BOOLEAN NOT NULL DEFAULT false;

-- Backfill: anything already carrying a scheduled_date was created as a dated
-- visit under the old model. Preserve that meaning so the Visits card keeps
-- showing exactly what it shows today.
UPDATE public.work_order_phases
   SET is_visit = true
 WHERE scheduled_date IS NOT NULL
   AND is_visit = false;

-- Which trade this phase belongs to — lets us template per job type
-- (camera install vs gate/access vs network infrastructure).
ALTER TABLE public.work_order_phases
  ADD COLUMN IF NOT EXISTS phase_kind TEXT;

CREATE INDEX IF NOT EXISTS work_order_phases_is_visit_idx
  ON public.work_order_phases (work_order_id, is_visit);

-- ── Actuals come from data we ALREADY capture ────────────────────────────────
-- Do NOT store actual_days/actual_hours: work_order_time_entries already has
-- phase_id (136) and clock_in, so actual days = COUNT(DISTINCT clock_in::date)
-- and actual hours = SUM(duration_mins)/60, grouped by phase_id. Storing a
-- duplicate would drift out of sync with the source of truth. Compute it.
--
-- Profitability per phase then falls out:
--   estimated: est_days_min..est_days_max, est_hours, est_labor_cost
--   actual   : distinct days + hours + labor cost (hourly/day_rate/sub_invoice
--              via migration 152) + parts (work_order_parts.phase_id, 136)
-- Back-check that across jobs of the same job_type -> real pricing.

NOTIFY pgrst, 'reload schema';
