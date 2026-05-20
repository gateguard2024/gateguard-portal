-- ============================================================
-- Migration 050 — Billing: invoices, invoice_line_items, commission_payouts
-- Run on BETA first, verify, then prod.
-- ============================================================

-- Drop partial tables from any previous failed run
DROP TABLE IF EXISTS commission_payouts CASCADE;
DROP TABLE IF EXISTS invoice_line_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;

-- invoices
CREATE TABLE invoices (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid REFERENCES organizations(id),
  client_org_id           uuid REFERENCES organizations(id),
  site_id                 uuid,  -- soft ref to sites(id) — FK added after migration 012 confirmed on env
  invoice_number          text UNIQUE NOT NULL,
  status                  text NOT NULL DEFAULT 'draft', -- draft | sent | viewed | paid | overdue | void
  issue_date              date NOT NULL DEFAULT CURRENT_DATE,
  due_date                date NOT NULL DEFAULT CURRENT_DATE,
  subtotal                numeric(10,2) NOT NULL DEFAULT 0,
  tax_amount              numeric(10,2) NOT NULL DEFAULT 0,
  total                   numeric(10,2) NOT NULL DEFAULT 0,
  amount_paid             numeric(10,2) NOT NULL DEFAULT 0,
  balance_due             numeric(10,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  notes                   text,
  stripe_payment_link     text,
  stripe_payment_intent_id text,
  qb_invoice_id           text,
  qb_synced_at            timestamptz,
  paid_at                 timestamptz,
  sent_at                 timestamptz,
  voided_at               timestamptz,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- invoice line items
CREATE TABLE invoice_line_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    uuid REFERENCES invoices(id) ON DELETE CASCADE,
  service_type  text NOT NULL, -- video_monitoring | access_plan | one_time | service_call | labor | equipment
  description   text NOT NULL,
  qty           numeric(10,2) NOT NULL DEFAULT 1,
  unit_price    numeric(10,2) NOT NULL DEFAULT 0,
  amount        numeric(10,2) GENERATED ALWAYS AS (qty * unit_price) STORED,
  is_recurring  boolean DEFAULT true,
  sort_order    int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- commission payouts
CREATE TABLE commission_payouts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES organizations(id), -- the dealer org
  rep_id        uuid,                               -- FK to future reps table
  invoice_id    uuid REFERENCES invoices(id),
  site_id       uuid,  -- soft ref to sites(id)
  payout_type   text NOT NULL,       -- dealer | rep | sub_rep
  amount        numeric(10,2) NOT NULL DEFAULT 0,
  rate_percent  numeric(5,2),
  status        text NOT NULL DEFAULT 'pending', -- pending | approved | paid | held
  pay_period    text,                            -- YYYY-MM
  approved_at   timestamptz,
  approved_by   text,
  paid_at       timestamptz,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_invoices"
  ON invoices FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_invoice_items"
  ON invoice_line_items FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_commission_payouts"
  ON commission_payouts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- indexes
CREATE INDEX IF NOT EXISTS invoices_org_id_idx           ON invoices(org_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx           ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_site_id_idx          ON invoices(site_id);
CREATE INDEX IF NOT EXISTS invoices_issue_date_idx       ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx         ON invoices(due_date);
CREATE INDEX IF NOT EXISTS invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS commission_payouts_org_id_idx ON commission_payouts(org_id);
CREATE INDEX IF NOT EXISTS commission_payouts_status_idx ON commission_payouts(status);
CREATE INDEX IF NOT EXISTS commission_payouts_invoice_idx ON commission_payouts(invoice_id);
