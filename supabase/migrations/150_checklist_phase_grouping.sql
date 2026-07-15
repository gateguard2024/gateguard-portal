-- Migration 150: group work-order checklist steps under phases.
--
-- WHY: a job's steps are naturally two levels —
--
--   Run/identify Wires        <- phase   (work_order_phases.name)
--     · Location 1 — detail   <- step    (wo_checklist_items.title + .notes)
--     · Location 2 — detail
--   Install Camera
--     · Location 1 — detail
--   Headend
--     · Clean wiring — detail
--   Programming
--     · Program item 1 — detail
--
-- Both tables already exist. `work_order_phases` holds the categories (Wiring,
-- Trim, Headend, Program) and `wo_checklist_items` holds the steps — but there
-- was NO link between them, so steps could only ever be one flat list. That's
-- the whole reason there was nowhere to add a category or a sub-step.
--
-- NOTE: wo_checklist_items.category already exists but CANNOT serve this — it's
-- a CHECK-constrained enum of exactly ('task','safety','inspection','verification')
-- used for a colored badge. It can't hold "Headend".
--
-- ALTER TABLE only — no new tables, no GRANT needed.
-- phase_id is NULLABLE: ungrouped steps stay valid and keep working exactly as
-- they do today, so nothing breaks for existing work orders.

ALTER TABLE public.wo_checklist_items
  ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES public.work_order_phases(id) ON DELETE SET NULL;

-- Fast lookup of "all steps in this phase", which is how the UI renders them.
CREATE INDEX IF NOT EXISTS wo_checklist_items_phase_id_idx
  ON public.wo_checklist_items (phase_id);

-- Ordering within a phase (sort_order already exists and is reused as-is).
CREATE INDEX IF NOT EXISTS wo_checklist_items_phase_sort_idx
  ON public.wo_checklist_items (phase_id, sort_order);

-- ON DELETE SET NULL is deliberate: deleting a phase must NEVER delete the
-- crew's completed step history. The steps survive, just ungrouped.

NOTIFY pgrst, 'reload schema';
