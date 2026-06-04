# Session 15 Context — June 3, 2026

Import this file at the start of a new chat to restore full context.

---

## What We Are Building

Nexus is a Business Operating System for GateGuard.

**Prime Directive:** So easy a 5th grader can use it.

Bad: Create Opportunity → Select Pipeline → Assign Stage → Choose Entity  
Good: What happened? What do they need? What should we do next?

Nexus does the rest. This keeps us from accidentally rebuilding Salesforce.

---

## Repo

`gateguard-portal` — portal.gateguard.co  
Branch strategy: features go to `beta` first, then main after approval.  
Git push rule: `git push origin main && git push origin main:beta`  
**Current active branch for new work: `beta`**

---

## What Was Built This Session

### ARIA v8 Reliability Refactor (on main)

**Ticket 1 — Candidate Preservation**
- `saveCandidatesToDB`: status always `'pending'` (was auto-selecting first candidate)

**Ticket 2 — Evidence Packet Persistence**
- Phase 1B returns `raw_results` from `runPhase1B`
- Phase 1B branch saves 18 source evidence packets with `source_url` + `raw_snippet`
- Phase 1A facts include `listing_url` as `source_url`
- Phase 3 contacts include LinkedIn URL as `source_url`
- Phase 3 bulk: 15 `raw_excerpts` saved as `source_excerpt` evidence packets

**Ticket 4 — Top-3 Lightweight Enrichment**
- `enrichTopCandidates()`: 3 parallel Serper + 3 parallel Haiku for top candidates
- Extracts units/phone/management/ownership/gate_signal/pain_brief
- Merged before DB persist

**Ticket 5 — PropTech Scout**
- `ProptechFinding` interface: category/brand/confidence/evidence/source_url/inferred
- Parallel Haiku PropTech Scout runs alongside existing proptech extraction
- Confidence: 90+ = named in text, 70-89 = mentioned, 30-49 = inferred from market share
- Saved as evidence packets, returned in API as `proptech_findings[]`

**Phase 4 Synthesis Fallback**
- `Promise.all` → `Promise.allSettled`
- `buildFallbackRawData()` assembles rawData from p1/p2/p3 when Sonnet 504s
- Search data never lost on timeout

**CandidateGrid render fix** (`app/aria/page.tsx`)
- `candidates.length > 0` → `viewMode === 'candidates'` (desktop + mobile)

---

### Supabase Bug Fixes (on main)

**`app/api/crm/activities/[id]/route.ts`**
- Removed `updated_at` from PATCH updates — column does not exist on `crm_activities`
- Fixed `duration_mins` → `duration_min` (correct DB column name)
- Every activity PATCH was 500ing before this fix

**`app/api/nexus/flows/inbound-lead/route.ts`**
- Changed from `crm_leads` (table never existed) to `leads` table
- Fixed column names: `name` → `contact_name`, `company` → `company_name`
- Added `GATEGUARD_ORG_ID` fallback for corporate users
- Activity log writes to `activity_log` (migration 001)

---

### PATCH 1 — Workbench Security (beta only)

**Files changed:**
- `lib/current-user.ts` — added `isServiceDealer` to `canViewCRM`
- `app/api/nexus/opps/workbench/route.ts` — auth + org scoping
- `app/api/crm/activities/[id]/route.ts` — same fix as above

**What it does:**
- `getCurrentUser()` + 403 if `!user.canViewCRM`
- `resolveOrgScope()` + `applyOrgScope()` on all 6 queries
- `leads` scoped on `org_id`, `opportunities` scoped on `dealer_org_id`
- `dealer_org_id` confirmed real: `002_crm_phase1.sql` line 105

**canViewCRM tiers:**
corporate | master_dealer | full_dealer | service_dealer | sales_partner → true  
install_contractor | client → 403

**Scope behavior:**
- Corporate → all data
- Master Agent/Dealer → subtree via `get_org_subtree` RPC
- Full Dealer → self + descendants
- Service Dealer / Sales Partner → self only

---

### PATCH 3 — Workbench → Lead Glass Window (beta only)

**Files changed:**
- `components/nexus/ActionFlowSurface.tsx`
- `components/nexus/windows/LeadGlassWindow.tsx`

