# Hierarchy, Users & Permissions — Database & Code Audit

> Pulled from the live migrations, `docs/nexus/SUPABASE_SCHEMA.json`, and the enforcement code on `beta` (June 14, 2026). This is a **factual inventory of what exists today** — not the target design. The target design lives in `DEALER_HIERARCHY_AND_PERMISSIONS.md`.

---

## 0. The Three Layers That Govern Access

GateGuard's access model is spread across three systems. Any work on hierarchy/permissions touches all three.

| Layer | Where it lives | What it controls |
|---|---|---|
| **Identity** | Clerk `publicMetadata` (`org_id`, `org_tier`, `role`) | Who the user is, which org they belong to, coarse role |
| **Hierarchy / data scope** | `organizations` table + `get_org_subtree()` RPC + `lib/org-scope.ts` | Which org's *records* a user can see |
| **Feature permissions** | `feature_catalog` → `org_feature_flags` → `user_feature_access` | Which *pages/modules* a user can see and whether view-only or edit |

The governing rule (from the design doc): **a user/dealer can never get more access than its parent org.**
`requested_user_access ≤ org_access ≤ parent_org_access`.

---

## 1. Organization Hierarchy

### 1a. `organizations` table — actual columns

Base table (migration `001`) plus columns added by `017`, `034`, `096`:

| Column | Type | Source | Notes |
|---|---|---|---|
| `id` | uuid PK | 001 | |
| `name` | text | 001 | |
| **`org_tier`** | `org_tier` enum | 001 as `tier`, **renamed in 034** | The tier. See enum below. |
| `parent_id` | uuid → organizations.id | 001 | **Original** parent pointer. Still used by `get_org_subtree()`. |
| `parent_org_id` | uuid → organizations.id | **017** | Newer parent pointer used by onboarding + assignable-orgs. |
| `master_agent_id` | uuid → organizations.id | 017 | Which master agent oversees this org. |
| `master_dealer_id` | uuid → organizations.id | 017 | Which MSO/master dealer this org belongs to. |
| `is_active` | boolean (default true) | 017 / 034 | |
| `onboarding_complete` | boolean (default false) | 017 | Gates dealer activation. |
| `entity_type` | text | 096 | Legal entity (LLC, Corp, S-Corp, Sole Prop, etc.) |
| `slug`, `logo_url`, `primary_color`, `status` | | 001 | White-label / status |
| `primary_email/phone`, `address`, `city`, `state`, `zip` | | 001 | |
| `primary_contact_name/email/phone` | text | 034 | |
| `eagleeye_account_id`, `brivo_account_id`, `brivo_site_id`, `quickbooks_realm_id` | text | 001 | Integration IDs |
| `notes`, `created_at`, `updated_at` | | 001 | |

> ⚠️ **Schema-doc is stale here.** `docs/nexus/SUPABASE_SCHEMA.json` (generated 2026-06-03) still shows the *original* `001` definition — `tier` (not `org_tier`), only `parent_id`, no `master_*_id`/`is_active`/`onboarding_complete`/`entity_type`. The live DB has the renamed/added columns from 017/034/096. Trust the migrations, not the JSON, for `organizations`.

> ⚠️ **Two parent columns exist.** `parent_id` (original) and `parent_org_id` (017). `get_org_subtree()` walks **`parent_id`**, while onboarding and `assignable-orgs` filter on **`parent_org_id` / `master_dealer_id` / `master_agent_id`**. These can diverge if a row sets one but not the other — a known cleanup item.

### 1b. `org_tier` enum — current allowed values

Originally 5 tiers (001), expanded to the full model in `017`:

```
corporate            (001, tier 0 — GateGuard HQ)
mso                  (001 — legacy, superseded by master_dealer)
dealer               (001 — legacy, superseded by full_dealer)
partner              (001 — legacy)
client               (001)
master_agent         (017)
master_dealer        (017)  ← UI label: "MSO / Master Dealer"
full_dealer          (017)
service_dealer       (017)
install_contractor   (017)
sales_partner        (017)
```

Enum values can only be **added**, never removed, so the legacy `mso`/`dealer`/`partner` values still exist in the type. New code uses the 017 set. `lib/current-user.ts` `OrgTier` type only lists the 8 canonical tiers (corporate, master_agent, master_dealer, full_dealer, service_dealer, install_contractor, sales_partner, client).

### 1c. Tier rank (from `onboard-dealer/route.ts`)

Used to enforce "you can only create tiers below your own":

```
corporate          0
master_agent       1
master_dealer      2
full_dealer        3
service_dealer     4
install_contractor 4
sales_partner      4
client             5
```

### 1d. Seeded corporate org

`001` seeds `GateGuard, LLC` (`corporate`, id `00000000-…-0001`). `072` adds an idempotent guard that ensures *a* corporate org always exists. After seeding, `GET /api/admin/setup-corporate` stamps the corporate UUID into the admin's Clerk `publicMetadata.org_id`.

### 1e. Commission hierarchy (`commission_config`, migration 017)

