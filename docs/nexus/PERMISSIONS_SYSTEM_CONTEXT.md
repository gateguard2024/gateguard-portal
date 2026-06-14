# Permissions, Users & Hierarchy — System Context

> Larger-scope reference for the whole access system as built on **beta** (June 14, 2026). Read this first before touching anything related to orgs, users, roles, permissions, technicians, or the Internal admin hub. Companions: `DEALER_HIERARCHY_AND_PERMISSIONS.md` (intent), `HIERARCHY_USERS_PERMISSIONS_AUDIT.md` (pre-build state), `PERMISSIONS_BUILD_SPEC.md` (phase plan).

---

## 1. The model (locked)

Two independent axes decide what a person sees and does.

**Axis 1 — Org scope (which organizations' records).** Strictly downward. You see your org and everything beneath it; never your parent, never a sibling. ADT/DIRECTV dealer model — each branch is sealed from its parent and siblings. Resolved by `lib/org-scope.ts` (`resolveOrgScope` → `get_org_subtree` RPC). Corporate = all (no filter).

**Axis 2 — In-org record scope (which records inside those orgs), by role:**

| Role | In-org visibility | Manage users? | Feature access |
|---|---|---|---|
| **Admin** | All records in org scope | Yes (own level & below) | Org level on everything |
| **Supervisor** | All records in org scope | No | Org level, minus admin features |
| **User** | Only records **assigned to them** (leads, opps, quotes, work orders) | No | View-only except own-work features |
| **Tech** | Only **work orders assigned to their technician record** | No | Field tools only (Work Orders, Tech Tool, KB, Products) |

Governing invariant everywhere: **nobody can be granted more than their parent.** `requested ≤ granter effective ≤ org ≤ parent org`.

**Corporate guarantee:** corporate logins (the GateGuard owner) are hard-bypassed from every row restriction — always full visibility over the entire tree.

---

## 2. Where it lives in code

| Concern | File |
|---|---|
| Identity → flags (`isCorporate`, role, tier) | `lib/current-user.ts` |
| Org scope (downward subtree) | `lib/org-scope.ts` — `resolveOrgScope`, `applyOrgScope` |
| In-org record scope | `lib/org-scope.ts` — `applyAssignedScope`, `getProfileId`, `getTechnicianId` |
| Roles, presets, guards | `lib/permissions.ts` — `normalizeRole`, `rolePresetAccess`, `effectiveAccess`, `canManageOrg`, `canCreateChildOrg`, `canInviteUser`, `canAssignFeature` |
| Subtree RPC + canonical parent | migration `110_canonical_parent.sql` (`get_org_subtree` walks `COALESCE(parent_org_id, parent_id)`) |
| Effective access for sidebar | `app/api/user-features/me/route.ts` (role preset → org cap → user override) |
| Feature engine tables | `feature_catalog` / `org_feature_flags` / `user_feature_access` (migration 095/095b) |

**Roles:** the runtime role is **Clerk `publicMetadata.role`**, normalized to `admin | supervisor | user | tech`. The legacy DB `user_role` enum and the legacy `user_permissions.can_see_*` table are **no longer authoritative** and should not be used for new work.

---

## 3. The glass Admin hub (Dashboard → Internal)

`app/page.tsx` → `NexusHomeClient` → **Internal tab** → `InternalSurface` → **Users & Features** board (`InternalUsersFeaturesBoard`).

- **➕ Add Person** → `AddPersonWizard` (`components/nexus/windows/AddPersonWizard.tsx`) → `POST /api/nexus/internal/add-person`. One door, four kinds:
  - *Office / portal user* → Clerk invite + role (stamps org_id + org_tier so the new login is scoped).
  - *Field technician* / *Contractor* → `technicians` row (`employment_type` employee/contractor); login method = field code (`tech_code`), full login (Clerk invite + Tech role), or none.
  - *Subcontractor company* → `subcontractors` row (own `access_code` portal).
- **Tap a user card** → `UserGlassWindow` (`components/nexus/windows/UserGlassWindow.tsx`) → `GET/POST /api/nexus/internal/user-window/[id]`: pick role (auto access package preview) + Advanced per-feature tuning (locked above the granter's cap). Writes role to Clerk + overrides to `user_feature_access`.
- **Board groups** (`InternalUsersFeaturesBoard` ← `GET /api/nexus/internal/users-features`): **Platform Users** (clickable), **Field Techs**, **Organizations** (Corporate / Dealers & Partners / Clients / Unclassified). Org class via `orgCategory(org_tier)`; null/legacy tier → Unclassified so gaps are visible. **Sync logins** button runs the backfill.

---

## 3a. Clerk → profiles sync (the identity bridge)

Clerk owns login; `profiles` is the internal mirror everything joins on. Nothing used to populate it (that was the "Platform Users = 0" bug). Now:
- `lib/profile-sync.ts` — `upsertProfileFromClerk()` maps a Clerk user → `profiles` (role→`user_role` enum, falls back to corporate org when metadata has no `org_id`, links `technicians.clerk_user_id` when `technician_id` is in metadata).
- `app/api/webhooks/clerk/route.ts` — Svix-verified `user.created`/`user.updated` → keeps `profiles` current on every signup. Middleware-bypassed. Needs `CLERK_WEBHOOK_SECRET` per environment (Preview=beta, Production=main) + an endpoint registered in each Clerk instance.
- `app/api/admin/sync-profiles/route.ts` — corporate-only backfill of all existing Clerk users (also surfaced as the **Sync logins** button).

---

## 4. Enforcement points (live on beta)

`applyAssignedScope` is wired into the list GETs:
- `app/api/crm/leads/route.ts` — show_leads `assigned_to_user_id` (Clerk id)
- `app/api/crm/opportunities/route.ts` — `rep_id` (profiles.id)
- `app/api/quotes/route.ts` — `created_by` (profiles.id)
- `app/api/maintenance/route.ts` — User→`assigned_to` (profiles.id), Tech→`assignee_id` (technicians.id)

Technician scoping fixed: `app/api/dispatch/technicians/route.ts` now scopes GET by org and stamps `org_id` on create.

---

## 5. Technicians vs users (important)

- A **technician** is a field-work record (`technicians`, employee or contractor) under an org. Assigned work via `work_orders.assignee_id`.
- A technician becomes a **Tech-role login** when given a full portal invite — links `technicians.clerk_user_id` and `can_access_portal`. WO assigned-only then resolves through that link (`getTechnicianId`).
- A **subcontractor company** is separate (`subcontractors` + `work_order_subcontractors`, own access-code portal) — not a Tech role.

---

## 6. Done in this build cycle (June 14, 2026)

- Canonical-parent fix (migration 110) + guard helpers + role presets (Phase 1)
- Assigned-only enforcement on leads/opps/quotes/work-orders + corporate guarantee (Phase 2)
- Glass Admin hub: Users & Features board (People/Techs/Orgs), user glass editor, Add Person wizard (Phase 3)
- 4-role model incl. **Tech**; dispatch tech `org_id` + scoping fix
- Clerk→profiles sync: webhook + backfill + Sync logins button
- Org classification (corporate/dealer/client/unclassified); Internal nav buttons repointed to `/admin/*`

## 6a. Known follow-ups / not yet done

1. **Dealers + Feature Settings into glass (task #10).** Dealer onboarding board exists; Feature Settings is still the legacy `/admin/settings/features` page. Bring both fully into the glass hub.
2. **Clean up Unclassified orgs.** Any org showing under "Unclassified — needs a tier" needs its `org_tier` set (null or legacy `mso`/`dealer`/`partner`).
3. **Dual parent columns.** Backfilled to agree (migration 110); consider dropping `parent_id` long-term and standardizing on `parent_org_id`.
4. **Legacy systems to retire.** `user_permissions.can_see_*` and unused DB `user_role` enum values are dead; remove references over time.
5. **RLS backstop.** App-layer scoping is primary; tighten RLS so a forgotten filter fails closed.
6. **Prod parity.** Merge `beta → main`, run migration 110 on prod Supabase, run Sync logins on prod, register the prod Clerk webhook.

---

## 7. Verify isolation (test matrix)

Seed Corporate → MSO-A → Dealer-A1, and MSO-B → Dealer-B1. Assert: Dealer-A1 cannot see MSO-A, MSO-B, or Dealer-B1 data; a User in Dealer-A1 sees only their assigned leads/opps/quotes/WOs; a Tech sees only their assigned WOs; the corporate owner sees everything.
