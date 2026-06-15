# Nexus Backend Audit — June 14, 2026

Phase-by-phase verification that each surface has a real, wired, org-scoped backend.
Branch: beta. Method: full read-only sweep (mock vs real fetch, org scoping, migrations, endpoint existence).

## Phase status
| Phase | Status | Notes |
|------|--------|------|
| 1 — Foundation (permissions, org-scope) | ✅ wired & scoped | `lib/permissions.ts`, `lib/org-scope.ts` correct; migration 110 pending prod |
| 2 — My Day (todos, calendar, priorities, messages) | ✅ wired & scoped | all fetch real APIs, user/org scoped |
| 3 — Jobs/Dispatch | ✅ wired & scoped | workbench, job-window, /api/dispatch all scoped |
| 4 — Sales/CRM glass | ✅ wired & scoped | lead/opp windows use applyOrgScope |
| 5 — Operations (Customer finder) | ⚠️ partial | **CustomerSiteFinder was mock-only** → rebuild briefed; CustomersSitesSurface search/detail real |
| 6 — Design/Systems | ✅ wired & scoped | real endpoints + mock fallback |
| 7 — Money/Docs | ⚠️ fixed | **InvoicesBoard was mock-only → now wired**; **2 endpoints were unscoped → now fixed** |
| 8 — Email/Messages | ✅ wired & scoped | user-level scope + RLS (115/116) |
| 9 — Public Document Portal | ✅ public-safe | token-based, never returns token |

## Fixed in this pass
- **CRITICAL — `/api/nexus/money-docs/documents`**: was returning ALL `document_signatures` to any authenticated user. Now `resolveOrgScope` + `applyOrgScope(query,'org_id')` (corporate sees all; others only their subtree).
- **CRITICAL — `/api/nexus/money-docs/compliance`**: same `document_signatures` leak. Now org-scoped.
- **HIGH — `InvoicesBoard.tsx`**: was mock-only. Now fetches `/api/nexus/money-docs/invoices` (normalizes status/bucket; preview fallback).

## Remaining
- **CustomerSiteFinder.tsx** — still mock-only. Rebuild brief written: `docs/nexus/handoff/GEMINI_CUSTOMER_FINDER_REBUILD.md` (search-as-you-type → `/customers-sites/search`, detail → `/customers-sites/detail`). Hand to Gemini, then Claude wires.
- **Migrations 110–116 → run on PROD.** Created on beta June 14; production was just promoted from beta→main, so prod DB needs them (110 canonical parent is foundational for org scoping; 115/116 idempotent & safe). Order: beta confirmed → prod.

## Addendum (June 14) — Sales/CRM, Doc Portal, Onboarding endpoint sweep
- **Public Document Portal: CLEAN.** `/api/document/[slug]`, `/api/signatures/[token]`, `/cert`, `by-record` are all token-based; slug route never returns the token.
- **Sales/CRM: new Nexus routes scoped; legacy `/api/crm/*` NOT scoped.** `/api/nexus/opps/*` ✅. Legacy gaps (authed but no org scope → cross-org read by ID): `crm/opportunities/[id]`, `crm/opportunities/[id]/contacts`, `crm/opportunities/[id]/activities`, `crm/leads/[id]`, `crm/leads/[id]/activities`, `crm/activities`, `crm/leads/campaign` + `/sends`.
- **Onboarding/admin: a few NO-AUTH/unscoped:** `admin/commission-config` (NO-AUTH GET), `admin/users/[id]/permissions` (NO-AUTH; dead permissions system), `admin/setup-corporate` (NO-AUTH bootstrap). Core onboarding (`onboard-dealer`, `dealers/[id]`, `users`, `org-features`, `user-features`) are role/scope-gated.
- These legacy CRM/admin routes back the *legacy* pages (Nexus glass uses the scoped `/nexus/*` versions). Fix = defense-in-depth + needed before legacy pages are exposed to dealers (ties to dealer-safe part 2).

## Fixed June 14 (session cont.) — legacy CRM scoping
- Added `isInScope()` (org-scope) + `lib/crm-scope.ts` (`opportunityInScope`, `leadInScope`).
- Guarded (404 on cross-org): `crm/opportunities/[id]` GET/PATCH/DELETE, `…/[id]/contacts` GET+POST, `…/[id]/activities` GET+POST, `crm/leads/[id]` GET/PATCH/DELETE, `crm/leads/[id]/activities` GET+POST, `crm/activities` list (scoped to in-subtree opportunities). Corporate bypass throughout.
- **Remaining:** `crm/leads/campaign` + `/sends` operate over the global show_leads pool for marketing — gate to corporate/marketing role (product decision) before exposing to dealers. Tracked in #54-adjacent.

## Verified clean (no leaks)
All other `/api/nexus/*`, `/api/dispatch/*`, `/api/calendar/*` list routes apply org scope (`applyOrgScope`), assigned scope (`applyAssignedScope`), or user ownership (`.eq('user_id', …)`). Public `/api/document/[slug]` is token-based and never returns the token.
