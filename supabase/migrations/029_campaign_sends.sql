-- Migration 029: campaign_sends — tracks every email sent per lead per campaign
-- Enables: sent/failed logging, Resend open-tracking via webhook, per-lead status in CRM

create table if not exists campaign_sends (
  id                uuid        primary key default gen_random_uuid(),
  show_lead_id      uuid        references show_leads(id) on delete cascade,
  lead_email        text        not null,
  lead_name         text,
  campaign_name     text        not null default 'show_follow_up',
  status            text        not null default 'sent',   -- sent | failed | skipped
  resend_message_id text,                                  -- Resend email ID for webhook matching
  error_message     text,                                  -- populated on failure
  sent_at           timestamptz default now(),
  delivered_at      timestamptz,
  opened_at         timestamptz,                           -- first open
  open_count        int         not null default 0,
  clicked_at        timestamptz,
  bounced_at        timestamptz,
  complained_at     timestamptz,
  created_at        timestamptz default now()
);

-- Index for webhook lookups by Resend message ID
create index if not exists campaign_sends_resend_id_idx
  on campaign_sends (resend_message_id)
  where resend_message_id is not null;

-- Index for lead lookups (CRM lead detail page)
create index if not exists campaign_sends_lead_idx
  on campaign_sends (show_lead_id);

-- Index for campaign overview
create index if not exists campaign_sends_campaign_idx
  on campaign_sends (campaign_name, sent_at desc);

-- RLS
alter table campaign_sends enable row level security;

create policy "service_role_all" on campaign_sends
  for all to service_role using (true) with check (true);
