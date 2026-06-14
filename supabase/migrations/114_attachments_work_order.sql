-- Migration 114: link attachments to work orders (job photos/files)
--
-- The job glass already queries attachments by work_order_id, but the column did
-- not exist (attachments was polymorphic across opps/leads/quotes/etc.). This adds
-- it so techs can attach photos/files to a job.
-- Run on beta first, then prod. ALTER only — no GRANT needed.

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES public.work_orders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS attachments_work_order_id_idx
  ON public.attachments (work_order_id)
  WHERE work_order_id IS NOT NULL;
