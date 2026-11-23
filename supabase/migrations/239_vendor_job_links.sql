-- Migration 239: send jobs to outside vendors (subcontractors) with a private link per job.
-- ADD-ON ONLY. Reuses the existing tables from migration 080:
--   subcontractors              = the vendor list (one row per vendor company/person)
--   work_order_subcontractors   = one row per job sent to a vendor (now also: the link,
--                                 their answer, requested date, progress, their invoice)
-- New nullable columns only + one new setting column. Nothing dropped, no data changed.
-- Also tightens the two tables' RLS policies to the server (service_role) — the 080
-- policies had no role, so they applied to everyone holding the public key. All of
-- Nexus reads these tables with the service-role key, so nothing in the app changes.
-- Safe to re-run.

-- ── Vendor record extras ───────────────────────────────────────────────────────
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS w9_on_file    boolean NOT NULL DEFAULT false;
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS rate_note     text;      -- "$95/h, $150 trip" — what we agreed
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS notes         text;
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS qbo_vendor_id text;      -- QuickBooks vendor (bills)

-- ── Per job sent to a vendor ───────────────────────────────────────────────────
ALTER TABLE public.work_order_subcontractors
  ADD COLUMN IF NOT EXISTS token_hash            text,          -- sha256 of the link secret (the secret is never stored)
  ADD COLUMN IF NOT EXISTS link_expires_at       timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at            timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at               timestamptz,
  ADD COLUMN IF NOT EXISTS sent_by               text,
  ADD COLUMN IF NOT EXISTS sent_via              text[],
  ADD COLUMN IF NOT EXISTS first_viewed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS last_viewed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS status                text,          -- sent · accepted · declined · on_the_way · arrived · done · cancelled
  ADD COLUMN IF NOT EXISTS status_at             timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason        text,
  ADD COLUMN IF NOT EXISTS requested_date        date,          -- vendor asks for a different day; only we change the job date
  ADD COLUMN IF NOT EXISTS request_note          text,
  ADD COLUMN IF NOT EXISTS request_status        text,          -- pending · approved · kept
  ADD COLUMN IF NOT EXISTS done_note             text,
  ADD COLUMN IF NOT EXISTS signoff_name          text,
  ADD COLUMN IF NOT EXISTS signoff_image         text,          -- data URL of the on-site signature
  ADD COLUMN IF NOT EXISTS invoice_amount        numeric(12,2),
  ADD COLUMN IF NOT EXISTS invoice_number        text,
  ADD COLUMN IF NOT EXISTS invoice_note          text,
  ADD COLUMN IF NOT EXISTS invoice_file_url      text,
  ADD COLUMN IF NOT EXISTS invoice_submitted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_status        text,          -- submitted · approved · rejected · paid
  ADD COLUMN IF NOT EXISTS invoice_reject_reason text,
  ADD COLUMN IF NOT EXISTS invoice_approved_at   timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_approved_by   text,
  ADD COLUMN IF NOT EXISTS job_cost_id           uuid,          -- job_costs row made on approval
  ADD COLUMN IF NOT EXISTS qb_bill_id            text,
  ADD COLUMN IF NOT EXISTS qb_sync_error         text,
  ADD COLUMN IF NOT EXISTS paid_at               timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at            timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS work_order_subcontractors_token_uniq
  ON public.work_order_subcontractors (token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS work_order_subcontractors_invoice_idx
  ON public.work_order_subcontractors (invoice_status) WHERE invoice_status IS NOT NULL;

-- ── QuickBooks: expense account for vendor bills ───────────────────────────────
ALTER TABLE public.qbo_settings ADD COLUMN IF NOT EXISTS vendor_account_id text;

-- ── RLS: server only (was: any role) ───────────────────────────────────────────
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.subcontractors;
CREATE POLICY "service_role_all" ON public.subcontractors FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.work_order_subcontractors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.work_order_subcontractors;
CREATE POLICY "service_role_all" ON public.work_order_subcontractors FOR ALL TO service_role USING (true) WITH CHECK (true);
