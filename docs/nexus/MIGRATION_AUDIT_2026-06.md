# Nexus Database / Migration Audit — June 2026

Goal: eliminate fragmented data. Every feature should point at **one** canonical
table; dead tables get removed. Method: enumerated all `CREATE TABLE`s across the
130 migrations vs. every `.from()`, `.rpc()`, and realtime channel in the code,
then diffed.

**Headline:** there is only **one Supabase project** — every client uses the same
`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (270 clients checked, no
alternate `*.supabase.co` URLs). So the fragmentation was **table-level**, not
multiple databases. The beta/prod split is intentional and unchanged.

142 tables created · 6 phantom references · ~22 dead tables · 2 real fragmentations.

---

## 1. Critical bug fixed — the AI assistant was writing to tables that don't exist

The Nexus assistant + inbound-email matcher wrote leads/opps to **`crm_leads`** and
**`crm_opportunities`**, which **were never created by any migration**. So every
lead or opportunity the assistant "created," and email→lead matching, silently went
nowhere. Repointed to the canonical `leads` / `opportunities` (with correct column
mapping — `leads` uses `contact_name`/`company_name`, `opportunities` uses `amount`).

| Was (phantom) | Now (canonical) | Files |
|---|---|---|
| `crm_leads` | `leads` | lib/assistant-executor.ts, app/api/assistant/chat, app/api/crm/email/inbound |
| `crm_opportunities` | `opportunities` | lib/assistant-executor.ts, app/api/assistant/chat |
| `commission_configs` (typo) | `commission_config` | app/api/admin/create-draft-dealer |

## 2. Activity logging unified → `crm_activities`

Activity was split across `activities` (org-scoped, written by some Nexus flows) and
`crm_activities` (what the unified ActivityTimeline + CRM detail actually read). All
9 references repointed to **`crm_activities`**, which migration 133 makes a superset
(adds `dealer_org_id`, `created_by`, `contact_id`, `company_id`, `customer_id`) and
copies existing `activities` rows into. `activities` is dropped in 134.

## 3. Dead code removed

`lib/credits.ts` targeted a non-existent `credit_wallets` table and was imported
nowhere — tombstoned. The live credits system is the ARIA ledger
(`credit_balances` / `credit_transactions` / `credit_packages` + RPCs).

## 4. Verified NOT fragmentation (left alone)

- **`manuals`** — a Supabase **Storage bucket** (`.storage.from('manuals')`), not a table. Fine.
- **`permits_with_status`** — a **view** (migration 018). Fine.
- **`companies` / `contacts` / `contact_links`** — live, wired into Nexus search + lead/opp windows. Kept.

## 5. Dead tables — dropped in migration 134 (run after snapshot)

Zero code references anywhere.

**Superseded:** `activities`→crm_activities · `devices`→site_assets ·
`esign_documents`→document_signatures · `parts_inventory`→inventory_items ·
`sensitive_fields` · `contact_properties`→contact_links · `org_contacts`→contacts ·
`show_lead_assignments`.

**Feature scaffolding never wired:** `service_catalog`, `dealer_service_enrollments`,
`site_service_subscriptions`, `dealer_add_ons`, `dealer_tier_points`,
`dealer_scorecards`, `tech_achievements`, `quests`, `quest_progress`, `rma_records`,
`mgmt_isp_portfolio`, `floor_plan_annotations`, `floor_plan_connections`,
`tracker_dashboards`.

> ⚠️ `quests`/`quest_progress` back a /quests UI that currently uses no DB — drop
> unless you plan to wire it soon (comment out those lines in 134 if so).

---

## How to run

1. **Snapshot first** (Supabase → Database → Backups / PITR checkpoint).
2. Beta Supabase: run **133** then **134**. Smoke-test: create a lead via the
   assistant, log an activity on a lead + opportunity, convert a lead → opp.
3. If clean, run **133** then **134** on prod.

All code changes are already on `beta` and tsc-clean — they work whether or not
133/134 have run yet (the repointed tables all pre-exist).
