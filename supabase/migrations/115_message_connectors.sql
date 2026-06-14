-- Migration 115: Message Connectors — ensure Message Center foundation + Data API grants
--
-- The message center schema was authored in 095_message_center.sql (message_channels,
-- message_threads, messages). Its deploy status is uncertain and it shipped without the
-- GRANT blocks that Supabase enforces from Oct 30 2026. This migration is idempotent:
-- it guard-creates the enums + tables if missing and (re)applies the required grants,
-- so the Messages connectors (SMTP + Gmail) have a guaranteed backing schema on any env.

-- ─── Enums (guarded — no-op if 095 already created them) ──────────────────────
do $$ begin
  create type channel_type as enum ('gmail', 'smtp', 'caldav', 'phone', 'twilio', 'internal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_status as enum ('pending', 'sent', 'delivered', 'failed', 'read');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_source as enum ('gmail', 'smtp', 'caldav', 'sms', 'twilio', 'internal');
exception when duplicate_object then null; end $$;

-- ─── message_channels ─────────────────────────────────────────────────────────
create table if not exists public.message_channels (
  id                  uuid primary key default gen_random_uuid(),
  user_id             text not null,
  org_id              text,
  channel_type        channel_type not null,
  display_name        text not null,
  is_active           boolean not null default true,
  oauth_access_token  text,
  oauth_refresh_token text,
  oauth_expiry        timestamptz,
  oauth_scope         text,
  config              jsonb not null default '{}'::jsonb,
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_message_channels_user on public.message_channels (user_id);
create index if not exists idx_message_channels_org  on public.message_channels (org_id);
create index if not exists idx_message_channels_type on public.message_channels (channel_type);

-- ─── message_threads ──────────────────────────────────────────────────────────
create table if not exists public.message_threads (
  id                  uuid primary key default gen_random_uuid(),
  org_id              text,
  user_id             text not null,
  channel_id          uuid references public.message_channels(id) on delete cascade,
  external_thread_id  text,
  subject             text,
  participants        jsonb not null default '[]'::jsonb,
  linked_wo_id        uuid references public.work_orders(id) on delete set null,
  linked_quote_id     uuid references public.quotes(id) on delete set null,
  linked_site_id      uuid references public.sites(id) on delete set null,
  linked_calendar_event_id text,
  last_message_at     timestamptz,
  unread_count        int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_message_threads_user     on public.message_threads (user_id);
create index if not exists idx_message_threads_org      on public.message_threads (org_id);
create index if not exists idx_message_threads_channel  on public.message_threads (channel_id);
create index if not exists idx_message_threads_last_msg on public.message_threads (last_message_at desc);

-- ─── messages ─────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id                  uuid primary key default gen_random_uuid(),
  thread_id           uuid not null references public.message_threads(id) on delete cascade,
  channel_id          uuid references public.message_channels(id) on delete set null,
  external_message_id text,
  direction           message_direction not null,
  source_type         message_source not null,
  from_address        text not null,
  from_name           text,
  to_addresses        jsonb not null default '[]'::jsonb,
  subject             text,
  body                text not null default '',
  body_html           text,
  attachments         jsonb not null default '[]'::jsonb,
  status              message_status not null default 'pending',
  sent_at             timestamptz,
  read_at             timestamptz,
  error_message       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_messages_thread    on public.messages (thread_id, created_at desc);
create index if not exists idx_messages_channel   on public.messages (channel_id);
create index if not exists idx_messages_direction on public.messages (direction);
create index if not exists idx_messages_status    on public.messages (status);

-- ─── Grant Data API access (required — Supabase enforces this Oct 30 2026) ─────
-- The connector + send routes use the service-role key, which bypasses RLS; these
-- grants keep the tables reachable via PostgREST/GraphQL/supabase-js after enforcement.
GRANT ALL ON TABLE public.message_channels TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.message_threads  TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.messages         TO postgres, anon, authenticated, service_role;
