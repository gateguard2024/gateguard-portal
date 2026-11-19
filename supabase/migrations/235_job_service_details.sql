-- Migration 235: what each service job was (codes in lib/service-taxonomy.ts).
-- Required at Finish job: visit type, system worked on, fix — plus cause on repair-type
-- visits. A remote reset logs remote minutes instead of time on site.
-- bill_to = 'property' marks the job Ready for billing (billing/admin section comes later).
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS visit_type     text;  -- pm | repair | damage | emergency | warranty | install | inspection | training | removal
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS system         text;  -- gate_operator | gate_arm | gate_hardware | safety | access | intercom | camera | network | door | other
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS system_2       text;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS cause          text;  -- wear | vehicle | abuse | weather | power | install | settings | user_error | debris | no_fault
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS resolution     text;  -- remote_reset | adjusted | repaired | replaced_part | replaced_unit | cleaned | temporary | needs_quote
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS bill_to        text;  -- plan | property | warranty
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS remote_minutes integer;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS ready_to_bill_at timestamptz;   -- set when bill_to = 'property' and the job completes

CREATE INDEX IF NOT EXISTS work_orders_visit_type_idx ON public.work_orders (visit_type, completed_at);
CREATE INDEX IF NOT EXISTS work_orders_system_idx     ON public.work_orders (system, completed_at);
CREATE INDEX IF NOT EXISTS work_orders_ready_bill_idx ON public.work_orders (ready_to_bill_at) WHERE ready_to_bill_at IS NOT NULL;
