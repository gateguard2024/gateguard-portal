# Nexus User & Partner Hierarchy (AUTHORITATIVE — Russel, corrected version)

## Shape: every org is self-similar
Each org (Corporate, an MSO, a Dealer) holds the SAME two things:
  (a) its own internal PEOPLE, and
  (b) child PARTNER ORGS below it.
"Direct X" just means the partner's parent is Corporate (vs. under a Master Agent / MSO / Dealer).
Same org type, different parent.

```
Gate Guard Corporate  (corporate)
├─ People: Office · Field Technician · Contractor/Sub-Contractor
├─ Direct partners
│   ├─ Servicing Partner          (service_dealer)
│   ├─ Installing Partner         (install_contractor)
│   ├─ Channel Sales Partner      (sales_partner)
│   └─ Dealer                     (full_dealer)
│         ├─ People
│         └─ Servicing · Installing · Channel Sales partners
└─ Master Agent                   (master_agent)
    ├─ Channel Sales Partner      (sales_partner)
    └─ Master System Operator     (master_dealer)   ← owns dealers
          ├─ People
          ├─ Servicing · Installing · Channel Sales partners
          └─ Dealer               (full_dealer)
                ├─ People
                └─ Servicing · Installing · Channel Sales partners
```

## Org-tier mapping (label → org_tier enum) — matches existing TIER_RANK
| Label (UI)             | org_tier enum        | rank |
|------------------------|----------------------|------|
| Gate Guard Corporate   | `corporate`          | 0    |
| Master Agent           | `master_agent`       | 1    |
| Master System Operator | `master_dealer`      | 2    |
| Dealer                 | `full_dealer`        | 3    |
| Servicing Partner      | `service_dealer`     | 4    |
| Installing Partner     | `install_contractor` | 4    |
| Channel Sales Partner  | `sales_partner`      | 4    |

## Internal-people mapping (person type → add-person kind)
| Person type            | kind            |
|------------------------|-----------------|
| Office / portal user   | `office`        |
| Field Technician       | `technician`    |
| Contractor             | `contractor`    |
| Sub-Contractor         | `subcontractor` |

## Rules (already enforced by lib/permissions.ts)
- Visibility: a party sees ONLY its own subtree (below itself).
- Add users: an admin can add users in their own org and any org below (canManageOrg + canInviteUser).
- Add partner orgs: a tier can create org types strictly below its own rank (canCreateChildOrg),
  e.g. Master Agent → MSO or Channel Sales; MSO → Dealer or Servicing/Installing/Channel Sales;
  Dealer → Servicing/Installing/Channel Sales.

## Status
- All six partner tiers + MSO already exist in the enum with correct ranks — NO schema change.
- Labels updated to the friendly names above (tier-labels.ts + onboarding picker + customer badges).
- MSO restored to the onboarding picker (earlier hide reverted).

## Corporate = support tier above everyone (confirmed)
Gate Guard Corporate staff sit above the entire tree so they can support every team and dealer.
- **Org level:** any Corporate user sees ALL data across every org — no org filter is applied
  (resolveOrgScope short-circuits to `{ all: true }` on the corporate tier). Already enforced.
- **Role level (decided):** for leads / opportunities / work orders / quotes, a plain **"User"**
  role stays **assigned-only**, even at Corporate. Corporate office managers / field-tech leads
  are given **Supervisor or Admin**, which already bypasses the assigned-only filter and sees
  everything. A plain-User Corporate field technician sees only their own assigned jobs.
  → No code change; give support staff Supervisor/Admin.

## Cross-org onsite support (confirmed + fixed)
Corporate techs can be put on a dealer-owned job to provide onsite support.
- As the PRIMARY assignee → already appeared in the tech's My Jobs (corporate has no org filter).
- As a CREW member (dealer's tech stays on) → previously MISSED. Fixed in
  `app/api/tech/work-orders/route.ts`: My Jobs now also returns work orders where the tech is in
  `work_order_crew`, not just the primary assignee. Dealer retains ownership; both see the job.

## Inviting users + individual status (verified)
`/api/nexus/internal/add-person` invites and stamps each person's org + tier + role:
  office → Clerk login (Admin / Supervisor / User) · technician/contractor → tech row (+ optional
  full login) · subcontractor → company row. Guarded by canManageOrg + canInviteUser (subtree only,
  not above own role). Post-invite status (activate / deactivate / role change) via the user-window.

## Channel Sales Partner — cross-org CRM via assignment (built)
Decision: partner sees ONLY leads/opps assigned to them (not corporate's whole pipeline).
Mechanism = assignment grants visibility across orgs. Applies to ANY user, additive/safe.
- Leads list: `org_id in scope OR org_id null OR assigned_to_user_id = me`  (crm/leads GET)
- Opps list:  `dealer_org_id in scope OR rep_id = my profile`                (crm/opportunities GET)
- Lead detail already allowed assignee (assigned_to_user_id == me).
- Opp detail guards (inline oppInScope + lib/crm-scope opportunityInScope) now also allow rep_id == me.
Same primitive covers "sell for dealers": assign the partner a dealer lead/opp and they see it.
TODO (UI): the assign control at Corporate/dealer must list the partner's user as an assignable
target so deals can actually be handed to them (visibility is wired; assignment UI is the last mile).

## NEXT — Customer (client) logins: owners & site managers
Property owners / site managers are `client`-tier users. Requirements:
- Log in and see ONLY their own site(s). Scope `sites` to the client's org (and any
  site→client linkage), not the whole tree. resolveOrgScope already returns self-only for client.
- The MANAGING DEALER must also see that customer's login + sites. Already implied by hierarchy:
  the client org sits UNDER the dealer, so the dealer's subtree scope includes it. Verify sites
  route honors this for all three dealer FKs (master/install/service).
- Ties into RESIDENT_APP_PLAN.md (customer PWA) + first instance East Ponce Village.

## NEXT — Full hierarchy audit (do AFTER hierarchy is locked)
Sweep EVERY list + detail + mutate endpoint to confirm it scopes by the hierarchy:
  1. Every read applies resolveOrgScope / applyOrgScope (or documented corporate-only).
  2. Every by-id route fails closed (404) outside subtree, with assignment exceptions where intended.
  3. sites use the 3-FK OR; work_orders use assignee where relevant; CRM uses assignment primitive.
  4. Confirm client + sales_partner + all 6 partner tiers resolve to correct scope.
  5. Flag any endpoint with no scoping (fail-open) as a security bug.
Deliverable: an audit report listing each endpoint, its scoping status, and gaps to fix.
