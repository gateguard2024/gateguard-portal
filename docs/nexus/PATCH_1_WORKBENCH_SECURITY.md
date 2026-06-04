# PATCH 1 — Nexus Workbench Security & Org Scoping

**Branch:** beta only  
**Status:** Ready to commit  
**Date:** June 3, 2026

---

## Files Changed (3 total)

```
lib/current-user.ts
app/api/nexus/opps/workbench/route.ts
app/api/crm/activities/[id]/route.ts
```

Nothing else was touched.

---

## Change 1 — lib/current-user.ts

### What changed
Added `isServiceDealer` to `canViewCRM`.

### Before
```typescript
const canViewCRM =
  isCorporate || isMasterDealer || isFullDealer || isSalesPartner
```

### After
```typescript
const canViewCRM =
  isCorporate || isMasterDealer || isFullDealer || isServiceDealer || isSalesPartner
```

### Why
Service dealers manage active service contracts at sites. They need to view their own leads and opportunities. Without this change, service_dealer users would get a 403 from the workbench even though the org scoping would correctly limit them to self only.

Permissions come from `current-user.ts` only. No special cases in individual routes.

---

## Change 2 — app/api/nexus/opps/workbench/route.ts

### What changed
Added authentication and org scoping to every query. Uses existing framework — no new permission logic created.

### Before
- No `getCurrentUser()` call — fully unauthenticated
- No org scoping — returned all leads and all opportunities across every dealer org
- 6 queries all unfiltered

### After
```typescript
const user = await getCurrentUser()

if (!user.canViewCRM) {
  return NextResponse.json({ success: false, message: 'CRM access denied.' }, { status: 403 })
}

const scope = await resolveOrgScope(user)
```

Every leads query:
```typescript
leadsQ = applyOrgScope(leadsQ, scope)                    // leads.org_id
```

Every opportunities query:
```typescript
oppsQ = applyOrgScope(oppsQ, scope, 'dealer_org_id')     // opportunities.dealer_org_id
```

`dealer_org_id` verified real: `supabase/migrations/002_crm_phase1.sql` line 105.

### Visibility by tier

| Tier | canViewCRM | Scope |
|------|-----------|-------|
| Corporate | ✅ | All data |
| Master Agent | ✅ | Subtree |
| Master Dealer (MSO) | ✅ | Subtree |
| Full Dealer (SO) | ✅ | Self + descendants |
| Service Dealer (SP) | ✅ | Self only |
| Sales Partner (SLP) | ✅ | Self only |
| Install Contractor (IP) | ❌ | 403 |
| Client | ❌ | 403 |

### Existing framework used

| Helper | File |
|--------|------|
| `getCurrentUser()` | `lib/current-user.ts` |
| `canViewCRM` | `lib/current-user.ts` line 107 |
| `resolveOrgScope()` | `lib/org-scope.ts` line 81 |
| `applyOrgScope()` | `lib/org-scope.ts` line 123 |

---

## Change 3 — app/api/crm/activities/[id]/route.ts

### What changed
Fixed two column name bugs that caused every activity PATCH to 500.

### Bug 1 — updated_at does not exist on crm_activities
```typescript
// BEFORE (broke every PATCH)
const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

// AFTER
const updates: Record<string, unknown> = {}
// crm_activities has no updated_at column — never include it
```

### Bug 2 — wrong column name for call duration
```typescript
// BEFORE
updates.duration_mins = body.duration_mins    // column does not exist

// AFTER
updates.duration_min = body.duration_mins     // correct column: duration_min (no s)
```

Source: `supabase/migrations/008_crm_full.sql` line 199: `duration_min integer`.

---

## Commit Command (run on beta branch)

```bash
cd ~/Documents/GitHub/gateguard-portal
git checkout beta
git checkout main -- \
  lib/current-user.ts \
  app/api/nexus/opps/workbench/route.ts \
  "app/api/crm/activities/[id]/route.ts"
git commit -m "fix: workbench security + canViewCRM service_dealer + activities PATCH

lib/current-user.ts:
- Add isServiceDealer to canViewCRM (service_dealer can work CRM in own scope)

app/api/nexus/opps/workbench/route.ts:
- getCurrentUser() auth gate + 403 if !canViewCRM
- resolveOrgScope() + applyOrgScope() on all 6 queries
- leads scoped on org_id, opportunities scoped on dealer_org_id

app/api/crm/activities/[id]/route.ts:
- Remove updated_at from PATCH updates (column does not exist on crm_activities)
- Fix duration_mins -> duration_min (correct DB column name)"
git push origin beta
```

---

## Beta Only Confirmation

These changes exist only in the workspace (main branch filesystem). They are NOT committed to main or beta yet. Running the commit command above applies them to beta only. Main is not touched.
