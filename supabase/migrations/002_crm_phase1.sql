-- ============================================================
-- GateGuard OS — Migration 002: CRM Phase 1
-- Tables: companies, contact_properties, company_properties,
--         opportunities, customers, activities, attachments
-- Expands: contacts, leads
-- ============================================================

-- ============================================================
-- NEW ENUMS
-- ============================================================

create type contact_type    as enum ('client', 'vendor', 'employee', 'rep', 'other');
create type contact_role    as enum ('owner', 'manager', 'regional_mgr', 'emergency', 'billing', 'other');
create type company_type    as enum ('client', 'vendor', 'prospect', 'partner');
create type opp_stage       as enum ('inquiry', 'site_walk', 'proposal', 'negotiation', 'won', 'lost');
create type customer_status as enum ('active', 'paused', 'cancelled', 'churned');
create type activity_type   as enum ('call', 'email', 'meeting', 'note', 'task', 'sms');
create type attachment_type as enum ('proposal', 'contract', 'photo', 'document', 'other');

-- Extend lead_stage with new values (additive — existing rows unaffected)
alter type lead_stage add value if not exists 'new';
alter type lead_stage add value if not exists 'contacted';
alter type lead_stage add value if not exists 'qualifying';
alter type lead_stage add value if not exists 'converted';
alter type lead_stage add value if not exists 'dead';

-- ============================================================
-- EXPAND CONTACTS
-- (table exists from migration 001, add missing columns)
-- ============================================================

alter table contacts
  add column if not exists company_id   uuid,   -- FK added after companies table created
  add column if not exists type         contact_type default 'client',
  add column if not exists updated_at   timestamptz default now();

-- ============================================================
-- COMPANIES
-- (client-side orgs — separate from the internal org hierarchy)
-- ============================================================

