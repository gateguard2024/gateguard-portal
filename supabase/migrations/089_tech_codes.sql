-- Migration 089: Per-tech and per-dealer access codes for /tech field tool
-- Replaces single shared TECH_ACCESS_CODE env var with per-entity codes
-- Falls back to global env var for backward compatibility

-- Add tech_code to technicians table
ALTER TABLE technicians
  ADD COLUMN IF NOT EXISTS tech_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS tech_code_generated_at timestamptz;

-- Add tech_code to organizations (for per-dealer codes)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS tech_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS tech_code_generated_at timestamptz;

-- Index for fast lookup (x-tech-code header validation is hot path)
CREATE INDEX IF NOT EXISTS idx_technicians_tech_code ON technicians(tech_code) WHERE tech_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_tech_code ON organizations(tech_code) WHERE tech_code IS NOT NULL;

-- RLS: service role can read/write (API routes use service role key)
-- Technicians table already has RLS enabled from earlier migrations
-- Organizations table already has RLS enabled from migration 017

-- Helper function: generate a readable 8-char alphanumeric code (no ambiguous chars)
-- Characters: A-Z 0-9 excluding O, 0, I, 1, L for readability
CREATE OR REPLACE FUNCTION generate_tech_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
  rand_idx integer;
BEGIN
  FOR i IN 1..8 LOOP
    rand_idx := floor(random() * length(chars))::integer + 1;
    result := result || substr(chars, rand_idx, 1);
  END LOOP;
  RETURN result;
END;
$$;
