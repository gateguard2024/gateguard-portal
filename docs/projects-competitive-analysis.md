# GateGuard Projects — Competitive UX Analysis
**Build guide for sprints 14–15 | June 2026**

---

## Monday.com

**What it is in one sentence:** A visual work OS built around color-coded status columns that make job state immediately readable at 30 feet.

### UX Patterns Worth Copying

**1. The Status Column as the primary atom of work.**
Every row has a colored status pill — one click opens a floating label picker, not a modal, not a drawer. The color floods the entire cell. This means at a glance, you can read the health of 40 jobs in 3 seconds. Monday's genius is making status change feel like flipping a light switch rather than filling out a form. For GateGuard: every job card should have a single dominant status chip that updates in one click, with the color immediately repainting the chip and the row highlight.

**2. Column-level automation triggered by status change.**
When a status column changes to "Done," Monday can automatically notify a person, move the item to another group, and create a linked item in another board — all without leaving the row. The key UX move: automation is written in plain English ("When status changes to X, do Y") and lives on the board, not in a separate admin panel. For GateGuard: "When stage changes to 'QC Complete' → create final invoice task and notify billing."

**3. Group rows as collapsible swim lanes.**
Boards are organized into named Groups (e.g., "This Week," "Awaiting Equipment," "On Hold"). Groups are drag-collapsed with one click. For a field service company running 20 simultaneous installs, this is how you stop a board from becoming a wall of noise.

### Field Service Relevance
Monday has a construction template that pre-builds groups by phase (Pre-Construction, Active, Punch List, Closeout). The automation recipes for contractor notifications and milestone-based billing approvals are directly applicable to GateGuard's deposit → procurement → install → QC → final bill flow.

---

## Asana

**What it is in one sentence:** The cleanest task-to-project hierarchy in the industry, with subtask threading that doesn't collapse into chaos.

### UX Patterns Worth Copying

**1. Task detail panel slides in from the right — never replaces the list.**
Click a task in Asana and a right-side panel slides in at 40% width. The list view stays visible on the left. You can edit the task detail, add subtasks, read the comment thread, and change the assignee — then close the panel and you're exactly where you were. No back-navigation. No losing your scroll position. This is the single most underrated pattern in task UIs and the most commonly screwed up.

**2. Subtask threading with real visual depth.**
Asana lets you add subtasks to any task, and those subtasks can have subtasks. Each level is visually indented. For a gate install job, this maps perfectly: Job → [Deposit Collected, Equipment Order, Schedule Install Date → [Confirm tech, Pre-wire check], QC Sign-off, Final Invoice]. The depth stays readable because Asana limits visual nesting to 2-3 levels before flattening.

**3. Progress on the project card itself.**
Every project in Asana shows a completion ring or progress bar on its tile in the "My Projects" view. Before you open a job, you can see it's 3/7 tasks done. That's the right answer to "how far along is this install?" — visible without drilling in.

### Field Service Relevance
Asana's Portfolios feature (collections of projects with a roll-up status row per project) is exactly how a dispatcher would want to see 12 active jobs: one row per job, columns for stage, tech assigned, due date, and completion %. Worth building a stripped version of this into GateGuard Projects' List view.

---

## ClickUp

**What it is in one sentence:** The most customizable task tool ever built, which is both its power and its warning label.

### UX Patterns Worth Copying

**1. Slash commands and keyboard-first task creation.**
In any text field in ClickUp, typing `/` opens a command palette: `/assign`, `/due`, `/status`, `/tag`. You can create a fully configured task without touching a mouse. For GateGuard's dispatch team, this means "new job: Alpine Terrace, New Install, due Friday, assigned to Marcus" in about 6 keystrokes. The NL quick-add bar we already built is the right instinct — extend it with `/` commands.

**2. Custom task types with distinct icons and workflows.**
ClickUp lets you define task types (Bug, Feature, Milestone, etc.) with unique icons. More importantly, each type can have a different set of statuses. A "Service Job" type should have different stages than a "New Install" type — ClickUp figured this out. Our pre-seeded stage sets per job type are the right move; make the type visually distinct on every card (icon + label color) so a dispatcher scanning 20 cards knows in 1 second what kind of work each is.