create table companies (
  id                  uuid primary key default uuid_generate_v4(),
  dealer_org_id       uuid not null references organizations(id) on delete cascade,
  name                text not null,
  type                company_type default 'prospect',
  primary_contact_id  uuid,   -- FK added after contacts FK resolved
  website             text,
  billing_address     text,
  city                text,
  state               text,
  zip                 text,
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Now wire the FK from contacts → companies
alter table contacts
  add constraint fk_contacts_company
  foreign key (company_id) references companies(id) on delete set null;

-- ============================================================
-- CONTACT ↔ PROPERTY junction
-- (a contact can manage multiple properties)
-- ============================================================

create table contact_properties (
  contact_id    uuid not null references contacts(id)    on delete cascade,
  property_id   uuid not null references properties(id)  on delete cascade,
  role          contact_role default 'other',
  is_primary    boolean default false,
  primary key (contact_id, property_id)
);

-- ============================================================
-- COMPANY ↔ PROPERTY junction
-- (Pegasus Residential owns many properties)
-- ============================================================

create table company_properties (
  company_id    uuid not null references companies(id)   on delete cascade,
  property_id   uuid not null references properties(id)  on delete cascade,
  primary key (company_id, property_id)
);

-- ============================================================
-- EXPAND LEADS
-- (add dealer lock, contact/company linkage, conversion tracking)
-- ============================================================

alter table leads
  add column if not exists contact_id       uuid references contacts(id)  on delete set null,
  add column if not exists company_id       uuid references companies(id) on delete set null,
  add column if not exists lock_expires_at  timestamptz,   -- null = open pool
  add column if not exists converted_at     timestamptz,
  add column if not exists opportunity_id   uuid;          -- FK added after opportunities created

-- ============================================================
-- OPPORTUNITIES
-- ============================================================

create table opportunities (
  id              uuid primary key default uuid_generate_v4(),
  dealer_org_id   uuid not null references organizations(id) on delete cascade,
  lead_id         uuid references leads(id)      on delete set null,
  contact_id      uuid references contacts(id)   on delete set null,
  company_id      uuid references companies(id)  on delete set null,
  property_id     uuid references properties(id) on delete set null,   -- attached after site walk
  rep_id          uuid references profiles(id)   on delete set null,
  quote_id        uuid references quotes(id)     on delete set null,

  name            text not null,   -- e.g. "Stonegate Townhomes — Gate + Camera"
  stage           opp_stage default 'inquiry',
  est_setup       numeric(10,2),
  est_mrr         numeric(10,2),
  close_date      date,
  lost_reason     text,
  notes           text,

  won_at          timestamptz,
  lost_at         timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Wire the FK from leads → opportunities
alter table leads
  add constraint fk_leads_opportunity
  foreign key (opportunity_id) references opportunities(id) on delete set null;

-- ============================================================
-- CUSTOMERS
-- (created automatically when opportunity stage → won)
-- ============================================================

create table customers (
  id              uuid primary key default uuid_generate_v4(),
  dealer_org_id   uuid not null references organizations(id) on delete cascade,
  opportunity_id  uuid not null references opportunities(id) on delete restrict,
  company_id      uuid references companies(id)  on delete set null,
  property_id     uuid not null references properties(id),
  primary_contact_id uuid references contacts(id) on delete set null,

  status          customer_status default 'active',
  mrr             numeric(10,2) default 0,
  setup_total     numeric(10,2) default 0,
  contract_start  date,
  contract_end    date,
  notes           text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- ACTIVITIES
-- (CRM timeline: calls, emails, meetings, notes, tasks)
-- ============================================================

create table activities (
  id              uuid primary key default uuid_generate_v4(),
  dealer_org_id   uuid not null references organizations(id) on delete cascade,
  created_by      uuid references profiles(id) on delete set null,

  type            activity_type not null,
  subject         text not null,
  body            text,

  -- Polymorphic links — attach to any CRM entity
  lead_id         uuid references leads(id)         on delete cascade,
  opportunity_id  uuid references opportunities(id) on delete cascade,
  contact_id      uuid references contacts(id)      on delete cascade,
  company_id      uuid references companies(id)     on delete cascade,
  customer_id     uuid references customers(id)     on delete cascade,

  -- Task fields
  due_at          timestamptz,
  completed_at    timestamptz,

  created_at      timestamptz default now()
);

-- ============================================================
-- ATTACHMENTS
-- (files: proposals, contracts, photos, docs)
-- ============================================================

create table attachments (
  id              uuid primary key default uuid_generate_v4(),
  dealer_org_id   uuid not null references organizations(id) on delete cascade,
  uploaded_by     uuid references profiles(id) on delete set null,

  file_name       text not null,
  url             text not null,   -- Supabase Storage URL
  file_type       text,            -- mime type
  size_bytes      bigint,
  type            attachment_type default 'document',

  -- Polymorphic links
  opportunity_id  uuid references opportunities(id) on delete cascade,
  lead_id         uuid references leads(id)         on delete cascade,
  quote_id        uuid references quotes(id)        on delete cascade,
  activity_id     uuid references activities(id)    on delete cascade,
  customer_id     uuid references customers(id)     on delete cascade,

  created_at      timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_companies_dealer       on companies(dealer_org_id);
create index idx_contacts_company       on contacts(company_id);
create index idx_contact_props_contact  on contact_properties(contact_id);
create index idx_contact_props_property on contact_properties(property_id);
create index idx_company_props_company  on company_properties(company_id);
create index idx_company_props_property on company_properties(property_id);
create index idx_leads_contact          on leads(contact_id);
create index idx_leads_company          on leads(company_id);
create index idx_leads_lock             on leads(lock_expires_at) where lock_expires_at is not null;
create index idx_opps_dealer            on opportunities(dealer_org_id);
create index idx_opps_lead              on opportunities(lead_id);
create index idx_opps_stage             on opportunities(stage);
create index idx_opps_property          on opportunities(property_id);
create index idx_customers_dealer       on customers(dealer_org_id);
create index idx_customers_property     on customers(property_id);
create index idx_activities_lead        on activities(lead_id);
create index idx_activities_opp         on activities(opportunity_id);
create index idx_activities_contact     on activities(contact_id);
create index idx_activities_due         on activities(due_at) where completed_at is null;
create index idx_attachments_opp        on attachments(opportunity_id);
create index idx_attachments_quote      on attachments(quote_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create trigger trg_companies_updated_at    before update on companies     for each row execute function update_updated_at();
create trigger trg_opps_updated_at         before update on opportunities  for each row execute function update_updated_at();
create trigger trg_customers_updated_at    before update on customers      for each row execute function update_updated_at();
create trigger trg_contacts_updated_at     before update on contacts       for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table companies           enable row level security;
alter table contact_properties  enable row level security;
alter table company_properties  enable row level security;
alter table opportunities       enable row level security;
alter table customers           enable row level security;
alter table activities          enable row level security;
alter table attachments         enable row level security;

-- Companies: dealer sees their own
create policy "companies_select" on companies
  for select using (dealer_org_id = auth_org_id());
create policy "companies_insert" on companies
  for insert with check (dealer_org_id = auth_org_id());
create policy "companies_update" on companies
  for update using (dealer_org_id = auth_org_id());

-- Contact properties: follow contacts (org-scoped)
create policy "contact_props_select" on contact_properties
  for select using (
    contact_id in (select id from contacts where org_id = auth_org_id())
  );

-- Company properties: follow companies
create policy "company_props_select" on company_properties
  for select using (
    company_id in (select id from companies where dealer_org_id = auth_org_id())
  );

-- Opportunities
create policy "opps_select" on opportunities
  for select using (dealer_org_id = auth_org_id());
create policy "opps_insert" on opportunities
  for insert with check (dealer_org_id = auth_org_id());
create policy "opps_update" on opportunities
  for update using (dealer_org_id = auth_org_id());

-- Customers
create policy "customers_select" on customers
  for select using (dealer_org_id = auth_org_id());
create policy "customers_insert" on customers
  for insert with check (dealer_org_id = auth_org_id());
create policy "customers_update" on customers
  for update using (dealer_org_id = auth_org_id());

-- Activities
create policy "activities_select" on activities
  for select using (dealer_org_id = auth_org_id());
create policy "activities_insert" on activities
  for insert with check (dealer_org_id = auth_org_id());

-- Attachments
create policy "attachments_select" on attachments
  for select using (dealer_org_id = auth_org_id());
create policy "attachments_insert" on attachments
  for insert with check (dealer_org_id = auth_org_id());

-- ============================================================
-- AUTOMATION: auto-create customer when opportunity is won
-- ============================================================

create or replace function create_customer_on_win()
returns trigger as $$
begin
  if new.stage = 'won' and old.stage != 'won' then
    insert into customers (
      dealer_org_id,
      opportunity_id,
      company_id,
      property_id,
      primary_contact_id,
      est_mrr,
      est_setup,
      contract_start
    ) values (
      new.dealer_org_id,
      new.id,
      new.company_id,
      new.property_id,
      new.contact_id,
      coalesce(new.est_mrr, 0),
      coalesce(new.est_setup, 0),
      current_date
    )
    on conflict do nothing;

    new.won_at = now();
  end if;

  if new.stage = 'lost' and old.stage != 'lost' then
    new.lost_at = now();
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger trg_opp_won
  before update on opportunities
  for each row execute function create_customer_on_win();

-- ============================================================
-- AUTOMATION: mark lead converted when opportunity is created
-- ============================================================

create or replace function mark_lead_converted()
returns trigger as $$
begin
  if new.lead_id is not null then
    update leads
    set status        = 'converted',
        converted_at  = now(),
        opportunity_id = new.id
    where id = new.lead_id
      and status != 'converted';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_lead_converted
  after insert on opportunities
  for each row execute function mark_lead_converted();

-- ============================================================
-- DONE
-- ============================================================
-- Next: 003_crm_email_templates.sql (when email server is chosen)
-- Next: 004_service_plans.sql (Phase 2 — field service)
