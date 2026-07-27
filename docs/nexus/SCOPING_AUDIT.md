# Multi-Tenant Data-Isolation Audit — API by-ID / org-data routes

_Audit date: 2026-07-24. Scope: the flagged `app/api/**/route.ts` routes that read or mutate org-owned data (work orders, sites, customers, inventory, permits, POs, incidents, job costs, contacts, tracker items, CRM records, technicians, subcontractors)._

**How scoping is supposed to work** (reference): a route resolves the caller with `getCurrentUser()`, resolves their subtree with `resolveOrgScope(user)`, then either filters lists with `applyOrgScope(query, scope, col)` or, for by-ID routes, fetches the record's parent, and calls `isInScope(scope, record.org_id)` — returning **404** when false so a user from org A cannot touch org B's rows by supplying an ID. The list route `app/api/maintenance/route.ts` already does this correctly (`applyOrgScope(query, scope, 'org_id')`, line 35); the by-ID detail/child routes below skip it.

## Counts

| Verdict | Count |
|---|---|
| **LEAK** | 31 |
| **NEEDS-REVIEW** | 1 |
| **SAFE** | 7 |

---

## Summary table

| Route | Methods | Verdict | One-line reason |
|---|---|---|---|
| `maintenance/[id]/route.ts` | GET/PATCH/DELETE | **LEAK** | No auth, no scope — any caller can read/mutate/delete any org's work order by ID |
| `maintenance/[id]/calls/route.ts` | GET/POST/DELETE | **LEAK** | No auth; scoped only by attacker-supplied `work_order_id` |
| `maintenance/[id]/checklist/route.ts` | POST/PATCH/DELETE | **LEAK** | No auth; PATCH/DELETE act on `item_id` with no WO-ownership check at all |
| `maintenance/[id]/crew/route.ts` | GET/POST/DELETE | **LEAK** | No auth; adds/removes crew on any WO |
| `maintenance/[id]/equipment/route.ts` | GET/POST | **LEAK** | No auth; reads/writes installed equipment for any WO |
| `maintenance/[id]/equipment/[equipId]/route.ts` | PATCH/DELETE | **LEAK** | No auth; mutates equipment on any WO |
| `maintenance/[id]/parts/route.ts` | GET/PATCH/POST/DELETE | **LEAK** | No auth; reads parts+PO data and decrements any org's inventory |
| `maintenance/[id]/parts/[partId]/route.ts` | DELETE | **LEAK** | No auth; deletes parts + restores stock on any WO |
| `maintenance/[id]/phases/route.ts` | GET/POST | **LEAK** | No auth; reads/writes phases for any WO |
| `maintenance/[id]/phases/[phaseId]/route.ts` | PATCH/DELETE | **LEAK** | No auth; mutates phases on any WO |
| `maintenance/[id]/photo-upload-url/route.ts` | POST | **LEAK** | No auth; mints signed upload URLs into any WO's photo bucket path |
| `customers/[id]/route.ts` | GET/PATCH | **LEAK** | No auth; GET dumps any org (sites, WOs, assets); PATCH edits any organization |
| `customers/[id]/contacts/route.ts` | GET/POST | **LEAK** | No auth; scoped only by `org_id = params.id` (attacker-chosen) |
| `customers/[id]/contacts/[contactId]/route.ts` | PATCH/DELETE | **LEAK** | No auth; edits/deletes any org's contacts |
| `inventory/[id]/route.ts` | GET/PATCH/DELETE | **LEAK** | No auth, no scope; reads/edits/soft-deletes any org's inventory item |
| `inventory/[id]/adjust/route.ts` | POST | **LEAK** | No auth; adjusts stock counts on any org's item |
| `incidents/[id]/route.ts` | PATCH/DELETE | **LEAK** | No auth, no scope; edits/deletes any org's incident (`incidents.org_id`) |
| `permits/[id]/route.ts` | PATCH/DELETE | **LEAK** | Calls `getCurrentUser()` but ignores it — no scope check; any user edits/deletes any permit |
| `permits/[id]/upload/route.ts` | POST | **LEAK** | `getCurrentUser()` called but result unused; mints upload URL into any permit's doc path |
| `purchase-orders/[id]/route.ts` | PATCH | **LEAK** | Real Clerk `auth()` gate but **no org scope**; any signed-in user updates any org's PO |
| `job-costs/[woId]/route.ts` | GET/POST | **LEAK** | No auth; GET exposes quoted totals + margins for any WO, POST adds costs to any WO |
| `field-tickets/[id]/route.ts` | GET/PATCH/DELETE | **LEAK** | `getCurrentUser()` present but no scope; any user reads/edits/deletes any field ticket |
| `jobs/[id]/route.ts` | GET/PATCH | **LEAK** | Auth present but no scope; any user reads/edits any job (`jobs.org_id NOT NULL`) |
| `sites/[id]/assets/route.ts` | GET/POST | **LEAK** | No auth; exposes serials/MAC/IP for any site, adds assets to any site |
| `sites/[id]/requests/route.ts` | GET/PATCH | **LEAK** | No auth; PATCH updates by bare `request_id`, not even scoped to the site |
| `tracker/items/[id]/route.ts` | GET/PATCH/DELETE | **LEAK** | No auth, no scope; reads/edits/deletes any org's tracker item (`tracker_items.org_id`) |
| `tracker/items/[id]/comments/route.ts` | GET/POST | **LEAK** | GET no auth; POST auths for attribution only — neither checks item ownership |
| `crm/opportunities/[id]/contacts/route.ts` | GET/POST/DELETE | **LEAK** | GET+POST guard with `opportunityInScope`; **DELETE does not** — cross-org contact delete |
| `dispatch/technicians/[id]/route.ts` | PATCH/DELETE | **LEAK** | No auth; PATCH can set `tech_code` (mint /tech access) or delete any org's technician |
| `eos/scorecard/entries/route.ts` | POST | **LEAK** | No auth, no scope; upserts scorecard values for any `scorecard_id` |
| `subcontractors/[id]/route.ts` | GET/PATCH/DELETE | **LEAK** | `getCurrentUser()` present but no scope; any user reads/edits/deletes any subcontractor + their WO assignments |
| `crm/contact-links/route.ts` | GET/POST/DELETE | **NEEDS-REVIEW** | Auth present but no entity-ownership scope; enumerates/attaches/detaches contacts on any `entity_id`. Correct fix requires per-`entity_type` scope resolution (lead/opp/site/dealer), hence review |
| `crm/leads/[id]/route.ts` | GET/PATCH/DELETE | **SAFE** | Guards every method with `leadInScope(id)` → 404 |
| `crm/leads/[id]/activities/route.ts` | GET/POST | **SAFE** | Guards both methods with `leadInScope(id)` → 404 |
| `subcontractors/portal/route.ts` | POST | **SAFE** | Public, gated by `access_code`; strips sensitive fields — safe-by-design token-style route |
| `show-lead/route.ts` | POST | **SAFE** | Public trade-show lead intake; write-only INSERT of a new lead, reads/mutates nothing by ID |
| `aria/properties/route.ts` | GET/POST | **SAFE** | `aria_properties` is the shared, org-agnostic intel catalog (never per-tenant partitioned); GET requires auth, POST gated by service-key/Clerk |
| `aria/properties/[id]/route.ts` | GET/PATCH | **SAFE** | Shared intel DB; GET blocks anon, PATCH requires `canViewCRM` |
| `aria/searches/[id]/route.ts` | DELETE | **SAFE** | Fetches record and enforces `search.user_id === user.id` → 403 |

