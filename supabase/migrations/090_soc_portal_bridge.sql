-- Migration 090: SOC → Portal incident bridge
-- Adds EEN/Brivo account IDs to sites for cross-system site matching,
-- and extends incidents with SOC provenance fields.

-- ── Sites: add hardware account IDs for GGSOC lookup ─────────────────────────
alter table public.sites
  add column if not exists een_account_id  text,
  add column if not exists brivo_account_id text;

create index if not exists sites_een_account_id_idx
  on public.sites(een_account_id)
  where een_account_id is not null;

create index if not exists sites_brivo_account_id_idx
  on public.sites(brivo_account_id)
  where brivo_account_id is not null;

-- ── Incidents: SOC provenance columns ────────────────────────────────────────
alter table public.incidents
  add column if not exists source         text default 'manual'
    check (source in ('manual', 'soc_alarm', 'soc_patrol')),
  add column if not exists source_id      text,     -- GGSOC alarm.id or patrol_log.id
  add column if not exists soc_event_type text,     -- alarm event_type (e.g. "MOTION_ALERT")
  add column if not exists soc_priority   text,     -- P1 / P2 / P3 / P4
  add column if not exists soc_operator   text,     -- operator who resolved
  add column if not exists soc_action     text;     -- action_taken value

-- Unique constraint prevents duplicate ingest if GGSOC retries
create unique index if not exists incidents_source_id_unique
  on public.incidents(source_id)
  where source_id is not null;

comment on column public.incidents.source     is 'manual | soc_alarm | soc_patrol';
comment on column public.incidents.source_id  is 'GGSOC alarm.id or patrol_log.id — deduplication key';
comment on column public.incidents.soc_priority is 'P1=critical P2=high P3=medium P4=low';