**3. Bulk action toolbar.**
Select 5 tasks via checkbox → a floating toolbar appears at the bottom of the screen with: Assign, Set Due Date, Move to Stage, Delete. This is how you handle Monday morning dispatch — you pick all jobs that need a tech assigned and batch-assign in one action.

### Field Service Relevance
ClickUp's "Custom Fields" approach (add a field to a task type that only applies to that type) is exactly what GateGuard needs: a New Install job should show "PO Number" and "Equipment Received" fields. A Service job should show "SLA Tier" and "Contract Reference." Don't show all fields on all jobs.

---

## Smartsheet

**What it is in one sentence:** Excel for people who need a project plan that doesn't break when two people edit it.

### UX Patterns Worth Copying

**1. Inline grid editing as the default interaction.**
In Smartsheet, every cell in the grid is editable on click — no modal, no panel. Click a cell, type, Tab to next cell. This is spreadsheet muscle memory applied to project management. For GateGuard's Grid view (which we already have), every field should be click-to-edit inline. No "Edit" button. No modal for changing a due date.

**2. Row hierarchy with indent/outdent.**
Smartsheet lets you indent any row to make it a child of the row above, creating a project outline hierarchy. Parent rows auto-roll up percent complete and dates from children. This maps directly to phases within a job (Phase: Equipment Procurement → [Order placed, Shipped, Received confirmed]).

**3. Conditional formatting rules on columns.**
If "Days Until Due" < 3, paint the row red. If status = "Blocked," bold the row. These rules are set once per sheet and apply automatically. For a field service manager reviewing 30 jobs, this is how overdue and at-risk work surfaces without anyone having to flag it manually.

### Field Service Relevance
Smartsheet has domain-specific construction templates (contractor tracking, site schedules, permit visualization) that are structurally identical to GateGuard's job workflow. Their Gantt view auto-calculates critical path from task dependencies — useful once GateGuard jobs have dependency chains.

---

## Wrike

**What it is in one sentence:** The enterprise-grade option with the best Gantt chart and the worst onboarding.

### UX Patterns Worth Copying

**1. Interactive Gantt with drag-to-reschedule and dependency arrows.**
Wrike's Gantt lets you grab the right edge of any task bar and drag it to extend the duration. Drag the bar body to move it. Dependency arrows visually connect tasks (finish-to-start), and moving a predecessor automatically cascades the dates forward. For a multi-phase install (equipment arrives → install can begin → QC can begin), this is the right model.

**2. Blueprint templates that spawn fully configured projects.**
Wrike's "Blueprint" feature lets you save a complete project structure (stages, task list, assignee roles, dependencies) as a template. Creating a new "New Install" job from a Blueprint pre-populates all 6 stages, all standard subtasks, and all dependency chains in one click. That is the correct answer to "how do we onboard a new job fast."

**3. Effort vs. duration tracking.**
Wrike distinguishes between how long a task will take (duration = 3 days) and how much work it requires (effort = 4 hours). A technician can spend 4 hours of work across 3 days. For billing and payroll purposes this is the data you actually need. Most tools collapse these into one field.

### Field Service Relevance
Wrike explicitly notes it lacks built-in Gantt tools tailored for field scheduling — meaning they think in project weeks, not dispatch slots. GateGuard should own the dispatch-day scheduling layer (already in the Dispatch page) and use Projects for the job lifecycle above it.

---

## Trello

**What it is in one sentence:** The Kanban board that taught an entire generation of software teams how to think in columns.

### UX Patterns Worth Copying

**1. Card drag that feels physical.**
When you drag a Trello card, it rotates 2–3 degrees and follows your cursor with slight lag (like a real card). The original position shows a placeholder. Drop zones highlight when you enter a column. These micro-interactions are not decorative — they give the user confidence that the action is real and reversible. Our Board view's drag-and-drop should apply this same physical metaphor: rotate on grab, placeholder in origin, highlight on hover.

**2. Card covers for visual scanning.**
Trello cards support a "cover" — a full-bleed color or image across the top of the card. For GateGuard jobs, a color-coded cover by job type (blue = New Install, green = Service, orange = Small Install→Service) means dispatchers can scan the board without reading labels.

