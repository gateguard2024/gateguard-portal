# Permissions & Users — Implementation Spec

> Branch: **beta**. Source of truth for the hierarchy/users/permissions rebuild. Companion to `DEALER_HIERARCHY_AND_PERMISSIONS.md` (model) and `HIERARCHY_USERS_PERMISSIONS_AUDIT.md` (current state). Approved by Russel, June 14 2026.

---

## 1. The Model (locked)

Two independent axes decide what any person can see and do.

### Axis 1 — Org scope (which organizations' records)
**Strictly downward.** You see your own org and every org beneath it in the tree. Never your parent, never a sibling. (ADT / DIRECTV dealer model — each branch is sealed from its parent and siblings.)

```
corporate          → all orgs (no filter)
master_agent       → own subtree
master_dealer (MSO)→ own subtree
full_dealer        → own subtree
service_dealer     → self only
install_contractor → self only
sales_partner      → self only
client             → self only
```

### Axis 2 — In-org record scope (which records inside those orgs)
Driven by the user's **role** (3 roles only):

| Role | In-org record visibility | Can manage users/permissions? |
|---|---|---|
| **Admin** | All records in org (+ subtree per Axis 1) | **Yes** — for their level and below, capped at own access |
| **Supervisor** | All records in org (+ subtree) | No |
| **User** | **Only records assigned to them** — for CRM leads/opps, work orders/jobs, and quotes. All other modules: normal org scope. | No |

### Roles drive the feature engine (presets + advanced)
The existing `feature_catalog` / `org_feature_flags` / `user_feature_access` engine **stays**. The 3 roles become **presets** that compute a default `none/view/edit` map. An **Advanced** mode lets a parent Admin fine-tune individual features — always capped at the parent's own effective access.

```
effective_user_access(feature) =
    min( rolePreset(role, orgAccess[feature]),   // preset cap by role
         userOverride[feature] ?? orgAccess[feature], // advanced override
         orgAccess[feature] )                    // never exceed the org
```

The governing invariant everywhere: **a user/dealer can never be granted more than its parent.**
`requested ≤ granter's effective ≤ org ≤ parent org`.

### Role → preset rules
- **Admin** → inherits the org's level on every feature the org has, *including* the admin features (`dealer.platform_users`, `dealer.dealers`, `dealer.feature_settings`) within the org's cap.
- **Supervisor** → inherits the org's level on all *operational* features; admin features forced to `none`.
- **User** → every feature capped to `view`, EXCEPT the "own-work" features (CRM, Quotes, Work Orders, Dispatch) which keep the org's `edit` level but are **row-scoped to assigned records**; admin features forced to `none`.

---

## 2. Decisions locked
- Assigned-only applies to: **CRM leads & opportunities, work orders & jobs, quotes**. (ARIA excluded.)
- Canonical parent pointer: **`parent_org_id`** (see Phase 1).
- Feature engine: **kept**, driven by role presets + advanced override.
- Build order: **Foundation first.**

---

## 3. Phase 1 — Foundation (backend, no UI)

Goal: make downward isolation actually trustworthy and centralize enforcement, so the model holds even if a route forgets to scope.

### 1.1 Canonical parent migration
New migration `1xx_canonical_parent.sql`:
- Backfill so `parent_org_id` and `parent_id` agree: set `parent_org_id = COALESCE(parent_org_id, parent_id)` and `parent_id = COALESCE(parent_id, parent_org_id)`.
- Rewrite `get_org_subtree()` to walk `COALESCE(o.parent_org_id, o.parent_id)` so it's correct regardless of which column a row used.
- Index on `parent_org_id` (already exists from 017; confirm).
- GRANTs unchanged (function only).

### 1.2 Shared guard helpers — `lib/permissions.ts` (new)
Single module every route imports:
- `getProfileId(user)` — resolve `profiles.id` (internal UUID) from `clerk_user_id`; cache per request.
- `canManageOrg(caller, targetOrgId)` — corporate, or target ∈ caller subtree.
- `canCreateChildOrg(caller, targetTier)` — `TIER_RANK[targetTier] > TIER_RANK[caller.tier]`.
- `canInviteUser(caller, targetOrgId, targetRole)` — `canManageOrg` AND caller is Admin AND `targetRole` ≤ caller role.
- `rolePresetAccess(role, orgAccessMap)` — returns the capped feature map for a role (§1 rules).
- `canAssignFeature(callerEffectiveMap, featureKey, requestedLevel, orgCap)` — `requested ≤ min(callerEffective, orgCap)`.
- `ROLE_RANK = { admin:0, supervisor:1, user:2 }`.

### 1.3 Assigned-only row scope — extend `lib/org-scope.ts`
- `applyAssignedScope(query, user, profileId, entity)` where `entity ∈ {'leads','opportunities','work_orders','quotes'}`.
- No-op when `user.role !== 'user'` (admins/supervisors see all in-org).
- For `user`: `leads`/`opportunities`/`work_orders` → `.eq('assigned_to', profileId)`; `quotes` → owner column (confirm: `created_by` / `owner_id` / `accepted_by_rep` — audit the quotes table first).

### 1.4 Wire foundation into the effective-access resolver
- Update `GET /api/user-features/me` so the per-feature result runs through `rolePresetAccess(role, …)` before the org/user cap — role becomes the first cap.

**Phase 1 file list (for confirmation before editing):**
1. `supabase/migrations/1xx_canonical_parent.sql` (new)
2. `lib/permissions.ts` (new)
3. `lib/org-scope.ts` (extend — add `applyAssignedScope`, `getProfileId` usage)
4. `lib/current-user.ts` (add nothing structural; optionally expose `profileId` via helper)
5. `app/api/user-features/me/route.ts` (role-preset cap)

> Per session rules this is >3 files — confirm before code. Migrations run on **beta Supabase first**, then prod.

---

## 4. Phase 2 — Enforcement rollout
Apply `applyAssignedScope` + guard helpers to the live routes:
- CRM: `app/api/crm/leads/route.ts`, `app/api/crm/opportunities/route.ts`
- Jobs/WOs: `app/api/projects/route.ts`, work-order list routes
- Quotes: `app/api/quotes/route.ts`
- Replace per-route hand-rolled hierarchy checks (`onboard-dealer`, `admin/users`, `admin/dealers/[id]`, `assignable-orgs`) with the shared helpers.
- Tighten RLS backstop so a forgotten filter fails closed.

## 5. Phase 3 — Platform Users redesign (5th-grader UI)
`app/admin/users/page.tsx` flow: **Who → What job (role) → What they see (package) → Review → Send/Update.**
- Pick user → pick role (Admin/Supervisor/User) → role auto-applies preset → optional **Advanced** panel for per-feature tuning (greyed above the granter's cap) → review effective access → save.
- Admin at any level can manage users at their level and below (enforced by `canManageOrg` + `canInviteUser`).

## 6. Phase 4 — Role consolidation cleanup
- Standardize Clerk `PortalRole` to `admin | supervisor | user` (map legacy `agent`/`dealer`/`rep` → `user`, keep `client` separate).
- Retire unused DB `user_role` enum values from new writes.
- Keep org-tier names; UI label `master_dealer` = "MSO / Master System Operator".

---

## 7. Open verification step (every phase)
After each phase, prove isolation with a test matrix: seed Corporate → MSO-A → Dealer-A1, and MSO-B → Dealer-B1, then assert Dealer-A1 cannot see MSO-A, MSO-B, or Dealer-B1 data, and a User in Dealer-A1 sees only their assigned leads/WOs/quotes.
