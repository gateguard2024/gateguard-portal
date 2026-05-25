-- Migration 089: api_credentials JSONB on organizations
-- Stores per-org Eagle Eye / Brivo / UniFi / custom API credentials

alter table public.organizations
  add column if not exists api_credentials jsonb default '{}' ::jsonb;

comment on column public.organizations.api_credentials is
  'Per-org API credentials: {een:{api_key,account_id,subdomain}, brivo:{client_id,client_secret,api_key}, unifi:{host,username,password,site_id}, custom:[{name,api_key,url,notes}]}';