**3. Minimal card → rich card expansion.**
A Trello card in the board view shows title, label, assignee avatar, and due date. Click it and a full modal opens with description, checklist, attachments, comments, and custom fields. The board stays uncluttered because the card itself is ruthlessly minimal. GateGuard cards should follow this: title + job type icon + tech avatar + due date + status pill. Everything else lives in the drawer.

### Field Service Relevance
Trello's simplicity makes it the best tool for technician-facing views. A tech shouldn't see a Gantt. They should see "My Jobs Today" as a column of cards. Trello's model (one column per state, drag to advance) is the right UX for a tech-facing mobile board.

---

## What to Build Next — Top 10, Ranked by Impact

These are listed in priority order for sprints 14–15.

---

**1. Right-side task drawer (never replace the list)**
The highest-impact single change. Click any job row and a panel slides in from the right at ~420px. The grid/board/list stays fully visible on the left. The drawer has: all job fields, stage selector, tech assignment, subtasks, comments, attachments. Close it and you're back exactly where you were. Kill every modal and every separate page navigation for job editing.

**2. One-click stage advancement with color feedback**
Replace any dropdown or form-based stage change with a single status pill per job. Click the pill → a floating list of the job type's stages appears (pre-seeded per type). Select → pill repaints immediately, row highlight updates, event fires. No confirm dialog. This is the Monday.com status column — build it exactly like that.

**3. Blueprint job templates**
Save a complete job configuration (stages, standard task list, dependencies, required custom fields) as a template per job type. "New Install" blueprint spins up all 6 stages with their default subtasks in one click. This is how you onboard a new job in under 30 seconds and ensure no stage is ever missed.

**4. Job-type-specific custom fields**
New Install jobs show: PO Number, Equipment Received (checkbox), Deposit Invoice ID, Estimated Install Date. Service jobs show: SLA Tier, Contract Reference, Last Service Date. Small Install→Service shows a "Convert to Service Contract" button in the drawer. Don't show all fields on all job types — it's noise.

**5. Inline grid editing (click any cell to edit)**
Every field in the Grid view should be click-to-edit in place. No "Edit" button. No modal for changing a due date or tech name. Tab moves to the next editable cell in the row. This is spreadsheet behavior — field ops teams already know it, and they'll use the Grid view more once it works this way.

**6. Bulk action toolbar on multi-select**
Checkbox on every row. Select 3+ jobs → a contextual toolbar appears at the bottom of the screen: Assign Tech, Set Due Date, Move to Stage, Archive. Monday morning dispatch: select all unassigned installs, batch-assign in one action.

**7. Physical drag in Board view**
On card grab: 2–3 degree rotation, slight cursor lag, placeholder ghost in the origin column, destination column highlights on enter. On drop: snap animation. This is table stakes for kanban UX but almost no one implements it correctly — when you do, the board feels real and dispatchers trust the drag.

**8. Overdue and at-risk row highlighting (conditional formatting)**
If a job's due date has passed and status is not Complete: paint the row red automatically. If due date is within 48 hours: amber. If a job has been in the same stage for more than N days (configurable per stage): add a "Stalled" badge. No manual flagging — the system surfaces risk automatically.

**9. Progress ring on the job card in List/Portfolio view**
Each job shows a small completion ring (e.g., 3/7 tasks complete = 43% filled). This is Asana's project card — it answers "how far along is this job?" without opening it. Compute from the job's subtasks or required stage checkpoints.

**10. Tech-facing "My Jobs Today" mobile board (Trello model)**
A stripped Kanban with exactly 3 columns: Today, In Progress, Done. Cards show: property name, job type, address, one action button ("Start Job" / "Complete" / "Flag Issue"). No Gantt, no grid, no custom fields. Accessible at a specific URL with a tech code (already built in the /tech flow). This is the field-facing surface — make it feel like a consumer app, not an admin tool.

---

*Research sources: Monday.com support docs, Asana UX case studies, ClickUp help center, Wrike 2025–2026 reviews, Smartsheet platform docs, field service mobile UX analysis (BigChange, Skedulo, Arrivy — June 2026).*
