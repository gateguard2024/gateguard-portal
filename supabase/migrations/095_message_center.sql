-- Migration 095: Message Center
-- Tables: message_channels, message_threads, messages
-- All user-scoped with RLS. Threads linkable to WOs, quotes, sites, calendar events.

-- ─── Enums ────────────────────────────────────────────────────────────────────

create type channel_type as enum ('gmail', 'smtp', 'caldav', 'phone', 'twilio', 'internal');
create type message_direction as enum ('inbound', 'outbound');
create type message_status as enum ('pending', 'sent', 'delivered', 'failed', 'read');
create type message_source as enum ('gmail', 'smtp', 'caldav', 'sms', 'twilio', 'internal');

-- ─── message_channels ─────────────────────────────────────────────────────────

create table public.message_channels (
  id                  uuid primary key default gen_random_uuid(),
  user_id             text not null,                -- Clerk user_id
  org_id              text,                         -- Clerk org_id (optional)
  channel_type        channel_type not null,
  display_name        text not null,
  is_active           boolean not null default true,

  -- OAuth (Gmail, Google Calendar CalDAV)
  oauth_access_token  text,
  oauth_refresh_token text,
  oauth_expiry        timestamptz,
  oauth_scope         text,

  -- Generic config (SMTP host/port/user, Twilio SID, phone number, CalDAV server URL)
  config              jsonb not null default '{}'::jsonb,

  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.message_channels enable row level security;

create policy "Users manage own channels"
  on public.message_channels
  for all
  using (user_id = (auth.jwt() ->> 'sub'));

create index idx_message_channels_user    on public.message_channels (user_id);
create index idx_message_channels_org     on public.message_channels (org_id);
create index idx_message_channels_type    on public.message_channels (channel_type);

-- ─── message_threads ──────────────────────────────────────────────────────────

create table public.message_threads (
  id                  uuid primary key default gen_random_uuid(),
  org_id              text,
  user_id             text not null,                -- owner / initiator
  channel_id          uuid references public.message_channels(id) on delete cascade,
  external_thread_id  text,                         -- ID in source system (Gmail thread, etc.)
  subject             text,
  participants        jsonb not null default '[]'::jsonb,  -- [{name, address}]

  -- Optional object links
  linked_wo_id        uuid references public.work_orders(id) on delete set null,
  linked_quote_id     uuid references public.quotes(id) on delete set null,
  linked_site_id      uuid references public.sites(id) on delete set null,
  linked_calendar_event_id text,                    -- gcal event ID

  last_message_at     timestamptz,
  unread_count        int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.message_threads enable row level security;

create policy "Users manage own threads"
  on public.message_threads
  for all
  using (user_id = (auth.jwt() ->> 'sub'));

create index idx_message_threads_user      on public.message_threads (user_id);
create index idx_message_threads_org       on public.message_threads (org_id);
create index idx_message_threads_channel   on public.message_threads (channel_id);
create index idx_message_threads_last_msg  on public.message_threads (last_message_at desc);
create index idx_message_threads_wo        on public.message_threads (linked_wo_id) where linked_wo_id is not null;
create index idx_message_threads_quote     on public.message_threads (linked_quote_id) where linked_quote_id is not null;

-- ─── messages ─────────────────────────────────────────────────────────────────

create table public.messages (
  id                  uuid primary key default gen_random_uuid(),
  thread_id           uuid not null references public.message_threads(id) on delete cascade,
  channel_id          uuid references public.message_channels(id) on delete set null,
  external_message_id text,                         -- ID in source system

  direction           message_direction not null,
  source_type         message_source not null,

  from_address        text not null,                -- email, phone number, or Clerk user_id
  from_name           text,
  to_addresses        jsonb not null default '[]'::jsonb,  -- [{name, address}]

  subject             text,
  body                text not null default '',
  body_html           text,
  attachments         jsonb not null default '[]'::jsonb,  -- [{name, url, size, mime_type}]

  status              message_status not null default 'pending',
  sent_at             timestamptz,
  read_at             timestamptz,
  error_message       text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Users manage own messages"
  on public.messages
  for all
  using (
    exists (
      select 1 from public.message_threads mt
      where mt.id = messages.thread_id
        and mt.user_id = (auth.jwt() ->> 'sub')
    )
  );

create index idx_messages_thread      on public.messages (thread_id, created_at desc);
create index idx_messages_channel     on public.messages (channel_id);
create index idx_messages_direction   on public.messages (direction);
create index idx_messages_status      on public.messages (status);
create index idx_messages_external_id on public.messages (external_message_id) where external_message_id is not null;

-- ─── updated_at triggers ──────────────────────────────────────────────────────

create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_message_channels_updated
  before update on public.message_channels
  for each row execute function update_updated_at_column();

create trigger trg_message_threads_updated
  before update on public.message_threads
  for each row execute function update_updated_at_column();

create trigger trg_messages_updated
  before update on public.messages
  for each row execute function update_updated_at_column();

-- ─── auto-update thread.last_message_at on insert ─────────────────────────────

create or replace function sync_thread_last_message()
returns trigger language plpgsql as $$
begin
  update public.message_threads
  set last_message_at = new.created_at,
      unread_count = case
        when new.direction = 'inbound' then unread_count + 1
        else unread_count
      end
  where id = new.thread_id;
  return new;
end;
$$;

create trigger trg_messages_sync_thread
  after insert on public.messages
  for each row execute function sync_thread_last_message();
