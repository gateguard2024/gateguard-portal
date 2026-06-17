-- ════════════════════════════════════════════════════════════════════════════
-- Migration 120 — Contacts ⇄ records (many-to-many)
-- A contact can be attached to many leads / opportunities / customers / jobs /
-- dealers / sites, and each of those can have many contacts. One polymorphic
-- junction table powers "add/remove contact" on every record.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.contact_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,                 -- lead | opportunity | customer | dealer | job | site
  entity_id   UUID NOT NULL,
  role        TEXT,                          -- e.g. 'Billing', 'Site Manager', 'Agent'
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.contact_links TO postgres, anon, authenticated, service_role;

-- One link per (contact, record); fast lookups both directions.
CREATE UNIQUE INDEX IF NOT EXISTS contact_links_uniq ON public.contact_links (contact_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS contact_links_entity_idx ON public.contact_links (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS contact_links_contact_idx ON public.contact_links (contact_id);
