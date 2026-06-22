-- ============================================================================
-- Migration 134 — DROP dead / orphaned tables (migration audit, June 2026)
-- ============================================================================
-- ⚠️  DESTRUCTIVE.  TAKE A SUPABASE SNAPSHOT / PITR CHECKPOINT BEFORE RUNNING.
--     (Supabase Dashboard → Database → Backups, or pg_dump the public schema.)
--     Run on BETA first, verify the app, THEN run on PROD.
--
-- Every table below was confirmed to have ZERO references in the application
-- code (no `.from('table')`, no realtime channel, no RPC). They are either
-- superseded by a live table or belong to features that were never wired up.
-- We cut aggressively per direction — restore individual tables from the
-- snapshot if any turns out to be needed.
--
-- CASCADE is used so dependent FK constraints/objects are removed cleanly.
-- ============================================================================

BEGIN;

-- ── Section A — Superseded by a live table ─────────────────────────────────
DROP TABLE IF EXISTS public.activities             CASCADE;  -- → crm_activities (migration 133 copied rows first)
DROP TABLE IF EXISTS public.devices                CASCADE;  -- → site_assets
DROP TABLE IF EXISTS public.esign_documents        CASCADE;  -- → document_signatures + document_templates
DROP TABLE IF EXISTS public.parts_inventory        CASCADE;  -- → inventory_items
DROP TABLE IF EXISTS public.sensitive_fields       CASCADE;  -- only sensitive_field_access_log is used
DROP TABLE IF EXISTS public.contact_properties     CASCADE;  -- → contact_links (M:N junction)
DROP TABLE IF EXISTS public.show_lead_assignments  CASCADE;  -- legacy show_leads system (leads is canonical)

-- ── Section A2 — Legacy parallel CRM model (retired June 2026; never written to) ──
-- Code in customers-sites search/detail, money-docs compliance/renewals, and the
-- lead/opp windows was repointed to organizations + sites + contacts.
DROP TABLE IF EXISTS public.companies          CASCADE;  -- → organizations (the account/tenant hierarchy)
DROP TABLE IF EXISTS public.customers          CASCADE;  -- → organizations + site lifecycle
DROP TABLE IF EXISTS public.properties         CASCADE;  -- → sites (the canonical property table)
DROP TABLE IF EXISTS public.company_properties CASCADE;  -- junction for the retired companies/properties
-- NOTE: org_contacts is intentionally KEPT — it still backs /api/customers/[id]/contacts.
--       Merging org_contacts → contacts is a separate follow-up.

-- ── Section B — Feature scaffolding that was never wired to any code ────────
-- If you intend to build any of these soon, comment out that line instead.
DROP TABLE IF EXISTS public.service_catalog            CASCADE;  -- Service Marketplace (never wired)
DROP TABLE IF EXISTS public.dealer_service_enrollments CASCADE;  -- Service Marketplace
DROP TABLE IF EXISTS public.site_service_subscriptions CASCADE;  -- Service Marketplace
DROP TABLE IF EXISTS public.dealer_add_ons             CASCADE;
DROP TABLE IF EXISTS public.dealer_tier_points         CASCADE;
DROP TABLE IF EXISTS public.dealer_scorecards          CASCADE;  -- training_progress is the live one
DROP TABLE IF EXISTS public.tech_achievements          CASCADE;
DROP TABLE IF EXISTS public.quests                     CASCADE;  -- /quests UI never persisted to a table
DROP TABLE IF EXISTS public.quest_progress             CASCADE;
DROP TABLE IF EXISTS public.rma_records                CASCADE;
DROP TABLE IF EXISTS public.mgmt_isp_portfolio         CASCADE;
DROP TABLE IF EXISTS public.floor_plan_annotations     CASCADE;  -- Fabric.js canvas persists differently
DROP TABLE IF EXISTS public.floor_plan_connections     CASCADE;
DROP TABLE IF EXISTS public.tracker_dashboards         CASCADE;

COMMIT;
