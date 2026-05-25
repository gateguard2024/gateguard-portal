-- ============================================================
-- Migration 084 — Vendors + Chart of Accounts
-- Run on BETA first, verify, then prod.
-- ============================================================

-- vendors table: suppliers, subcontractors, labor providers
CREATE TABLE IF NOT EXISTS vendors (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid REFERENCES organizations(id),

  name              text NOT NULL,
  type              text NOT NULL DEFAULT 'supplier', -- supplier | subcontractor | both
  status            text NOT NULL DEFAULT 'active',   -- active | inactive | pending

  -- Contact
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  website           text,
  address           text,
  city              text,
  state             text,
  zip               text,

  -- Financial
  payment_terms     text DEFAULT 'net30',  -- net30 | net60 | net15 | cod | prepaid
  default_coa_id    uuid,                  -- default expense account for bills from this vendor
  tax_id            text,                  -- EIN / 1099 tracking
  is_1099           boolean DEFAULT false,

  -- Cross-referencing: can a vendor also be a customer?
  is_also_customer  boolean DEFAULT false,
  customer_org_id   uuid REFERENCES organizations(id), -- link to their org record if customer too

  -- Metadata
  notes             text,
  tags              text[],
  created_by        text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- chart_of_accounts: standard double-entry bookkeeping accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES organizations(id),

  account_number text NOT NULL,  -- e.g. "1000", "4010"
  name           text NOT NULL,
  description    text,
  type           text NOT NULL,  -- asset | liability | equity | revenue | cogs | expense
  sub_type       text,           -- e.g. "checking", "accounts_receivable", "service_revenue"

  parent_id      uuid REFERENCES chart_of_accounts(id), -- for sub-accounts

  is_system      boolean DEFAULT false, -- system defaults; can be edited but not deleted
  is_active      boolean DEFAULT true,

  -- Running balance cache (updated by billing/WO transactions)
  balance        numeric(12,2) DEFAULT 0,

  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),

  UNIQUE(org_id, account_number)
);

-- vendor_bills: bills received from vendors (AP)
CREATE TABLE IF NOT EXISTS vendor_bills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  org_id        uuid REFERENCES organizations(id),

  bill_number   text,
  status        text NOT NULL DEFAULT 'draft', -- draft | open | paid | overdue | void
  bill_date     date,
  due_date      date,
  subtotal      numeric(12,2) DEFAULT 0,
  tax_amount    numeric(12,2) DEFAULT 0,
  total         numeric(12,2) DEFAULT 0,
  amount_paid   numeric(12,2) DEFAULT 0,

  -- Links to portal objects
  work_order_id uuid REFERENCES work_orders(id),
  po_number     text,  -- purchase order reference

  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- vendor_bill_lines: line items on a bill
CREATE TABLE IF NOT EXISTS vendor_bill_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id     uuid NOT NULL REFERENCES vendor_bills(id) ON DELETE CASCADE,
  coa_id      uuid REFERENCES chart_of_accounts(id),
  description text,
  quantity    numeric(10,2) DEFAULT 1,
  unit_price  numeric(12,2) DEFAULT 0,
  amount      numeric(12,2) DEFAULT 0,
  line_type   text DEFAULT 'expense', -- expense | parts | labor | subcontractor
  created_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE vendors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_bills       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_bill_lines  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_vendors"           ON vendors           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_coa"               ON chart_of_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_vendor_bills"      ON vendor_bills      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_vendor_bill_lines" ON vendor_bill_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS vendors_org_id_idx    ON vendors(org_id);
CREATE INDEX IF NOT EXISTS vendors_type_idx      ON vendors(type);
CREATE INDEX IF NOT EXISTS coa_org_id_idx        ON chart_of_accounts(org_id);
CREATE INDEX IF NOT EXISTS coa_type_idx          ON chart_of_accounts(type);
CREATE INDEX IF NOT EXISTS vendor_bills_vid_idx  ON vendor_bills(vendor_id);

