-- Migration 066: Add contact/location columns to organizations table
-- Fixes "Could not find the 'email' column" error on dealer onboarding wizard.
-- The onboard-dealer API inserts: email, phone, website, address, city, state, zip
-- These columns were referenced in code but never added to the table schema.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS email    text,
  ADD COLUMN IF NOT EXISTS phone    text,
  ADD COLUMN IF NOT EXISTS website  text,
  ADD COLUMN IF NOT EXISTS address  text,
  ADD COLUMN IF NOT EXISTS city     text,
  ADD COLUMN IF NOT EXISTS state    text,
  ADD COLUMN IF NOT EXISTS zip      text;

-- Note: contact_name, contact_email, contact_phone already exist (from earlier migrations)
-- These new columns are the org-level contact fields (not the primary contact person fields)
