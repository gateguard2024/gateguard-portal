# Nexus AI Handoff Strategy
## Contextual Guidance Per Page — "Mickey Mouse Simple" Principle

> Last updated: June 2026  
> Rule: Every major page should answer "what do I do next?" for a user who just landed there. Nexus reads the user's data state and surfaces one clear action, not a menu.

---

## The Principle

**Mickey Mouse simple** means: the user should never be confused about what to do next. The AI prompt on each page is not a help tooltip — it's a personal assistant who looked at your data and says "here's your move."

The Nexus floating assistant already exists (`components/layout/NexusAssistant.tsx`). The strategy below defines:
1. What **context** to pass Nexus from each page
2. What **opening prompt** Nexus should offer (one sentence, action-oriented)
3. What **follow-up actions** Nexus should be able to execute directly

---

## Page-by-Page Specifications

---

### Dashboard (`/`)

**Data state signals:**
- Count of overdue todos
- Open work orders with no tech assigned
- Quotes pending approval > 48h
- Q2 Rocks with status "off track"
- Accounts with no activity > 30 days

**Opening prompt (dynamic, first match wins):**
- `"You have 3 overdue tasks and 2 unassigned work orders. Want me to help you triage?"`
- `"Nexus Corp quote has been pending VP approval for 3 days — want me to draft a follow-up?"`
- `"2 of your Q2 Rocks are off track. Want to review and update the scorecard?"`
- `"Things look clear. Want a summary of the week's pipeline activity?"` (zero-issues state)

**Actions Nexus can execute:**
- Create a to-do
- Flag a work order for follow-up
- Draft a follow-up email for a stalled quote
- Pull up the L10 agenda

---

### CRM Dashboard (`/crm`)

**Data state signals:**
- Opportunities in "sent" stage > 14 days with no activity
- Leads with no owner assigned
- Deals closing this month vs pipeline
- Win rate trend (up/down vs last quarter)

**Opening prompt:**
- `"4 opportunities haven't had any activity in 2+ weeks. Want me to list them so you can decide next steps?"`
- `"You have 7 unassigned leads. Want me to help route them?"`
- `"Pipeline is looking light for Q3 close. Want me to pull properties from ARIA that match your typical deal profile?"`

**Actions Nexus can execute:**
- Assign leads to reps
- Create a follow-up activity on a stalled opportunity
- Launch an ARIA search for new prospects matching a profile
- Pull win/loss summary for a date range

---

### ARIA Lead Intelligence (`/aria`)

**Data state signals:**
- No search yet (fresh landing)
- Last search was > 7 days ago
- Properties in Intel DB with `contract_expiry_year` = current year or next year
- Properties with `sales_stage = 'prospect'` and no contact logged in 30 days

**Opening prompt:**
- `"Ready to find your next property? Try searching by address, property name, or a type like 'luxury multifamily Atlanta.'"`
- `"You have 3 properties with contracts expiring this year — want me to surface them so you can prioritize outreach?"`
- `"Stonegate at Park Ave hasn't been touched in 32 days. Want the cold call script?"`

**Actions Nexus can execute:**
- Launch an ARIA search
- Surface expiring contracts from the Intel DB
- Generate a cold call script for a specific property
- Create a CRM activity for a property's DM

---

### Quotes (`/quotes`)

**Data state signals:**
- Quotes in "sent" stage with no client view yet
- Quotes in "draft" older than 5 days
- Margin below 25% approval threshold
- Won quotes with no job created

**Opening prompt:**
- `"The Bridgewater proposal was sent 6 days ago and hasn't been viewed. Want me to draft a check-in email?"`
- `"You have 2 draft quotes sitting for 7+ days. Want to review and send them?"`
- `"The Nexus Corp quote was just accepted — want me to create a job for it?"`

**Actions Nexus can execute:**
- Draft follow-up email for a sent quote
- Create a job from a won quote
- Flag a low-margin quote for VP review
- Pull the proposal preview link to share

---

### Quote Builder (`/quotes/[id]`)

**Data state signals:**
- Missing required CPQ line items (dependency warnings)
- Margin below threshold
- No site survey linked
- Sections with no line items added

**Opening prompt:**
- `"You're missing cameras in this quote but have an access control scope. Want me to suggest a camera package?"`
- `"Margin is at 19% — below the 25% approval floor. Want help adjusting to avoid the VP hold?"`
- `"This quote has no site survey linked. Want me to find the survey for this property?"`

**Actions Nexus can execute:**
- Suggest missing line items based on scope
- Recalculate pricing to hit margin threshold
- Link a survey to the quote
- Draft the client-facing proposal summary

---

### Projects (`/projects`)

**Data state signals:**
- Jobs with no tech assigned
- Jobs past target completion date
- Jobs stuck on the same stage for > 7 days
- Recent won opportunity with no job created

**Opening prompt:**
- `"3 active jobs have no tech assigned. Want me to list them?"`
- `"Stonegate install is 12 days past target completion. Want to log an update?"`
- `"You just won the Bridgewater opportunity. Want to create a New Install job for it?"`
- `"The Parkview procurement stage has had no progress for 9 days. Want to flag it?"`

**Actions Nexus can execute:**
- Create a new job
- Assign a tech to a job
- Log a progress note on a stuck stage
- Mark a task complete

---

