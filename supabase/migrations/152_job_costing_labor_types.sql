-- Migration 152: real job costing — labor that isn't always hourly.
--
-- TODAY: work_order_time_entries only models CLOCK IN -> CLOCK OUT -> minutes.
-- That covers a W2 tech on the clock and nothing else. It cannot express:
--   · a tech billing a flat DAY RATE (rare, but it happens)
--   · a SUBCONTRACTOR handing us an invoice for the job
--   · what any of it actually COST us
--
-- So "labor cost" on a job was un-answerable, and parts/expendables weren't
-- totalled anywhere either. Job profitability couldn't be computed.
--
-- After this a work order can total:
--   labor      = hourly (mins x rate) + day rates + sub invoices
--   parts      = work_order_parts (qty x unit_cost)
--   expendable = work_order_parts flagged is_expendable (wire, connectors, etc.)
--
-- ALTER TABLE only — no new tables. Everything is NULLABLE or defaulted, so
-- existing time entries keep working exactly as they do now.

-- ── Labor: how is this entry billed? ─────────────────────────────────────────
ALTER TABLE public.work_order_time_entries
  ADD COLUMN IF NOT EXISTS labor_type TEXT
    CHECK (labor_type IN ('hourly', 'day_rate', 'sub_invoice'))
    DEFAULT 'hourly';

-- What we PAY. hourly -> per hour; day_rate -> per day; sub_invoice -> unused.
ALTER TABLE public.work_order_time_entries
  ADD COLUMN IF NOT EXISTS cost_rate NUMERIC(10,2);

-- Day-rate work: 1 = a day, 0.5 = a half day. Ignored for hourly.
ALTER TABLE public.work_order_time_entries
  ADD COLUMN IF NOT EXISTS days NUMERIC(5,2);

-- Subcontractor invoice: the amount THEY billed us, plus a reference so
-- accounting can tie it back to the paper.
ALTER TABLE public.work_order_time_entries
  ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC(10,2);

ALTER TABLE public.work_order_time_entries
  ADD COLUMN IF NOT EXISTS invoice_ref TEXT;

-- Which sub did the work (organizations covers install_contractor / dealers).
ALTER TABLE public.work_order_time_entries
  ADD COLUMN IF NOT EXISTS subcontractor_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- What we BILL the client for this labor (may differ from what it cost us).
ALTER TABLE public.work_order_time_entries
  ADD COLUMN IF NOT EXISTS bill_amount NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS wo_time_entries_labor_type_idx
  ON public.work_order_time_entries (labor_type);
CREATE INDEX IF NOT EXISTS wo_time_entries_sub_org_idx
  ON public.work_order_time_entries (subcontractor_org_id);

-- ── Parts vs expendables ─────────────────────────────────────────────────────
-- Expendables (wire, connectors, anchors, tape) are consumed rather than
-- installed as an asset. They still cost money and must be totalled, but you
-- want them separated from the equipment line when you look at a job.
ALTER TABLE public.work_order_parts
  ADD COLUMN IF NOT EXISTS is_expendable BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS work_order_parts_expendable_idx
  ON public.work_order_parts (work_order_id, is_expendable);

-- NOTE: work_order_parts already carries unit_cost (what we pay) and unit_price
-- (what we bill) from migration 135, so parts costing needs no new money
-- columns — only this split.

NOTIFY pgrst, 'reload schema';
