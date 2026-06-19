-- Migration 124: bridge CRM → field ops.
-- Work orders are the ONE home for field jobs. Link them back to the opportunity
-- they came from, and give them a proper work-scope description.
-- ALTER TABLE only — existing table, no GRANT needed.
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS opportunity_id UUID;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS description    TEXT;
CREATE INDEX IF NOT EXISTS idx_wo_opportunity ON public.work_orders (opportunity_id);
