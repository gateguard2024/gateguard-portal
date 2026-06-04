# PATCH 3 — Workbench → Lead Glass Window

**Branch:** beta only  
**Status:** Ready to commit  
**Date:** June 3, 2026

---

## What This Patch Does

Wires the Opps/Leads Workbench to the Lead Glass Window. Clicking any lead card in the workbench opens a full glass workspace showing everything known about that lead — people, company, property, activity, tasks, files, surveys, opportunities, and a 5-category duplicate guard — without leaving the Nexus surface. Back button returns to the workbench instantly with no re-fetch.

---

## Files Changed (2 total)

```
components/nexus/ActionFlowSurface.tsx
components/nexus/windows/LeadGlassWindow.tsx
```

---

## Change 1 — ActionFlowSurface.tsx

### New import
```typescript
import { LeadGlassWindow } from '@/components/nexus/windows/LeadGlassWindow'
```

### New state
```typescript
const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
const [leadWindowData, setLeadWindowData] = useState<Record<string, unknown> | null>(null)
const [leadWindowBusy, setLeadWindowBusy] = useState(false)
const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null)
```

### New loader function
```typescript
async function fetchLeadWindow(id: string): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/nexus/opps/lead-window/${id}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) throw new Error(data?.message ?? 'Could not open lead.')
  return data
}

async function openLead(id: string) {
  setLeadWindowBusy(true)
  setLoadingLeadId(id)
  try {
    const data = await fetchLeadWindow(id)
    setSelectedLeadId(id)
    setLeadWindowData(data)
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not open lead.')
  } finally {
    setLeadWindowBusy(false)
    setLoadingLeadId(null)
  }
}
```

### Close / back function
```typescript
function closeLeadWindow() {
  setSelectedLeadId(null)
  setLeadWindowData(null)
  // Workbench data is preserved — returns to prior view instantly, no re-fetch
}
```

### Lead vs opportunity discrimination
```typescript
// Leads from the API have contact_name; opportunities have name
function isLeadRecord(record: WorkbenchRecord): boolean {
  return 'contact_name' in record
}
```

### RecordList — lead cards clickable, opportunity cards unchanged
```typescript
function RecordList({ records, emptyText, onLeadClick, leadWindowBusy, loadingLeadId }) {
  // Lead cards: onClick → openLead(record.id), cursor-pointer, keyboard accessible
  // Opp cards: no onClick, no cursor
  // Loading card: shows 'Opening...' + highlighted border while fetching
}
```

### Lead window renders over workbench
```typescript
{selectedLeadId && leadWindowData && (
  <LeadGlassWindow
    data={leadWindowData}
    onBack={closeLeadWindow}
  />
)}

{!(selectedLeadId && leadWindowData) && (
  // Normal flow: start cards, workbench, capture steps
)}
```

### WorkbenchRecord type updated
Added `contact_name?`, `company_name?`, `management_co?`, `location?` to handle both leads and opportunities from the API correctly.

---

## Change 2 — LeadGlassWindow.tsx

### Duplicate Guard — split into 5 labeled categories

**Before:** Single mixed list of all possible matches.

**After:** `DuplicateGuardSection` component with 5 separate labeled subsections:

```
Possible Contact Matches    — from data.people.contacts
Possible Company Matches    — from data.company
Possible Property Matches   — from data.properties.possible
Possible Site Matches       — from data.properties.sites
Possible Opportunity Matches — from data.opportunities
```

Each category shows its own count and "No possible X matches found." empty state.  
Display only. No actions. No database writes. No linking.

### All existing sections preserved
Overview · People · Property/Site · Activity Timeline · Tasks · Files · Surveys · Related Opportunities · Next Best Actions

---

## API Used

**GET** `/api/nexus/opps/lead-window/[id]`  
Returns: `{ lead, people: { primaryContact, contacts }, company, properties: { linked, possible, sites }, activity: { activities, crmActivities }, todos, attachments, surveys, opportunities, nextBestActions }`

The response maps directly to `LeadGlassData` — no transformation needed.

---

## Flow Diagram

```
Workbench (openLeads / needsAttention / search)
  ↓ click lead card
openLead(id) → GET /api/nexus/opps/lead-window/[id]
  ↓ success
setSelectedLeadId + setLeadWindowData
  ↓
LeadGlassWindow renders (workbench hidden, not destroyed)
  ↓ "← Back to workbench"
closeLeadWindow() → clears selectedLeadId + leadWindowData
  ↓
Workbench reappears instantly (data already in state)
```

---

## Acceptance Tests

| Test | Pass Condition |
|------|---------------|
| Create Lead → Workbench → Lead Visible | Lead card shows with `contact_name` as title, `Open →` hint |
| Click Lead → Lead Window Opens | `openLead()` fires, `LeadGlassWindow` renders with full data |
| Back Button → Returns To Workbench | `closeLeadWindow()` runs, workbench state preserved, no re-fetch |
| Opportunity cards not clickable | `isLeadRecord()` returns false for opps (no `contact_name` field) |
| All sections present | Overview, People, Property, Activities, Tasks, Files, Surveys, Opportunities, Duplicate Guard (5 categories), Next Best Actions |

---

## Commit Command (run on beta branch)

```bash
cd ~/Documents/GitHub/gateguard-portal
git checkout beta
git checkout main -- \
  components/nexus/ActionFlowSurface.tsx \
  components/nexus/windows/LeadGlassWindow.tsx
git commit -m "feat(patch-3): workbench → lead glass window

ActionFlowSurface.tsx:
- Import LeadGlassWindow
- Add selectedLeadId, leadWindowData, leadWindowBusy, loadingLeadId state
- Add fetchLeadWindow() and openLead(id) with loading state + error handling
- Add closeLeadWindow() — workbench data preserved, returns instantly
- isLeadRecord() discriminates leads (contact_name) from opps (name)
- RecordList: lead cards clickable, opp cards unchanged
- LeadGlassWindow renders over workbench when lead is open

LeadGlassWindow.tsx:
- DuplicateGuardSection: 5 labeled categories
  (Contact / Company / Property / Site / Opportunity Matches)
- Display only, no actions, no DB writes"
git push origin beta
```

---

## What Was NOT Changed

- Opportunity Glass Window (not built yet)
- ARIA integration
- Jobs / Projects / Field
- Any existing pages or routes
- lib/current-user.ts
- lib/org-scope.ts
- Any API routes

---

## Beta Only Confirmation

These changes are in the workspace filesystem (main branch). They are NOT committed to main or beta yet. Running the commit command above applies them to beta only via `git checkout main -- <files>`.