### Work Orders / Dispatch (`/maintenance`, `/dispatch`)

**Data state signals:**
- Open work orders with no scheduled date
- Techs with no jobs today
- Work orders past due date
- Unresolved escalations

**Opening prompt:**
- `"2 work orders are open with no scheduled date. Want me to show them so you can book them?"`
- `"Marcus has no jobs scheduled today. Want to assign him something from the open queue?"`
- `"WO-1047 at Midtown Place is 3 days overdue. Want to reach out to the client?"`

**Actions Nexus can execute:**
- Schedule a work order for a specific tech/date
- Create a new work order
- Draft a client delay notification
- Escalate a WO to supervisor

---

### Calendar (`/calendar`)

**Data state signals:**
- Todos due today with no time blocked
- Work orders scheduled today
- GCal sync status (last synced timestamp)
- Tomorrow has nothing scheduled (open day)

**Opening prompt:**
- `"You have 4 tasks due today but nothing blocked on the calendar. Want me to time-block them?"`
- `"2 work orders are on the schedule for tomorrow. Want a prep summary?"`
- `"GCal hasn't synced in 48 hours. Want me to trigger a sync?"`

**Actions Nexus can execute:**
- Create a calendar block for a todo
- Trigger GCal sync
- Pull a daily briefing for today or tomorrow
- Draft a WO prep checklist for a scheduled job

---

### Sites / Properties (`/sites`, `/sites/[id]`)

**Data state signals:**
- Site with no service contract
- Site with overdue PM schedule
- Site with open work orders
- Site with no floor plan on file

**Opening prompt:**
- `"Stonegate has no floor plan on file. Want to upload or start one?"`
- `"This property's quarterly PM is 18 days overdue. Want to create a work order?"`
- `"No active service contract for this site. Want to create a quote for a service agreement?"`

**Actions Nexus can execute:**
- Create a work order for a PM
- Start a quote for a service agreement
- Trigger a site survey flow
- Pull site activity history

---

### Billing / Invoices (`/billing`)

**Data state signals:**
- Invoices past due > 30 days
- Invoices with no payment link attached
- Jobs completed with no final invoice sent
- Commission payouts pending approval

**Opening prompt:**
- `"3 invoices are 30+ days past due. Want me to draft collection follow-ups?"`
- `"The Bridgewater final invoice hasn't been sent — the job completed 5 days ago. Want me to generate it?"`
- `"2 commission payouts are pending your approval. Want to review them?"`

**Actions Nexus can execute:**
- Draft payment follow-up email
- Generate invoice from a completed job
- Create a payment link via Stripe
- Approve pending commission payout

---

### Documents (`/documents`)

**Data state signals:**
- Unsigned NDAs or agreements
- Documents expiring within 60 days
- Dealer with no executed agreement on file

**Opening prompt:**
- `"Nexus Corp's Dealer Agreement is still waiting for your countersignature."`
- `"3 vendor compliance documents expire within 60 days. Want a renewal list?"`
- `"First Energy has no NDA on file. Want to send one?"`

**Actions Nexus can execute:**
- Countersign a document
- Send an NDA or agreement to a dealer
- Create a renewal reminder
- Upload a signed document

---

## Implementation Notes

### Context Injection Pattern
Each page should pass a `nexusContext` object to the NexusAssistant on mount:

```typescript
// Example: Projects page
useEffect(() => {
  setNexusContext({
    page: 'projects',
    signals: {
      unassigned_jobs: jobs.filter(j => !j.assigned_tech_id).length,
      overdue_jobs: jobs.filter(j => j.target_completion_date && new Date(j.target_completion_date) < new Date() && j.status === 'active').length,
      stalled_jobs: jobs.filter(j => /* last activity > 7 days */).length,
    }
  })
}, [jobs])
```

### Priority Ordering
Nexus should always surface the **highest urgency signal first**:
1. Overdue / past-due anything
2. Blocked workflows (approval needed, unassigned)
3. Stale records (no activity in N days)
4. Opportunities (won deals, expiring contracts)
5. General guidance (empty state help)

### Tone Rules
- Never say "It looks like..." or "I noticed that..."
- Lead with the fact: `"3 invoices are overdue"` not `"It seems some invoices may need attention"`
- One sentence. One action. Don't list options unless the user asks.
- Zero jargon that a new hire wouldn't know day one.

### Empty State (New User, No Data)
If a page has no data at all, Nexus should say exactly what to do first:
- Dashboard: `"Let's start by adding your first customer account. Want me to walk you through it?"`
- CRM: `"No opportunities yet. Want to add a lead or import from ARIA?"`
- Projects: `"No jobs yet. Win an opportunity in CRM to create your first one, or create a job manually."`
- ARIA: `"Ready to research your first property. Type an address or property name above."`

---

## Priority Build Order

1. **NexusContext API** — a `setNexusContext(signals)` function available to all pages (store in React context or Zustand slice)
2. **Opening prompt logic** — Haiku call on page load with the signal map → returns one-sentence prompt
3. **Action wiring** — each page registers the actions Nexus can take (create WO, send email, etc.) as callable functions
4. **Pages to wire first** (highest ROI): Dashboard, Quotes, ARIA, Projects
5. **Pages to wire second**: CRM, Dispatch/Work Orders, Calendar
6. **Pages to wire last**: Sites, Documents, Billing
