-- Migration 135: work order parts price + read/write alignment.
-- The WO drawer writes parts to work_order_parts but the detail GET read from
-- wo_parts_used (different table) — so added parts showed "None yet". The GET is
-- repointed to work_order_parts in code; this adds the unit_price column the
-- drawer needs to show Parts price + margin (cost was already present).
ALTER TABLE public.work_order_parts ADD COLUMN IF NOT EXISTS unit_price numeric(10,2);
