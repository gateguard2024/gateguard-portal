-- Migration 136: per-visit costing for work orders.
-- Labor + parts can now be attributed to a specific visit (work_order_phases.id),
-- so hours and materials roll up per visit AND per work order. phase_id is nullable
-- (existing rows + ad-hoc entries stay attached to the WO with no visit).
ALTER TABLE public.work_order_time_entries ADD COLUMN IF NOT EXISTS phase_id uuid REFERENCES public.work_order_phases(id) ON DELETE SET NULL;
ALTER TABLE public.work_order_parts        ADD COLUMN IF NOT EXISTS phase_id uuid REFERENCES public.work_order_phases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS wote_phase_id_idx ON public.work_order_time_entries (phase_id);
CREATE INDEX IF NOT EXISTS wop_phase_id_idx  ON public.work_order_parts (phase_id);
