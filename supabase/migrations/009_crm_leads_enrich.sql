-- ============================================================
-- GateGuard CRM — Migration 009: Enrich show_leads table
-- Adds fields so the leads API doesn't need hardcoded strings
-- ============================================================

alter table show_leads add column if not exists source       text default 'show';
alter table show_leads add column if not exists city         text default 'Atlanta';
alter table show_leads add column if not exists state        text default 'GA';
alter table show_leads add column if not exists property_type text default 'Multifamily';
alter table show_leads add column if not exists contact_title text default 'Property Manager';
alter table show_leads add column if not exists units        integer;
alter table show_leads add column if not exists notes        text;

-- Backfill existing rows
update show_leads set source = 'show' where source is null;
update show_leads set city = 'Atlanta' where city is null;
update show_leads set state = 'GA' where state is null;
update show_leads set property_type = 'Multifamily' where property_type is null;
update show_leads set contact_title = 'Property Manager' where contact_title is null;