-- ── Seed default Chart of Accounts (system accounts, org_id = NULL = global defaults) ──
INSERT INTO chart_of_accounts (account_number, name, type, sub_type, is_system, description) VALUES
  -- Assets
  ('1000', 'Cash & Bank Accounts',         'asset',     'cash',               true, 'All cash and checking/savings accounts'),
  ('1010', 'Checking Account',             'asset',     'checking',           true, 'Primary operating checking account'),
  ('1020', 'Savings Account',              'asset',     'savings',            true, 'Business savings / reserve'),
  ('1100', 'Accounts Receivable',          'asset',     'accounts_receivable',true, 'Money owed by customers'),
  ('1200', 'Inventory / Parts',            'asset',     'inventory',          true, 'Parts and materials in stock'),
  ('1300', 'Prepaid Expenses',             'asset',     'prepaid',            true, 'Expenses paid in advance'),
  ('1500', 'Equipment',                    'asset',     'fixed_asset',        true, 'Tools, equipment, test gear'),
  ('1600', 'Vehicles',                     'asset',     'fixed_asset',        true, 'Company vehicles and fleet'),
  -- Liabilities
  ('2000', 'Accounts Payable',             'liability', 'accounts_payable',   true, 'Money owed to vendors'),
  ('2100', 'Credit Cards Payable',         'liability', 'credit_card',        true, 'Outstanding credit card balances'),
  ('2200', 'Accrued Liabilities',          'liability', 'accrued',            true, 'Earned but unpaid expenses'),
  ('2300', 'Sales Tax Payable',            'liability', 'sales_tax',          true, 'Collected sales tax owed to state'),
  ('2400', 'Deferred Revenue',             'liability', 'deferred_revenue',   true, 'Prepaid contracts not yet earned'),
  -- Equity
  ('3000', 'Owner''s Equity',              'equity',    'owners_equity',      true, 'Capital invested by owners'),
  ('3100', 'Retained Earnings',            'equity',    'retained_earnings',  true, 'Accumulated profits reinvested'),
  -- Revenue
  ('4000', 'Service Revenue',              'revenue',   'service',            true, 'General service and labor revenue'),
  ('4010', 'Video Monitoring Revenue',     'revenue',   'recurring',          true, 'Monthly video monitoring fees'),
  ('4020', 'Access Control Revenue',       'revenue',   'recurring',          true, 'Monthly access plan fees ($5/unit)'),
  ('4030', 'Installation Revenue',         'revenue',   'project',            true, 'One-time installation project revenue'),
  ('4040', 'Parts & Materials Revenue',    'revenue',   'product',            true, 'Markup on parts sold to customers'),
  ('4050', 'Maintenance Revenue',          'revenue',   'service',            true, 'Preventive and reactive maintenance'),
  ('4100', 'DirecTV Commissions',          'revenue',   'commission',         true, 'DIRECTV/DirecTV dealer commissions'),
  ('4200', 'Partner Referral Commissions', 'revenue',   'commission',         true, 'Dealer and partner referral income'),
  -- Cost of Goods Sold
  ('5000', 'COGS – Parts & Materials',     'cogs',      'materials',          true, 'Cost of parts and equipment sold'),
  ('5010', 'COGS – Installation Labor',    'cogs',      'labor',              true, 'Direct labor cost for installs'),
  ('5020', 'COGS – Service Labor',         'cogs',      'labor',              true, 'Direct labor cost for service calls'),
  ('5030', 'COGS – Subcontractors',        'cogs',      'subcontractor',      true, 'Third-party labor costs'),
  ('5040', 'COGS – Equipment',             'cogs',      'equipment',          true, 'Equipment cost of sales (gates, cameras)'),
  -- Operating Expenses
  ('6000', 'Salaries & Wages',             'expense',   'payroll',            true, 'W-2 employee salaries and wages'),
  ('6010', 'Payroll Taxes & Benefits',     'expense',   'payroll',            true, 'Employer payroll taxes, health, 401k'),
  ('6100', 'Rent & Occupancy',             'expense',   'facilities',         true, 'Office and warehouse rent'),
  ('6110', 'Utilities',                    'expense',   'facilities',         true, 'Electric, gas, water, internet'),
  ('6200', 'Vehicle Expenses',             'expense',   'fleet',              true, 'Fuel, maintenance, insurance for fleet'),
  ('6300', 'Insurance',                    'expense',   'insurance',          true, 'GL, E&O, workers comp, auto'),
  ('6400', 'Marketing & Advertising',      'expense',   'marketing',          true, 'Ads, events, trade shows, collateral'),
  ('6500', 'Software & Subscriptions',     'expense',   'technology',         true, 'SaaS tools, cloud services, licenses'),
  ('6600', 'Office Supplies',              'expense',   'general',            true, 'Office consumables and supplies'),
  ('6700', 'Professional Fees',            'expense',   'professional',       true, 'Legal, accounting, consulting'),
  ('6800', 'Depreciation',                 'expense',   'non_cash',           true, 'Asset depreciation expense'),
  ('6900', 'Miscellaneous Expenses',       'expense',   'general',            true, 'Other operating expenses')
ON CONFLICT (org_id, account_number) DO NOTHING;
