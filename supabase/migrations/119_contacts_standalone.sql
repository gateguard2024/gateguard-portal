-- Migration 119: contacts are people, not owned by a single org.
-- A contact can relate to many sites/companies (M:N), so org_id must be optional.
ALTER TABLE contacts ALTER COLUMN org_id DROP NOT NULL;
