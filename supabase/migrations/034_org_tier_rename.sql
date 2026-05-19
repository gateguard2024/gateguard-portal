-- ============================================================
-- GateGuard OS — Migration 034: Rename organizations.tier → org_tier
--
-- The original schema named the column `tier` but all API code
-- (current-user.ts, org-scope.ts, customers/route.ts, etc.) queries
-- it as `org_tier`. This migration aligns the DB column name with
-- the codebase convention so the Customers page stops returning
-- {"error":"column organizations.org_tier does not exist"}.
--
-- Also adds missing contact columns that the API already expects.
-- ============================================================

-- ============================================================
-- PART 1 — Rename tier → org_tier
-- ============================================================
do $$ begin
  alter table organizations rename column tier to org_tier;
exception when others then
  -- Column already renamed — idempotent
  null;
end $$;

-- ============================================================
-- PART 2 — Add missing contact / profile columns
-- (safe to run even if migration 017 already ran)
-- ============================================================
alter table organizations
  add column if not exists primary_contact_name  text,
  add column if not exists primary_contact_email text,
  add column if not exists primary_contact_phone text;

-- ============================================================
-- PART 3 — Ensure is_active, parent_org_id, master_dealer_id,
--          master_agent_id exist (017 may not have run on all
--          Supabase projects yet)
-- ============================================================
alter table organizations
  add column if not exists is_active         boolean not null default true,
  add column if not exists parent_org_id     uuid references organizations(id) on delete set null,
  add column if not exists master_dealer_id  uuid references organizations(id) on delete set null,
  add column if not exists master_agent_id   uuid references organizations(id) on delete set null;

-- Indexes (idempotent)
create index if not exists idx_orgs_org_tier      on organizations(org_tier);
create index if not exists idx_orgs_is_active     on organizations(is_active);
create index if not exists idx_orgs_parent_org    on organizations(parent_org_id)    where parent_org_id   is not null;
create index if not exists idx_orgs_master_dealer on organizations(master_dealer_id) where master_dealer_id is not null;
create index if not exists idx_orgs_master_agent  on organizations(master_agent_id)  where master_agent_id  is not null;