One row per org. Models the $10/unit/month split: GateGuard keeps $5, dealer pool $5 (master_agent $0.50 + master_dealer $0.50 fixed; configurable $4.00 between sales_partner default $1.00 and service_dealer default $3.00; install_contractor $0 recurring). CHECK constraint keeps `sales_partner_rate + service_dealer_rate ≤ 4.00`.

---

## 2. Users & Roles

### 2a. `profiles` table (one per Clerk user) — migration 001

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | **Internal portal user ID.** This is the FK target for `leads.assigned_to`, `work_orders.assigned_to`. |
| `clerk_user_id` | text unique | **The Clerk bridge.** Not an FK. |
| `org_id` | uuid → organizations.id (required) | User's org |
| `role` | `user_role` enum (required) | See enum below |
| `first_name`, `last_name`, `email` (req), `phone`, `avatar_url` | | |
| `theme`, `notifications_email`, `notifications_sms` | | Prefs |
| `last_login_at`, `created_at`, `updated_at` | | |

> **Identity bridging gotcha** (from schema `_meta`): `profiles.id` (UUID) = internal user; `profiles.clerk_user_id` (TEXT) = Clerk ID. `leads.assigned_to` and `work_orders.assigned_to` are **UUID → profiles.id**. But `todos.assigned_to` is **TEXT storing the Clerk user ID directly** (no FK). `user_feature_access.clerk_user_id` is also the TEXT Clerk ID. Joins must use the right key.

### 2b. `user_role` enum — migration 001

```
corporate_admin
mso_admin
dealer_admin
dealer_staff
partner_admin
client_admin
client_viewer
```

### 2c. Clerk `publicMetadata` roles (the runtime role)

The role actually read at runtime is **Clerk `publicMetadata.role`**, typed in `lib/current-user.ts` as `PortalRole`:

```
admin | supervisor | agent | dealer | rep | client
```

> ⚠️ **Two role vocabularies coexist.** The DB `user_role` enum (`corporate_admin`, `dealer_admin`, …) and the Clerk `PortalRole` (`admin`, `supervisor`, …) are *different sets*. The app trusts the Clerk `PortalRole`. `DEALER_HIERARCHY_AND_PERMISSIONS.md` §4 proposes a mapping/consolidation to UX roles (Owner/Admin, Manager, User, Rep, Tech, Viewer).

### 2d. `technicians` table — migration 011 (+ 093)

Field techs are **not** `profiles`; they are a separate table:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `org_id` | uuid → organizations.id | |
| `name`, `initials`, `role` (default `Tech`), `status` (default `offline`) | | role: Lead Tech / Installer / Tech |
| `phone`, `email` | | |
| `tech_code` | text + unique partial index | **Migration 093** — per-tech login code for `/tech` |
| `created_at`, `updated_at` | | |

Tech auth (`lib/tech-auth.ts`): a request is authed if `x-tech-code` matches either the global `TECH_ACCESS_CODE` env var **or** any `technicians.tech_code`.

---

## 3. Feature Permissions (the granular layer)

Three tables, migration `095` (+ `095b` adds AI agents & Feature Settings). Access levels everywhere: **`none` | `view` | `edit`**.

### 3a. `feature_catalog` — global master list

PK `key` (e.g. `sales.crm`). Columns: `label`, `section`, `section_label`, `href`, `description`, `sort_order`, `is_paid`, `is_beta`, `is_active`, **`tier_defaults` JSONB** (`{org_tier → access_level}`), `stripe_product_id`, `notes`.

`095` seeds ~41 features across sections: Dashboard, Sales & Marketing, Business, Documents, Field & Tech, Design, Systems, Dealer Network, Internal. `095b` adds the **AI Agents** section (ARIA, TRINITY, SCOUT, BEACON, FORGE, ATLAS, SAGE, RELAY) plus `dealer.feature_settings`.

Example default — CRM (`sales.crm`):
`corporate=edit, master_agent=view, master_dealer=edit, full_dealer=edit, service_dealer=none, install_contractor=none, sales_partner=edit`.

### 3b. `org_feature_flags` — per-org override

`(org_id, feature_key)` unique. `access_level` (CHECK none/view/edit). Supports `is_promo`, `promo_reason`, **`expires_at`** (expired flags are ignored), `stripe_subscription_id`, `updated_by`. Overrides the tier default for that org.

### 3c. `user_feature_access` — per-user override

`(clerk_user_id, org_id, feature_key)` unique. `access_level` CHECK none/view/edit. Capped by the org level.

### 3d. Effective-access resolution — `GET /api/user-features/me`

This is the single source the sidebar reads. Logic:

1. **Corporate** (`isCorporate`) → `edit` on every active feature. Done.
2. Otherwise, for each catalog feature:
   - `tierDefault = feature_catalog.tier_defaults[orgTier] ?? 'none'`
   - `orgLevel = org_feature_flags[feature] (non-expired) ?? tierDefault`
   - `userLevel = user_feature_access[feature] ?? orgLevel`
   - **`effective = min(userLevel, orgLevel)`** (rank none=0, view=1, edit=2)