---

## LEAKS — fix first

The dominant pattern: these routes instantiate a `SUPABASE_SERVICE_ROLE_KEY` client (which bypasses RLS) and filter only by an ID taken from the URL/body, with no `getCurrentUser()` + `resolveOrgScope()` + `isInScope()` gate. Every one is exploitable by supplying another tenant's record ID.

### Tier 1 — no authentication at all (worst; reachable by any unauthenticated caller)

**`app/api/maintenance/[id]/route.ts`** (GET 34, PATCH 104, DELETE 307)
Missing: any auth + ownership check. Smallest fix — after fetching the WO (GET line 38-47; PATCH line 108-112; DELETE has no fetch), add:
```ts
const user = await getCurrentUser(); const scope = await resolveOrgScope(user)
if (!isInScope(scope, wo.org_id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```
`work_orders.org_id` exists (migration 011, line 18). DELETE (307) currently deletes with no fetch — fetch `org_id` first, `isInScope`-gate, then delete. (Note the install_contractor edge: those users scope by `assignee_org_id`, not `org_id` — mirror `applyOrgScope`'s `'assignee_org_id'` branch if that tier must retain access.)

**All maintenance child routes** — `calls`, `checklist`, `crew`, `equipment`, `equipment/[equipId]`, `parts`, `parts/[partId]`, `phases`, `phases/[phaseId]`, `photo-upload-url`.
Missing: same gate. Smallest fix — at the top of each handler, resolve the parent WO once and gate:
```ts
const user = await getCurrentUser(); const scope = await resolveOrgScope(user)
const { data: wo } = await supabase.from('work_orders').select('org_id').eq('id', params.id).single()
if (!wo || !isInScope(scope, wo.org_id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```
Extra note — `checklist/route.ts` PATCH (line 68) and DELETE (line 85) mutate by `item_id` with **no `work_order_id` filter at all**; add `.eq('work_order_id', params.id)` in addition to the WO gate. `photo-upload-url/route.ts` (line 20) must gate before minting the signed URL (line 38).

**`app/api/customers/[id]/route.ts`** (GET 10, PATCH 87)
Missing: auth + subtree check on the requested org. Smallest fix — this is an `organizations` row, so gate by the org id itself:
```ts
const user = await getCurrentUser(); const scope = await resolveOrgScope(user)
if (!isInScope(scope, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```
PATCH (87) additionally lets anyone rewrite any organization — same gate, and consider restricting to `canManageOrg`.

**`app/api/customers/[id]/contacts/route.ts`** (GET 10, POST 23) and **`.../contacts/[contactId]/route.ts`** (PATCH 10, DELETE 37)
Missing: auth + `isInScope(scope, params.id)` (the `org_id`) before reading/writing `org_contacts`. Add the org-id gate shown above at the top of each handler.

**`app/api/inventory/[id]/route.ts`** (GET 18, PATCH 31, DELETE 48) and **`.../adjust/route.ts`** (POST 19)
Missing: auth + scope. Fetch the item's `org_id` (`inventory_items.org_id`, migration 035 line 55), then `isInScope`. In `adjust`, the item is already fetched at line 37 — add the check right after.

**`app/api/incidents/[id]/route.ts`** (PATCH 10, DELETE 39)
Missing: auth + scope. Fetch `incidents.org_id` (migration 077 line 19) before update/delete and `isInScope`-gate.

**`app/api/job-costs/[woId]/route.ts`** (GET 13, POST 145)
Missing: auth + scope. Fetch the parent WO's `org_id` (GET already reads the WO at line 54 for `quote_id` — extend to `org_id`), gate before returning margins / inserting costs. Exposes financials, so this is high priority.

**`app/api/sites/[id]/assets/route.ts`** (GET 11, POST 29) and **`.../requests/route.ts`** (GET 10, PATCH 22)
Missing: auth + site-ownership check. Sites use the 3-FK pattern — fetch the site and verify with `applyOrgScope(query, scope, 'site')` semantics, or:
```ts
const { data: site } = await supabase.from('sites')
  .select('master_dealer_id, install_dealer_id, service_dealer_id').eq('id', params.id).single()
const owned = scope.all || [site?.master_dealer_id, site?.install_dealer_id, site?.service_dealer_id]
  .some(id => id && scope.ids.includes(id))
if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```
`requests/route.ts` PATCH (22) mutates by `request_id` alone — also add `.eq('site_id', params.id)` to the update.

**`app/api/tracker/items/[id]/route.ts`** (GET 12, PATCH 26, DELETE 59) and **`.../comments/route.ts`** (GET 13, POST 30)
Missing: auth + scope. Fetch `tracker_items.org_id` (migration 102 line 43) and `isInScope`-gate. Note tracker items may carry `org_id = null` for entity-embedded boards (migration 103) — for those, resolve scope through the parent entity (`tracker_groups.entity_type/entity_id`) rather than passing null (which `isInScope` rejects).

**`app/api/dispatch/technicians/[id]/route.ts`** (PATCH 10, DELETE 34)
Missing: auth + scope. PATCH can write `tech_code`, which mints `/tech` field-tool access (`isTechAuthed` trusts `technicians.tech_code`) — elevated risk. Fetch the technician's owning org and gate before update/delete; also restrict to dispatch-capable roles.

**`app/api/eos/scorecard/entries/route.ts`** (POST 10)
Missing: auth + scope. Upserts by `scorecard_id` with no owner check. Add `getCurrentUser()` and verify the parent `dealer_scorecards`/`eos_scorecards` row is in scope before upsert.

### Tier 2 — authenticated but not org-scoped (any signed-in tenant can cross over)

**`app/api/permits/[id]/route.ts`** (PATCH 15, DELETE 28) and **`.../upload/route.ts`** (POST 29)
`await getCurrentUser()` is called but its result is discarded. Capture it, resolve scope, fetch the permit's owning org (via `permits.org_id` or its parent site), and `isInScope`-gate before update/delete/upload.

**`app/api/purchase-orders/[id]/route.ts`** (PATCH 16)
Has a real `auth()` 401 gate (line 17) but no org filter. Fetch `purchase_orders.org_id` (migration 035 line 140) and `isInScope`-gate before the update loop (line 32).

**`app/api/field-tickets/[id]/route.ts`** (GET 11, PATCH 27, DELETE 69)
`getCurrentUser()` present but unused for scope. Fetch the ticket's `org_id` (or its parent WO's org) and gate each method.

