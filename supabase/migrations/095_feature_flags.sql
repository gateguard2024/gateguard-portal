-- Migration 095: Feature Flags System
-- Three tables:
--   feature_catalog       — global master list of all portal features
--   org_feature_flags     — per-org overrides (GateGuard admin sets, links to Stripe later)
--   user_feature_access   — per-user access level within what their org allows
--
-- Access levels: 'none' | 'view' | 'edit'
--   none  = feature doesn't appear in sidebar at all
--   view  = visible, read-only
--   edit  = visible, full create/edit/delete
--
-- Hierarchy rule: user access_level cannot exceed org access_level
--   If org = 'view' and user = 'edit' → effective = 'view'
-- ─────────────────────────────────────────────────────────────────────────────

-- ── feature_catalog ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feature_catalog (
  key              TEXT PRIMARY KEY,
  label            TEXT NOT NULL,
  section          TEXT NOT NULL,
  section_label    TEXT NOT NULL,
  href             TEXT,
  description      TEXT,
  sort_order       INT  DEFAULT 0,
  is_paid          BOOLEAN DEFAULT false,
  is_beta          BOOLEAN DEFAULT false,
  is_active        BOOLEAN DEFAULT true,
  -- Per-tier default access levels (JSONB map: org_tier → access_level)
  -- Example: {"full_dealer": "edit", "service_dealer": "view", "sales_partner": "none"}
  tier_defaults    JSONB  DEFAULT '{}',
  -- Future Stripe product/price ID for subscription gating
  stripe_product_id TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.feature_catalog TO postgres, anon, authenticated, service_role;

-- ── org_feature_flags ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_feature_flags (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_key           TEXT NOT NULL REFERENCES public.feature_catalog(key) ON DELETE CASCADE,
  access_level          TEXT NOT NULL DEFAULT 'none'
                          CHECK (access_level IN ('none', 'view', 'edit')),
  is_promo              BOOLEAN DEFAULT false,
  promo_reason          TEXT,
  expires_at            TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  notes                 TEXT,
  updated_by            TEXT,
  updated_at            TIMESTAMPTZ DEFAULT now(),
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, feature_key)
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.org_feature_flags TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS org_feature_flags_org_idx
  ON public.org_feature_flags (org_id);

CREATE INDEX IF NOT EXISTS org_feature_flags_key_idx
  ON public.org_feature_flags (feature_key);

-- ── user_feature_access ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_feature_access (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id   TEXT NOT NULL,
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_key     TEXT NOT NULL REFERENCES public.feature_catalog(key) ON DELETE CASCADE,
  access_level    TEXT NOT NULL DEFAULT 'none'
                    CHECK (access_level IN ('none', 'view', 'edit')),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (clerk_user_id, org_id, feature_key)
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.user_feature_access TO postgres, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS user_feature_access_user_idx
  ON public.user_feature_access (clerk_user_id);

CREATE INDEX IF NOT EXISTS user_feature_access_org_idx
  ON public.user_feature_access (org_id);

-- ── Seed: full feature catalog from sidebar ───────────────────────────────────
-- Tier defaults: full_dealer and master_dealer get broadest access by default;
-- service_dealer gets field ops only; sales_partner gets sales only;
-- install_contractor gets field/tech only; master_agent gets reporting view only.

INSERT INTO public.feature_catalog (key, label, section, section_label, href, description, sort_order, tier_defaults) VALUES

-- Dashboard
('dashboard', 'Dashboard', 'dashboard', 'Dashboard', '/', 'Command center — KPIs, alerts, activity', 0,
  '{"corporate":"edit","master_agent":"view","master_dealer":"edit","full_dealer":"edit","service_dealer":"view","install_contractor":"view","sales_partner":"view"}'::jsonb),

-- Sales & Marketing
('sales.crm', 'CRM', 'sales', 'Sales & Marketing', '/crm', 'Leads, opportunities, pipeline', 10,
  '{"corporate":"edit","master_agent":"view","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"none","sales_partner":"edit"}'::jsonb),

('sales.quotes', 'Quotes', 'sales', 'Sales & Marketing', '/quotes', 'Proposals and approvals', 11,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"view","install_contractor":"none","sales_partner":"edit"}'::jsonb),

('sales.survey', 'Site Survey', 'sales', 'Sales & Marketing', '/survey', 'Site walk and proposal builder', 12,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"view","install_contractor":"none","sales_partner":"view"}'::jsonb),

('sales.services', 'Service Marketplace', 'sales', 'Sales & Marketing', '/services', 'TV, internet, video monitoring & more', 13,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"none","sales_partner":"edit"}'::jsonb),

('sales.reps', 'Reps & Commissions', 'sales', 'Sales & Marketing', '/reps', 'Rep hierarchy and payouts', 14,
  '{"corporate":"edit","master_agent":"view","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"none","sales_partner":"view"}'::jsonb),

('sales.marketing', 'Marketing Hub', 'sales', 'Sales & Marketing', '/marketing', 'Campaigns and content', 15,
  '{"corporate":"edit","master_agent":"none","master_dealer":"view","full_dealer":"view","service_dealer":"none","install_contractor":"none","sales_partner":"edit"}'::jsonb),

-- Business
('business.eos', 'Operating System', 'business', 'Business', '/eos', 'EOS — Rocks, Scorecard, L10', 20,
  '{"corporate":"edit","master_agent":"view","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

('business.customers', 'Customers', 'business', 'Business', '/customers', 'All customer accounts', 21,
  '{"corporate":"edit","master_agent":"view","master_dealer":"edit","full_dealer":"edit","service_dealer":"view","install_contractor":"none","sales_partner":"view"}'::jsonb),

('business.properties', 'Properties', 'business', 'Business', '/sites', 'Installed sites and assets', 22,
  '{"corporate":"edit","master_agent":"view","master_dealer":"edit","full_dealer":"edit","service_dealer":"edit","install_contractor":"view","sales_partner":"view"}'::jsonb),

('business.billing', 'Billing', 'business', 'Business', '/billing', 'Invoices and payments', 23,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

('business.expenses', 'Expenses', 'business', 'Business', '/expenses', 'Expense tracking', 24,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

('business.revenue', 'Revenue', 'business', 'Business', '/revenue', 'MRR/ARR dashboard', 25,
  '{"corporate":"edit","master_agent":"view","master_dealer":"edit","full_dealer":"view","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

-- Documents
('documents.contracts', 'Contracts', 'documents', 'Documents', '/contracts', 'Contract storage', 30,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"view","install_contractor":"none","sales_partner":"view"}'::jsonb),

('documents.renewals', 'Renewals', 'documents', 'Documents', '/renewals', 'Contract renewals and alerts', 31,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"view","install_contractor":"none","sales_partner":"none"}'::jsonb),

('documents.vendor_compliance', 'Vendor Compliance', 'documents', 'Documents', '/vendor-compliance', 'Vendor permits, certs, expiry alerts', 32,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

-- Field & Tech
('field.incidents', 'Incidents', 'field', 'Field & Tech', '/incidents', 'Gate failures, security events', 40,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"edit","install_contractor":"view","sales_partner":"none"}'::jsonb),

('field.tech_tool', 'Tech Tool', 'field', 'Field & Tech', '/tech', 'AI field diagnostic tool', 41,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"edit","install_contractor":"edit","sales_partner":"none"}'::jsonb),

('field.kb', 'Knowledge Base', 'field', 'Field & Tech', '/kb', 'Articles and manuals', 42,
  '{"corporate":"edit","master_agent":"none","master_dealer":"view","full_dealer":"view","service_dealer":"view","install_contractor":"view","sales_partner":"none"}'::jsonb),

('field.products', 'Products', 'field', 'Field & Tech', '/products', 'Equipment catalog', 43,
  '{"corporate":"edit","master_agent":"none","master_dealer":"view","full_dealer":"view","service_dealer":"view","install_contractor":"view","sales_partner":"view"}'::jsonb),

('field.work_orders', 'Work Orders', 'field', 'Field & Tech', '/maintenance', 'Work orders and service history', 44,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"edit","install_contractor":"edit","sales_partner":"none"}'::jsonb),

('field.dispatch', 'Dispatch', 'field', 'Field & Tech', '/dispatch', 'Tech scheduling and job board', 45,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"edit","install_contractor":"none","sales_partner":"none"}'::jsonb),

('field.inventory', 'Inventory', 'field', 'Field & Tech', '/inventory', 'Parts, stock, and POs', 46,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

('field.subcontractors', 'Sub-Contractors', 'field', 'Field & Tech', '/subcontractors', 'Manage subcontractors', 47,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

-- Design
('design.floor_plans', 'Floor Plans', 'design', 'Design', '/design/floor-plans', 'Place devices on blueprints', 50,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"edit","sales_partner":"none"}'::jsonb),

('design.system_design', 'System Design', 'design', 'Design', '/design/system', 'I/O schematics + wiring', 51,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"edit","sales_partner":"none"}'::jsonb),

('design.as_builts', 'As-Builts', 'design', 'Design', '/design/as-builts', 'Auto-generate install docs', 52,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"edit","sales_partner":"none"}'::jsonb),

('design.esign', 'E-Sign', 'design', 'Design', '/design/esign', 'Legal document signatures', 53,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

-- Systems
('systems.cameras', 'Cameras', 'systems', 'Systems', '/cameras', 'Eagle Eye live feeds and clips', 60,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"edit","install_contractor":"none","sales_partner":"none"}'::jsonb),

('systems.access_control', 'Access Control', 'systems', 'Systems', '/access', 'Brivo credentials and logs', 61,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"edit","install_contractor":"none","sales_partner":"none"}'::jsonb),

('systems.networks', 'Networks', 'systems', 'Systems', '/network', 'UniFi infrastructure and VLANs', 62,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"edit","install_contractor":"none","sales_partner":"none"}'::jsonb),

('systems.soc', 'SOC', 'systems', 'Systems', 'https://ggsoc.com', 'Live call center', 63,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"edit","install_contractor":"none","sales_partner":"none"}'::jsonb),

-- Dealer Network
('dealer.dealers', 'Dealers', 'dealer', 'Dealer Network', '/admin/dealers', 'Onboard and manage dealer orgs', 70,
  '{"corporate":"edit","master_agent":"view","master_dealer":"edit","full_dealer":"none","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

('dealer.platform_users', 'Platform Users', 'dealer', 'Dealer Network', '/admin/users', 'Set module permissions per user', 71,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

('dealer.compliance', 'Compliance', 'dealer', 'Dealer Network', '/compliance', 'Permits, certs, expiry alerts', 72,
  '{"corporate":"edit","master_agent":"view","master_dealer":"edit","full_dealer":"edit","service_dealer":"view","install_contractor":"none","sales_partner":"none"}'::jsonb),

('dealer.territory_map', 'Territory Map', 'dealer', 'Dealer Network', '/map', 'Property pins by health status', 73,
  '{"corporate":"edit","master_agent":"view","master_dealer":"view","full_dealer":"view","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

('dealer.scorecard', 'Scorecard', 'dealer', 'Dealer Network', '/scorecard', 'Dealer performance metrics', 74,
  '{"corporate":"edit","master_agent":"view","master_dealer":"edit","full_dealer":"view","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

('dealer.quests', 'Quests', 'dealer', 'Dealer Network', '/quests', 'Time-boxed challenges and tier points', 75,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"edit","install_contractor":"edit","sales_partner":"edit"}'::jsonb),

('dealer.reviews', 'Reviews', 'dealer', 'Dealer Network', '/reviews', 'Post-WO ratings and Google reviews', 76,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"edit","install_contractor":"none","sales_partner":"none"}'::jsonb),

('dealer.training', 'Training', 'dealer', 'Dealer Network', '/training', 'Courses and certifications', 77,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"edit","install_contractor":"edit","sales_partner":"view"}'::jsonb),

('dealer.dealer_sites', 'Dealer Sites', 'dealer', 'Dealer Network', '/marketing/website', 'Hosted dealer landing pages', 78,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

-- Internal
('internal.playbooks', 'Playbooks', 'internal', 'Internal', '/playbooks', 'Internal playbooks and SOPs', 80,
  '{"corporate":"edit","master_agent":"view","master_dealer":"view","full_dealer":"view","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

('internal.coop', 'Co-Op Pool', 'internal', 'Internal', '/marketing/coop', 'Shared lead pool', 81,
  '{"corporate":"edit","master_agent":"none","master_dealer":"view","full_dealer":"view","service_dealer":"none","install_contractor":"none","sales_partner":"edit"}'::jsonb),

('internal.portals', 'Customer Portals', 'internal', 'Internal', '/portal', 'Property manager view', 82,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"view","install_contractor":"none","sales_partner":"none"}'::jsonb)

ON CONFLICT (key) DO NOTHING;
