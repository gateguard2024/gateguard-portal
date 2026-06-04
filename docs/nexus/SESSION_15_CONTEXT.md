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
Branch strategy: ALL Nexus work goes to `beta` first, then to `main` after approval.  
Git push rule (when merging to main): `git push origin main`  
**All work below is on `beta` only unless explicitly noted.**

---

## Branch State (as of end of session)

| Branch | State |
|--------|-------|
| `beta` | All Nexus sprints (A, B, B-polish, C, Jobs Stage 1 + 2), ARIA v8, org scoping fixes |
| `main` | ARIA v8 engine fixes + CLAUDE.md updates only. Does NOT have Nexus glass windows. |

**To start a new session on beta:**
```bash
git fetch origin
git checkout beta
git pull origin beta
```

**Protected beta files — never overwrite these:**
- `components/nexus/ActionFlowSurface.tsx`
- `components/nexus/windows/LeadGlassWindow.tsx`
- `components/nexus/windows/OpportunityGlassWindow.tsx`
- `components/nexus/windows/JobGlassWindow.tsx`
- `app/api/nexus/opps/workbench/route.ts`
- `app/api/nexus/opps/lead-window/[id]/route.ts`
- `app/api/nexus/opps/opportunity-window/[id]/route.ts`
- `app/api/nexus/jobs/workbench/route.ts`
- `app/api/nexus/jobs/job-window/[id]/route.ts`
- `app/api/nexus/flows/inbound-lead/route.ts`
- `lib/current-user.ts`
- `lib/org-scope.ts`

---

## Complete Build Log — What Is On Beta

### Patch 1 — Workbench Security + Org Scoping
- `lib/current-user.ts` — added `isServiceDealer` to `canViewCRM`
- `app/api/nexus/opps/workbench/route.ts` — `getCurrentUser()` + `resolveOrgScope()` + `applyOrgScope()` on all 6 queries; `leads.org_id`, `opportunities.dealer_org_id` confirmed real
- `app/api/crm/activities/[id]/route.ts` — removed `updated_at` (column DNE), fixed `duration_mins` → `duration_min`

### Patch 3 — Workbench → Lead Glass Window
- `components/nexus/ActionFlowSurface.tsx` — lead click state, `openLead()`, `closeLeadWindow()`, `refreshOpenLead()`
- `components/nexus/windows/LeadGlassWindow.tsx` — full glass card with 5-category duplicate guard

### Sprint 3.5 — My Leads
- `app/api/nexus/opps/workbench/route.ts` — `myLeads` section via `profiles.id` lookup
- `components/nexus/ActionFlowSurface.tsx` — My Leads tab first, `focusedEmptyText` per tab

### Sprint A — Lead Workspace Actions
- `app/api/nexus/opps/lead-window/[id]/route.ts` — POST: `add_note`, `log_call`, `schedule_followup`, `update_status`; security via `getScopedLead()`
- `components/nexus/windows/LeadGlassWindow.tsx` — action buttons + inline panels, `submitLeadAction()`, `onRefresh` prop

### Sprint B — Lead → Opportunity Glass Window
- `app/api/nexus/opps/lead-window/[id]/route.ts` — POST: `create_opportunity` (dedupe check, awaited lead update, awaited activity, returns `opportunityId`)
- `app/api/nexus/opps/opportunity-window/[id]/route.ts` — GET with full related data scoped by `dealer_org_id`
- `components/nexus/windows/OpportunityGlassWindow.tsx` — amber accent, 8 sections
- `components/nexus/ActionFlowSurface.tsx` — `openOpportunity()`, `closeOpportunityWindow()`, opportunity cards clickable

### Sprint B Polish — Auto-Open Opportunity After Conversion
- `app/api/nexus/opps/lead-window/[id]/route.ts` — all 3 opportunity cases now return `opportunityId`; lead update + activity log both awaited
- `components/nexus/windows/LeadGlassWindow.tsx` — `onOpenOpportunity` prop; `submitLeadAction` detects `create_opportunity` + calls `onOpenOpportunity(id)`
- `components/nexus/ActionFlowSurface.tsx` — passes `onOpenOpportunity={async (id) => { closeLeadWindow(); await openOpportunity(id) }}`

### Sprint C — ARIA Workflow Into Beta
- `app/api/aria/research/deep/route.ts` — copied from `origin/main` (all v8 tickets)
- `app/aria/page.tsx` — copied from `origin/main` (CandidateGrid `viewMode === 'candidates'` fix)
- `docs/nexus/ARIA_ROUTE_MAP.md` — future launch points for Lead/Opportunity/Site/Project

