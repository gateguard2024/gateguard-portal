# One-Master-Database Consolidation Plan

_June 23, 2026. Decision: **the Nexus Supabase project is the single master.** `gateguard-web` currently runs on a **separate** Supabase project; its data + code get migrated onto Nexus, then the old project is retired._

---

## What lives in gateguard-web's Supabase today (the thing to absorb)

| Table | Used by | Columns in use | Lands in Nexus as |
|---|---|---|---|
| `properties` | `/portal` (client portal) | id, name, rms_data, brivo_iframe_url, eagleeye_url, gate_status, maintainx_location_id, qbo_customer_id, manager_user_id | **`sites`** (+ new columns) |
| `receivables` | `/investor`, `/admin` | invoice_date, client_name, amount | `receivables` (recreate in Nexus) |
| `ledgers` | `/investor`, `/admin` | (combined ledger rows) | `ledgers` (recreate in Nexus) |
| `core_metrics` | `/investor`, `/admin` | id=1, base_cash | `core_metrics` (recreate in Nexus) |
| work orders | `/portal` "Request Service" | — (MaintainX, not Supabase) | **`work_orders`** (replaces MaintainX) |

## Field mapping: `properties` → Nexus `sites`

| gateguard-web `properties` | Nexus `sites` | Action |
|---|---|---|
| `name` | `name` | direct |
| `manager_user_id` (Clerk id) | `pm_email` + a new `manager_user_id` | add column; **depends on same Clerk instance** |
| `rms_data` (jsonb) | **new** `rms_data jsonb` | add column |
| `brivo_iframe_url` | **new** `brivo_iframe_url` | add column (Nexus also has the per-site creds vault) |
| `eagleeye_url` | **new** `eagleeye_url` | add column |
| `gate_status` | **new** `gate_status text` | add column |
| `qbo_customer_id` | **new** `qbo_customer_id` | add column |
| `maintainx_location_id` | — | **drop** (MaintainX retired) |
| — | `org_id` (required) | **must assign** each property to an organization |

---

## Phased sequence (safe order — nothing deletes until verified)

**Phase 0 — Snapshots.** PITR/snapshot BOTH Supabase projects before anything.

**Phase 1 — Prepare the Nexus master (additive only).**
- Migration: `ALTER TABLE sites ADD COLUMN` for `rms_data`, `brivo_iframe_url`, `eagleeye_url`, `gate_status`, `qbo_customer_id`, `manager_user_id` (all nullable).
- Migration: `CREATE TABLE receivables`, `ledgers`, `core_metrics` (mirror web's shape) **with GRANT blocks** (per Nexus migration rule).

**Phase 2 — Move the data (web project → Nexus project).**
- Export `properties` → upsert into Nexus `sites`, matching existing sites by name/address where possible; assign `org_id` for each (mapping table needed).
- Export `receivables` / `ledgers` / `core_metrics` → load into the new Nexus tables as-is.

**Phase 3 — Repoint gateguard-web to the Nexus project (code + env).**
- Swap `NEXT_PUBLIC_SUPABASE_URL` / keys in the gateguard-web Vercel project to the Nexus project.
- Code: `properties` → `sites`; investor/admin keep `receivables`/`ledgers`/`core_metrics` (now in Nexus).
- "Request Service" form: POST to a Nexus endpoint that inserts a `work_orders` row (with `site_id` + `org_id`) instead of MaintainX. Remove `/api/maintainx*`.

**Phase 4 — Verify.**
- Client `/portal`: property loads, RMS form saves, **service request creates a real `work_orders` row** → appears in Nexus Operations Hub **and `/tech`**.
- `/investor` + `/admin`: financials read correctly from Nexus.

**Phase 5 — Retire.** Once green for a few days, decommission the old gateguard-web Supabase project (after a final export).

---

## Dependencies to confirm before Phase 2

1. **Clerk instance parity.** `properties.manager_user_id` is a Clerk user id. If gateguard-web and Nexus use **different Clerk projects**, those ids won't resolve in Nexus — property managers would need re-mapping. _Confirm: same Clerk instance?_
2. **Org assignment.** Each `properties` row needs an `org_id` (which organization owns it). Need a property→org mapping (likely 1 corporate org to start).
3. **Financials home.** Keep `receivables`/`ledgers`/`core_metrics` as standalone tables (fastest, zero UI change), or fold into Nexus `invoices` later (more work). Recommend: **migrate as-is now**, refactor later.

## End state
- One Supabase project. One `work_orders` table. `/tech` shows every job — client-submitted or dealer-dispatched.
- One `sites` table powering both the dealer view and the client portal.
- MaintainX removed. Old web Supabase retired.
