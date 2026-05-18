-- GateGuard OS — Migration 023: Personal & Assignable Todos
-- Supports: personal todos (assigned_to = null), assigned todos (to another user),
-- optional link to a WO / site / lead / opportunity / customer.

create table if not exists todos (
  id            uuid primary key default gen_random_uuid(),

  -- Content
  title         text not null,
  body          text,                          -- optional notes / description
  priority      text not null default 'normal'
                  check (priority in ('high', 'normal', 'low')),
  status        text not null default 'open'
                  check (status in ('open', 'in_progress', 'done')),
  due_date      date,

  -- Ownership
  org_id        uuid references organizations(id) on delete cascade,
  created_by    text not null,                -- Clerk user ID
  created_by_name text,                       -- denormalized display name
  assigned_to   text,                         -- Clerk user ID (null = personal/unassigned)
  assigned_to_name text,                      -- denormalized display name

  -- Optional link to another record
  linked_type   text check (linked_type in ('work_order','site','lead','opportunity','customer')),
  linked_id     uuid,
  linked_label  text,                         -- human-readable label for the linked record

  -- Timestamps
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS: service role only (API handles all auth scoping)
alter table todos enable row level security;
create policy "service_role_all_todos"
  on todos using (true) with check (true);

-- Indexes
create index if not exists idx_todos_created_by  on todos(created_by);
create index if not exists idx_todos_assigned_to on todos(assigned_to) where assigned_to is not null;
create index if not exists idx_todos_org         on todos(org_id) where org_id is not null;
create index if not exists idx_todos_status      on todos(status);
create index if not exists idx_todos_due_date    on todos(due_date) where due_date is not null;
