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

## 6. Known follow-ups / not yet done

1. **Tech full-login link on signup.** The Add Person "full login" path creates a Clerk invite carrying `technician_id` in metadata, but nothing yet writes `technicians.clerk_user_id` when the invite is accepted — needs a Clerk webhook (or a link step) so WO assigned-only activates automatically. Until then, link manually.
2. **Internal panel nav buttons.** `InternalSurface` "Users & Features" still has buttons pointing at `/platform-users`, `/feature-settings`, `/dealer` (may 404). Repoint to working routes or remove now that editing is inline.
3. **Dealers + Feature Settings into glass (task #10).** Dealer onboarding board exists; Feature Settings is still the legacy page. Bring both fully into the glass hub.
4. **Dual parent columns.** Backfilled to agree (migration 110); consider dropping `parent_id` long-term and standardizing on `parent_org_id`.
5. **Legacy systems to retire.** `user_permissions.can_see_*` and the DB `user_role` enum values are dead; remove references over time.
6. **RLS backstop.** App-layer scoping is primary; tighten RLS so a forgotten filter fails closed.

---

## 7. Verify isolation (test matrix)

Seed Corporate → MSO-A → Dealer-A1, and MSO-B → Dealer-B1. Assert: Dealer-A1 cannot see MSO-A, MSO-B, or Dealer-B1 data; a User in Dealer-A1 sees only their assigned leads/opps/quotes/WOs; a Tech sees only their assigned WOs; the corporate owner sees everything.
