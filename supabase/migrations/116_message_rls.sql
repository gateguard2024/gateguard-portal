-- Migration 116: Row-Level Security for the Message Center tables
--
-- Locks message_channels / message_threads / messages to the owning user at the
-- database layer. Ownership is keyed on the Clerk user id carried in the Supabase
-- JWT `sub` claim (same convention as 095_message_center and the rest of the app).
--
-- Idempotent: enabling RLS is safe to re-run, and every policy is dropped first so
-- this works whether the tables came from 095_message_center or 115_message_connectors.
--
-- NOTE ON SERVER ROUTES: /api/nexus/messages/* use the service-role key, which
-- intentionally bypasses RLS — those handlers do their own ownership checks
-- (.eq('user_id', user.id)). These policies are the enforcement layer for any
-- direct anon/authenticated (Clerk-JWT) access from the client.

-- ─── message_channels ─────────────────────────────────────────────────────────
alter table public.message_channels enable row level security;
drop policy if exists "Users manage own channels" on public.message_channels;
create policy "Users manage own channels"
  on public.message_channels
  for all
  using      (user_id = (auth.jwt() ->> 'sub'))
  with check (user_id = (auth.jwt() ->> 'sub'));

-- ─── message_threads ──────────────────────────────────────────────────────────
alter table public.message_threads enable row level security;
drop policy if exists "Users manage own threads" on public.message_threads;
create policy "Users manage own threads"
  on public.message_threads
  for all
  using      (user_id = (auth.jwt() ->> 'sub'))
  with check (user_id = (auth.jwt() ->> 'sub'));

-- ─── messages (scoped through owning thread) ───────────────────────────────────
alter table public.messages enable row level security;
drop policy if exists "Users manage own messages" on public.messages;
create policy "Users manage own messages"
  on public.messages
  for all
  using (
    exists (
      select 1 from public.message_threads mt
      where mt.id = messages.thread_id
        and mt.user_id = (auth.jwt() ->> 'sub')
    )
  )
  with check (
    exists (
      select 1 from public.message_threads mt
      where mt.id = messages.thread_id
        and mt.user_id = (auth.jwt() ->> 'sub')
    )
  );
