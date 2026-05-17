-- contracts table
create table if not exists contracts (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  client_org_id    uuid references organizations(id) on delete set null,
  site_id          uuid references sites(id) on delete set null,
  quote_id         uuid references quotes(id) on delete set null,

  contract_number  text,
  title            text not null,
  status           text not null default 'draft' check (status in ('draft','pending_signature','active','expired','cancelled')),

  setup_amount     numeric(10,2) default 0,
  mrr              numeric(10,2) default 0,
  total_value      numeric(10,2) default 0,
  term_months      int default 12,

  start_date       date,
  end_date         date,
  auto_renew       boolean default true,
  renewal_notice_days int default 60,

  terms_summary    text,
  document_url     text,
  notes            text,

  assigned_rep     text,

  is_active        boolean default true,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- signatories
create table if not exists contract_signatories (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references contracts(id) on delete cascade,
  role         text not null,
  name         text not null,
  email        text,
  signed       boolean default false,
  signed_at    timestamptz,
  created_at   timestamptz default now()
);

-- RLS (service role full access)
alter table contracts enable row level security;
create policy "service_role_all_contracts" on contracts using (true) with check (true);
alter table contract_signatories enable row level security;
create policy "service_role_all_signatories" on contract_signatories using (true) with check (true);

-- indexes
create index if not exists idx_contracts_org on contracts(org_id);
create index if not exists idx_contracts_client on contracts(client_org_id) where client_org_id is not null;
create index if not exists idx_contracts_site on contracts(site_id) where site_id is not null;
create index if not exists idx_contracts_end_date on contracts(end_date) where end_date is not null;
create index if not exists idx_signatories_contract on contract_signatories(contract_id);

-- renewals view: contracts expiring within 120 days or already expired
create or replace view renewals_view as
select
  c.*,
  o.name as client_name,
  s.name as site_name,
  case
    when c.end_date is null then 'on_track'
    when c.end_date < current_date then 'expired'
    when c.end_date <= current_date + interval '30 days' then 'action_needed'
    when c.end_date <= current_date + interval '60 days' then 'action_needed'
    when c.end_date <= current_date + interval '90 days' then 'watch'
    else 'on_track'
  end as renewal_status,
  case
    when c.end_date is null then null
    else (c.end_date - current_date)::int
  end as days_to_expiry,
  case
    when c.end_date <= current_date + interval '30 days' then '30'
    when c.end_date <= current_date + interval '60 days' then '60'
    when c.end_date <= current_date + interval '90 days' then '90'
    else '90+'
  end as bucket
from contracts c
left join organizations o on o.id = c.client_org_id
left join sites s on s.id = c.site_id
where c.is_active = true and c.status = 'active';