**`app/api/jobs/[id]/route.ts`** (GET 16, PATCH 66)
Auth present (`if (!user)` never trips — `getCurrentUser` returns ANON_USER, not null). Fetch `jobs.org_id` (migration 105 line 17, `NOT NULL`) and `isInScope`-gate in both GET and PATCH.

**`app/api/subcontractors/[id]/route.ts`** (GET 12, PATCH 37, DELETE 65)
`getCurrentUser()` present but unused. Fetch the subcontractor's owning org and `isInScope`-gate; leaks their WO assignments (line 27) otherwise.

**`app/api/crm/opportunities/[id]/contacts/route.ts`** — DELETE only (75)
GET (20) and POST (42) correctly call `opportunityInScope(params.id)`; **DELETE (75) omits it**. Add the identical guard at the top of DELETE:
```ts
if (!(await opportunityInScope(params.id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

---

## NEEDS-REVIEW

**`app/api/crm/contact-links/route.ts`** (GET 18, POST 53, DELETE 71)
All methods call `getCurrentUser()` but none scope by the owning record. A signed-in user can pass any `entity_type`+`entity_id` to enumerate that record's contacts (GET), attach a contact (POST), or detach one (DELETE) — cross-org. The reason this is review-rather-than-trivial-fix: `contact_links` spans polymorphic entities (lead, opportunity, site, dealer, quote), so the correct guard must dispatch on `entity_type` to the right scope check (`leadInScope`, `opportunityInScope`, a site 3-FK check, `isInScope` on the org, etc.). Recommend a small `entityInScope(entity_type, entity_id)` helper mirroring `crm-scope.ts`, then gate all three methods with it.

---

## SAFE (no change needed)

- **`crm/leads/[id]/route.ts`**, **`crm/leads/[id]/activities/route.ts`** — every method gated by `leadInScope()` → 404.
- **`aria/searches/[id]/route.ts`** — enforces `search.user_id === user.id` → 403.
- **`aria/properties/route.ts`**, **`aria/properties/[id]/route.ts`** — `aria_properties` is the intentionally shared, org-agnostic intelligence catalog ("one row per property, never deleted, upserted by every search" — CLAUDE.md / migration 098); there is no per-tenant owner to isolate. Reads require auth (non-anon), writes require service-key or `canViewCRM`. Safe-by-design as globally-shared content.
- **`subcontractors/portal/route.ts`** — public route gated by `access_code`, strips sensitive fields; token-style by design.
- **`show-lead/route.ts`** — public write-only lead-capture form; inserts a new row, never reads/mutates existing data by ID.