`none` ⇒ the nav item is hidden entirely. The Sidebar (`HREF_TO_FEATURE` map) gates all 41+ items on this.

---

## 4. Where Enforcement Actually Happens (code map)

| Concern | File | What it does |
|---|---|---|
| Identity → flags | `lib/current-user.ts` | Reads Clerk metadata → `PortalUser` with `isCorporate`, `isMasterDealer`, … and coarse `canViewCRM/WOs/Sites/Dispatch/Commissions/Network/Sensitive/Financials`. Falls back to a `SYSTEM_USER` (corporate admin) when unauthenticated. |
| Data scope | `lib/org-scope.ts` | `resolveOrgScope(user)` → `{all, ids[], own_id}`. Corporate ⇒ `all:true` (no filter). master_agent/master_dealer/full_dealer ⇒ descendant subtree via `get_org_subtree`. service_dealer/install_contractor/sales_partner/client ⇒ self only. `applyOrgScope(query, scope, column)` applies `.in('org_id', …)` or the 3-FK `OR` for sites. |
| Subtree RPC | migration `013` `get_org_subtree(root_id)` | Recursive CTE over **`parent_id`**. `SECURITY DEFINER`. |
| RLS backstop | migration `013` | Org-scoped RLS on sites, site_assets, terminals, events, work_orders, organizations using `auth_org_id()` + `org_in_scope()`. **Primary gate is app-layer** (service-role key bypasses RLS); RLS is the fallback for anon-key access. |
| Sensitive fields | migration `013` `sensitive_fields` + `sensitive_field_access_log` | Marks gate_code, access_notes, contact phones, org license_number as restricted; audit log table. |
| Who-can-create-whom | `app/api/admin/onboard-dealer/route.ts` | `TIER_RANK`; corporate sees all dealer tiers, others only tiers ranked strictly below them. |
| Who-can-see-which-users | `app/api/admin/users/route.ts` | Corporate → all; others → own org + direct child orgs only. |
| Org detail access | `app/api/admin/dealers/[id]/route.ts` | Non-corporate blocked unless target is own / direct child / grandchild. |
| Lead/opp assignment targets | `app/api/crm/assignable-orgs/route.ts` | Corporate=all; master_agent=`master_agent_id=me`; master_dealer=`master_dealer_id` or `parent_org_id=me`; full_dealer=`parent_org_id=me`; others=self only. |
| Tech auth | `lib/tech-auth.ts` | Global env code or per-tech `tech_code`. |

---

## 5. Known Inconsistencies / Cleanup Candidates

1. **Stale schema doc** — `SUPABASE_SCHEMA.json` doesn't reflect the `organizations` ALTERs (017/034/096). Regenerate it.
2. **Dual parent columns** — `parent_id` vs `parent_org_id`. `get_org_subtree()` uses `parent_id`; onboarding/assignable-orgs use `parent_org_id`/`master_dealer_id`/`master_agent_id`. If a row only has one set, subtree scoping and assignment scoping disagree. Pick one canonical pointer (recommend `parent_org_id`) and either migrate `get_org_subtree` to it or backfill `parent_id`.
3. **Dual role vocabularies** — DB `user_role` enum vs Clerk `PortalRole`. App trusts Clerk. Consolidate per design-doc §4.
4. **Legacy enum values** — `mso`, `dealer`, `partner` remain in the `org_tier` type but are superseded. Code should never write them.
5. **No org-cap enforcement on write paths yet** — the effective-access *read* (`/api/user-features/me`) caps user≤org correctly, but the design doc's Phase 3 guard helpers (`canManageOrg`, `canCreateChildOrg`, `canInviteUser`, `canAssignFeature`) are **not yet implemented** as shared functions — enforcement is scattered per-route.

---

## 6. Quick Reference — the 7 (8) tiers and default capabilities

| Tier | Data scope | CRM | Quotes | WOs/Dispatch | Billing | Can onboard | Notes |
|---|---|---|---|---|---|---|---|
| corporate | ALL | edit | edit | edit | edit | all tiers | GateGuard HQ |
| master_agent | subtree (oversight) | view | none | none | none | tiers >1 | Commission oversight |
| master_dealer (MSO) | full subtree | edit | edit | edit | edit | tiers >2 | Runs a network |
| full_dealer | self + sub-orgs | edit | edit | edit | edit | tiers >3 (sales_partner) | Self-performs/subcontracts |
| service_dealer | self only | none | view | edit (WO/dispatch) | none | — | Services only |
| install_contractor | self only (WO by assignee_org_id) | none | none | edit WO, no dispatch | none | — | Installs only |
| sales_partner | self only | edit | edit | none | none | — | Sells only, lifetime commission |
| client | self only | — | — | — | — | — | Property portal view only |

(CRM/Quotes/etc. columns above are the `tier_defaults` from `feature_catalog`; the coarse `canView*` flags in `current-user.ts` are broadly consistent but resolved separately — the feature flags are the granular truth.)
