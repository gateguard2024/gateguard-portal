-- Migration 137: re-work / callback tracking on work orders.
-- Lets us flag a WO as a callback (return trip / re-work) and link it to the
-- original job, so we can measure first-time-fix rate and re-work cost.
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS is_callback boolean NOT NULL DEFAULT false;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS callback_of_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS wo_is_callback_idx ON public.work_orders (is_callback) WHERE is_callback = true;