### Jobs Stage 1 — Glass Window Foundation
- `app/api/nexus/jobs/workbench/route.ts` — 5 sections (My Jobs, Needs Attention, Scheduled Today, Open Jobs, Recently Updated), `resolveProfileId()` for My Jobs via `work_orders.assigned_to`
- `app/api/nexus/jobs/job-window/[id]/route.ts` — GET with site, assignedTeam, tasks, checklist, notes, parts, files, subWorkOrders, fieldTickets, timeEntries
- `components/nexus/windows/JobGlassWindow.tsx` — emerald accent, 10 sections, Stage 1 actions display-only
- `components/nexus/ActionFlowSurface.tsx` — Jobs tab, `openJob()`, `closeJobWindow()`, job cards clickable

### Jobs Stage 2 — Actionable Job Glass Window
- `app/api/nexus/jobs/job-window/[id]/route.ts` — POST: `add_note` (wo_comments), `create_task` (todos), `schedule_visit` (update WO + comment), `mark_complete` (update WO + comment); `getScopedJob()` helper; TODO comment for `assignee_org_id`
- `components/nexus/windows/JobGlassWindow.tsx` — `useState` import, `JobAction` type, `onRefresh` prop, `submitJobAction()`, all 4 action buttons wired with inline panels
- `components/nexus/ActionFlowSurface.tsx` — `refreshOpenJob()`, passes `onRefresh` to `JobGlassWindow`
- **Field handoff:** Open Field View → `/maintenance/${job.id}` (existing safe legacy route), opens in new tab
- **Disabled:** Assign Team, Upload File (labeled "Coming in a future stage")

---

## Schema Facts Confirmed From Live DB

```
work_orders columns: org_id (uuid), assigned_to (uuid), assignee_id (uuid)
work_orders.assignee_org_id: ❌ DOES NOT EXIST in live schema
→ Use org_id scoping. Install contractor scoping is a future TODO.

leads.assigned_to → profiles.id (UUID FK)
opportunities.dealer_org_id → organizations.id (UUID FK, confirmed 002_crm_phase1.sql line 105)
todos.assigned_to → TEXT (Clerk user ID — not a UUID FK)
activities.dealer_org_id → organizations.id (NOT org_id)
wo_comments columns: id, work_order_id, author_name, author_initials, content, created_at
```

---

## Identity Chain (canonical)

```
Clerk User
  → profiles.clerk_user_id (TEXT)
  → profiles.id (UUID)
  → leads.assigned_to (UUID FK)
  → work_orders.assigned_to (UUID FK)

todos.assigned_to = Clerk user ID (TEXT) — different from above
```

---

## Current Nexus Glass Workflow

```
Someone Called → Inbound Lead Capture
    ↓
Create Lead → Workbench → My Leads / Open Leads
    ↓
Lead Glass Window
  → Add Note / Log Call / Schedule Follow-Up / Update Status
  → Create Opportunity (auto-opens Opportunity Glass Window)
    ↓
Opportunity Glass Window
  → Next Best Actions (display only in Stage 1)
    ↓
Jobs Tab → My Jobs / Open Jobs / Scheduled Today
    ↓
Job Glass Window
  → Add Note (wo_comments)
  → Create Task (todos)
  → Schedule Visit (updates work_orders)
  → Mark Complete (updates work_orders)
  → Open Field View → /maintenance/[id]
```

---

## Files Not Yet Built

- Opportunity Glass Window actions (Stage 2 TBD)
- Assign Team on Job Glass Window
- Upload File on Job Glass Window
- Field Glass Window (Stage 1 TBD)
- People tab glass window
- ARIA integration inside Lead/Opportunity/Job glass windows

---

## Pending Commits (run from beta branch)

All recent changes are already committed to beta via the sprints above.  
To push everything to main when ready:

```bash
git checkout main
git merge beta --no-edit
git push origin main
```

---

## Key Reference Files

| File | Purpose |
|------|---------|
| `docs/nexus/ARIA_ROUTE_MAP.md` | ARIA routes + future launch points |
| `docs/nexus/PATCH_1_WORKBENCH_SECURITY.md` | Workbench security patch notes |
| `docs/nexus/PATCH_3_LEAD_GLASS_WINDOW.md` | Lead glass window patch notes |
| `docs/nexus/SUPABASE_SCHEMA.json` | All 128 tables with columns + FK refs |
| `CLAUDE.md` | Prime Directive + full session history |
