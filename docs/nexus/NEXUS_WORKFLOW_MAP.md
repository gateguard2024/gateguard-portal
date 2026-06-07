# Nexus Workflow Map

_Last updated: Phase A complete_

## North Star

Nexus is the primary operating layer for Gate Guard. The old portal modules remain available as deep tools, but normal users should not have to think in modules.

A fifth grader should be able to answer:

- What do I need to handle today?
- Who am I selling to?
- What job needs work?
- Which customer or property is this about?
- What money or paperwork needs attention?
- What internal/admin work needs managing?

## Core UX Rule

Every Nexus section should follow this pattern:

```txt
Simple card
↓
Glass board
↓
Action rail
↓
Open deep object or legacy page only when needed
```

Avoid:

- raw tables first
- module dumps
- unexplained legacy pages
- choices that require training
- more than four first-level cards unless clearly necessary

## Bottom Navigation

The Nexus bottom nav is locked as:

```txt
My Day
Sales
Jobs
Customers/Sites
Money/Docs
Internal
```

Current route mapping:

| Bottom Nav | Current Surface | Status |
|---|---|---|
| My Day | `MyDaySurface` | Phase 1 live |
| Sales | `SalesSurface` | Phase 1 live |
| Jobs | `JobsSurface` | Phase 1 live plus board actions |
| Customers/Sites | `CustomersSitesSurface` | Phase 1 live |
| Money/Docs | `MoneyDocsSurface` | Phase 1 live |
| Internal | `InternalSurface` | Phase 1 live |

## Section Ownership

### My Day

Question:

```txt
What needs your attention today?
```

Cards:

```txt
Today’s Schedule
Top 10 Things
To-Dos
Email
```

Owns / pulls from:

- calendar events
- todos
- jobs due today
- CRM follow-ups
- tracker tasks
- renewals
- invoices
- documents
- compliance items
- important email later

Current state:

- Default landing page
- Add event exists
- Top 10 selection exists
- Mark Done exists for supported item types
- Add Note exists for work orders
- Open Related exists for work orders

Remaining:

- Snooze
- Open Related for non-work-order items
- To-Do full actions
- Email connectors
- richer Top 10 ranking across all sections

### Sales

Question:

```txt
What sales work are we doing?
```

Cards:

```txt
Add New Lead
Work My Leads
Create / Work Quotes
Research Property
```

Owns / absorbs:

- CRM
- leads
- opportunities
- quotes
- surveys
- ARIA research
- marketplace later
- reps and commissions later
- marketing later

Current state:

- New lead/work lead flow is preserved inside Sales
- Quote actions link to quote routes
- ARIA launches from Research Property

Remaining:

- Sales boards should become data-backed
- Lead Glass
- Opportunity Glass
- Quote board
- ARIA recent searches and create-lead handoff

### Jobs

Question:

```txt
What job work needs attention right now?
```

Cards:

```txt
Today’s Jobs
Needs Attention
Schedule Visit
Open Jobs
```

Owns / absorbs:

- work orders
- dispatch
- projects
- incidents
- tech tool
- inventory
- subcontractors
- knowledge base

Current state:

- Jobs workbench exists
- Job rows are selectable
- Action rail exists
- Open Job Glass exists
- Add Note, Schedule Visit, Create Task, Mark Complete exist at board level

Remaining:

- confirm scheduled visit to calendar/My Day loop after migration
- create job flow
- assign team
- upload files
- tighter success states

### Customers/Sites

Question:

```txt
Who or what property are we working on?
```

Cards:

```txt
Find Customer
Find Property
Properties Needing Attention
Property Systems
```

Owns / absorbs:

- customers
- properties
- sites
- contacts
- customer portal context
- dealer sites
- cameras
- access control
- networks
- gates
- floor plans
- as-builts
- system design
- ARIA property intel

Current state:

- Phase 1 command center exists
- Glass boards exist
- Search boxes are placeholders
- Deep action links exist

Remaining:

- real customer/property search
- Customer Glass
- Property/Site Glass
- related jobs, quotes, invoices, documents, systems, ARIA intel
- Properties Needing Attention board
- Property Systems board

### Money/Docs

Question:

```txt
What money or paperwork needs attention?
```

Cards:

```txt
Invoices
Renewals
Documents to Sign
Compliance
```

Owns / absorbs:

- billing
- revenue
- expenses
- documents
- renewals
- compliance
- vendor compliance
- NDAs
- dealer agreements
- e-sign flows

Current state:

- Phase 1 command center exists
- Glass boards exist
- Deep action links exist
- Boards are placeholders

Remaining:

- invoice board
- past due board
- renewal board
- document signature board
- compliance gaps board

### Internal

Question:

```txt
What internal work are we managing?
```

Cards:

```txt
Tracker
Users & Features
Playbooks
Training
```

Owns / absorbs:

- Nexus Tracker
- dealer admin
- platform users
- feature settings
- playbook
- co-op pool
- customer portal admin
- quests
- scorecard
- training
- dealer team

Current state:

- Phase 1 command center exists
- Glass boards exist
- Deep action links exist

Important rule:

Internal must be role/permission gated. Normal dealer/customer users should not be sent into Internal unless they have access.

Remaining:

- permission gating
- Nexus Tracker board
- users/features board
- playbooks search
- training/quests/scorecard board

## Legacy Page Rule

Legacy pages should not be first-level user decisions. They should be reachable only as deep actions from the correct Nexus workflow.

Examples:

- `/crm` belongs under Sales
- `/quotes` belongs under Sales
- `/aria` belongs under Sales and Customers/Sites
- `/maintenance` and `/dispatch` belong under Jobs
- `/customers` and `/sites` belong under Customers/Sites
- `/billing`, `/documents`, `/renewals`, `/compliance` belong under Money/Docs
- `/tracker`, `/feature-settings`, `/platform-users`, `/playbook`, `/training` belong under Internal

## Build Status

### Complete

```txt
Phase A: six command centers
Theme pass: good enough to continue
My Day default landing
Sales command center
Jobs command center
Customers/Sites command center
Money/Docs command center
Internal command center
```

### Next Recommended Build Order

1. Customers/Sites real search
2. Customer Glass and Property/Site Glass
3. Money/Docs data-backed boards
4. Internal Tracker board
5. My Day Snooze and Open Related cleanup
6. Shared Nexus components refactor
7. Final CSS polish pass

## Next Phase: Data-Backed Boards

Phase B should stop adding new top-level shells and start making the boards real.

Recommended first target:

```txt
Customers/Sites Phase 2
- real search endpoint or use existing customer/site APIs
- show search results in glass board
- select customer/property
- open Customer Glass or Property/Site Glass
```

Why first:

Customers/Sites becomes the bridge between Sales, Jobs, Money/Docs, Systems, and ARIA.

## Shared Component Refactor

Do this after the first data-backed board is working, not before.

Candidate shared components:

```txt
NexusWorkflowCard
NexusGlassBoard
NexusActionRail
NexusSearchBox
NexusEmptyState
NexusStatusMessage
NexusGlyphTile
```

## Visual Direction

Keep:

- dark navy / black security-tech base
- electric cobalt and cyan accents
- subtle violet/green/gold per section
- glass boards
- glyph tiles
- professional premium look

Avoid:

- cartoon colors
- too much transparency
- placeholder circles
- generic SaaS feel
- dense tables as the first screen

Final visual polish can wait until after larger workflows are real.