**What it does:**
- Clicking a lead card in the workbench opens the Lead Glass Window
- `openLead(id)` → GET `/api/nexus/opps/lead-window/[id]` → renders `LeadGlassWindow`
- Back button restores workbench instantly (data preserved, no re-fetch)
- Opportunity cards are NOT clickable (only leads open glass window)
- Lead discrimination: `isLeadRecord()` checks for `contact_name` field presence
- Loading state: card shows "Opening..." while fetching

**LeadGlassWindow duplicate guard expanded:**
- Was: single mixed list
- Now: 5 labeled categories (Contact / Company / Property / Site / Opportunity Matches)
- Display only, no actions, no DB writes

**LeadGlassWindow sections:**
Overview · People · Property/Site · Activity Timeline · Tasks · Files · Surveys · Related Opportunities · Duplicate Guard (5 categories) · Next Best Actions

---

## Key Files and Their Locations

### Nexus Flow
| File | Purpose |
|------|---------|
| `components/nexus/ActionFlowSurface.tsx` | Main Nexus action surface — flow cards, inbound lead capture, workbench, lead glass window |
| `components/nexus/windows/LeadGlassWindow.tsx` | Lead glass workspace — full lead detail view |
| `app/api/nexus/flows/inbound-lead/route.ts` | POST: captures phone lead → creates in `leads` table |
| `app/api/nexus/opps/workbench/route.ts` | GET: scoped leads + opps for workbench |
| `app/api/nexus/opps/lead-window/[id]/route.ts` | GET: full lead glass data |

### Permissions
| File | Purpose |
|------|---------|
| `lib/current-user.ts` | OrgTier type, all user flags, canView* permissions |
| `lib/org-scope.ts` | `resolveOrgScope()` + `applyOrgScope()` — org hierarchy scoping |

### ARIA Engine
| File | Purpose |
|------|---------|
| `app/api/aria/research/deep/route.ts` | ARIA v8 — 4-phase engine, evidence packets, PropTech Scout |
| `app/aria/page.tsx` | ARIA UI — candidate grid, pipeline panel, Intel DB |

---

## Org Hierarchy (for reference)

| Tier | DB value | Abbreviation | TIER_RANK |
|------|----------|-------------|-----------|
| 0 | `corporate` | GG | 0 |
| 1 | `master_agent` | MA | 1 |
| 2 | `master_dealer` | MSO | 2 |
| 3A | `full_dealer` | SO | 3 |
| 3B | `service_dealer` | SP | 4 |
| 3C | `install_contractor` | IP | 4 |
| 3D | `sales_partner` | SLP | 4 |
| 4 | `client` | — | 5 |

Pay schedule: $10/unit/mo → GG keeps $5 → Dealer pool $5 (MA $0.50 fixed, MSO $0.50 fixed, SP $3.00 default, SLP $1.00 default, IP $0 recurring)

---

## Pending Commits (run from Mac Terminal)

### PATCH 1 + activities fix (beta)
```bash
git checkout beta
git checkout main -- \
  lib/current-user.ts \
  app/api/nexus/opps/workbench/route.ts \
  "app/api/crm/activities/[id]/route.ts"
git commit -m "fix: workbench security + canViewCRM service_dealer + activities PATCH"
git push origin beta
```

### PATCH 3 — Lead Glass Window (beta)
```bash
git checkout beta
git checkout main -- \
  components/nexus/ActionFlowSurface.tsx \
  components/nexus/windows/LeadGlassWindow.tsx
git commit -m "feat(patch-3): workbench → lead glass window"
git push origin beta
```

### All other session fixes (main)
```bash
git checkout main
rm -f .git/HEAD.lock .git/index.lock
git add -A
git commit -m "fix: ARIA v8 evidence packets + synthesis fallback + activities + inbound lead"
git push origin main
```

---

## Known Issues / Next Steps

### Not yet built
- Opportunity Glass Window
- Lead → Opportunity conversion flow
- Activity logging from inside the glass window
- Link/merge duplicate records
- ARIA integration inside Lead Glass Window

### Architecture notes
- `leads` table (migration 001) is the canonical leads table — `contact_name`, `company_name`, `org_id`
- `crm_leads` does NOT exist — never use it
- `activity_log` (migration 001) is for leads; `crm_activities` (migration 008) is for opportunities
- `opportunities.dealer_org_id` confirmed real (migration 002_crm_phase1.sql line 105)
- `crm_activities` has NO `updated_at` column — never add it to PATCH updates

### Beta has work not on main
Run `git fetch origin beta:beta && git diff --name-only main beta` to check before starting new sessions.
