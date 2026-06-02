# GateGuard Nexus — Project Management Platform Research & Build Spec

> Produced: June 2, 2026 | Scope: Monday.com + Smartsheet exhaustive feature inventory, comparison matrix, data model, and phased build plan for the GateGuard Nexus tracker / projects module.

---

## Table of Contents

1. [Monday.com — Complete Feature Inventory](#1-mondaycom--complete-feature-inventory)
2. [Smartsheet — Complete Feature Inventory](#2-smartsheet--complete-feature-inventory)
3. [Feature Comparison Matrix](#3-feature-comparison-matrix)
4. [Data Model Recommendations](#4-data-model-recommendations)
5. [View Implementation Specs](#5-view-implementation-specs)
6. [Column Type Specs](#6-column-type-specs)
7. [Automation Engine Spec](#7-automation-engine-spec)
8. [Dashboard Spec](#8-dashboard-spec)
9. [Phased Build Plan](#9-phased-build-plan)
10. [UX Decisions](#10-ux-decisions)

---

## 1. Monday.com — Complete Feature Inventory

### 1.1 Information Architecture

**Workspace** — top-level container. Every account has at least one workspace. Enterprise accounts have multiple. Workspaces are isolated silos: boards in workspace A are invisible to workspace B unless explicitly shared.

**Folder** — optional grouping within a workspace. Folders can be nested one level deep. Purpose: organize boards by team, project, or client without creating a new workspace.

**Board** — the core object. A board is a collection of items organized into groups. Boards are either Main (full features), Private (invisible to non-members), or Shareable (guest-accessible via link).

**Group** — a collapsible section within a board. Every board must have at least one group. Groups are color-coded. Items can be moved between groups by drag-drop or automation. Groups collapse independently.

**Item** — one row of data within a group. Items are the atomic unit of work (task, ticket, job, deal, etc.). Each item has a name (primary column), all configured column values, a conversation thread, file attachments, activity log, and sub-items.

**Sub-item** — a child item linked to a parent item. Sub-items have their own columns (which can differ from the parent board's columns), their own conversations, and their own automations. Sub-items do NOT appear in the board's main view by default; they appear in a collapsed section under the parent item. Limitation: sub-items cannot have sub-items (only one level of nesting). Each item can have up to 1,000 sub-items.

**Column** — a data field on the board. All items share the same column schema within a board. Column order can be rearranged. Columns can be hidden per-view.

---

### 1.2 View Types — Exhaustive

#### Grid View (Table View)
The default view. Spreadsheet-style layout where every item is a row and every column is a visible cell. Key behaviors:
- Inline editing of any cell by clicking
- Multi-row select (shift-click or cmd-click) for bulk status changes, delete, move-to-group
- Column resize by dragging the header border
- Freeze the item name column (always visible on scroll)
- Column sorting (any column type, ascending/descending)
- Filter bar: filter by any column value, by person, by status, etc. Filters stack with AND logic. OR logic requires separate filter groups
- Group by column value: turns any column into the group dimension. E.g., group by Status produces one group per status value
- Summary row at the bottom of each group: sum, average, count, min, max, blank count — available depending on column type
- Color rows based on status column value (the row highlights with the status color)
- Conditional coloring rules: highlight cells or rows based on rules
- Show/hide columns per view (column visibility is view-specific, not board-wide)
- Column order is view-specific
- "Stuck columns" — pin columns to always show on left when scrolling

#### Kanban View
Groups items into swimlane columns based on a Status column (or any single-select column). Key behaviors:
- Each status value = one swimlane column
- Cards show: item name, assignee avatar, due date, any configured "quick info" fields
- Drag cards between columns to change status
- Drag cards within a column to re-order priority
- Column WIP limit: set a maximum card count per column; column header turns red when exceeded
- Card collapse: collapse all cards in a column to just see the count
- Filter, sort, group work the same as Grid view
- Can group cards by a secondary field within a column (e.g., swimlanes within each column by assignee)
- Mirror column: show a field from a connected board on the Kanban card

#### Gantt View
A timeline chart showing items as horizontal bars across calendar time. Key behaviors:
- X-axis: weeks, months, quarters (zoom in/out)
- Each bar spans from a Start Date column to an End Date column (or Timeline column)
- Drag bars to reschedule; drag the right edge to extend duration
- Drag from one bar's end to another bar's start to create a dependency arrow
- Dependency types: Finish-to-Start (most common), Start-to-Start, Finish-to-Finish, Start-to-Finish
- Critical Path: toggle highlights the longest chain of dependencies. Items on the critical path display in red.
- Baseline: take a snapshot of the planned schedule, then compare actual bars to baseline bars (baseline shown as a thin gray bar behind the actual colored bar)
- Milestones: items with a Timeline column where start = end appear as diamonds instead of bars
- Groups appear as collapsible rows. Group summary bars span from first item start to last item end.
- Sub-items appear indented under parent item bars
- Progress percentage shown as a fill on the bar (if a Progress column exists)
- Today line: vertical red dashed line on the chart
- Zoom levels: Day, Week, Month, Quarter, Year
- Print/export to PDF

#### Calendar View
Displays items on a monthly calendar grid based on a Date column (or Timeline column). Key behaviors:
- Month view (default) and week view
- Items appear on the day they start. If a Timeline column is used, the item spans multiple days.
- Click a day to create a new item with that date pre-filled
- Drag items between days to change the date
- Color coding by group or status
- Filter by assignee, status, or any column

#### Chart View
Generates charts from board data. Chart types available:
- Bar chart (vertical or horizontal)
- Line chart
- Pie chart / Donut chart
- Stacked bar chart
- Area chart
- Choose X-axis (any column) and Y-axis (count of items, sum of numbers column, average)
- Group by a second dimension for stacked bars
- Filter before charting
- Multiple Chart widgets on one view are not supported (use Dashboards for multi-chart)

#### Timeline View
Similar to Gantt but without dependency arrows. Designed for roadmap planning rather than detailed project management. Key behaviors:
- Shows items as horizontal bars using a Timeline column
- Group rows by any column
- Switch between team members as rows (workload perspective): each row = one person, showing their assigned items across the timeline
- Item text appears inside the bar
- Collapse groups
- No critical path or baseline features (those are Gantt-only)

#### Workload View
Shows capacity and assignments per team member across time. Key behaviors:
- Each row = one person (from a Person column)
- X-axis = time (week or month view)
- Each cell shows how many items / how many hours the person is assigned during that period
- Set capacity per person per week (e.g., 40 hours). Cells turn red when over capacity.
- Clicking a cell shows the list of items in that time period for that person
- Drag items from one person's row to another to reassign
- Filter by board/group to scope the workload view

#### Map View
Requires a Location or Address column. Displays items as pins on a Mapbox map. Key behaviors:
- Click a pin to see item details
- Color-code pins by status or group
- Filter items to show/hide pins
- Cluster pins when zoomed out
- Available on Monday Work Management and CRM products

#### Form View
Creates a web form that maps to board columns. Form submissions create new items on the board. Key behaviors:
- Toggle which columns appear as form fields
- Set required fields
- Customize question text (independent of column name)
- Conditional logic (Standard plan and above): show/hide form fields based on previous answers
- Form can be embedded on any website via iframe or shared via direct link
- Customizable submit button text and confirmation message
- File upload support in forms
- Forms do NOT require a Monday.com login — anyone with the link can submit
- Branding: add logo, background color, header image (Standard plan+)
- After submission: redirect to URL, show custom thank-you message, or allow submitter to see their submission

#### Workdocs (Doc View)
A rich text document embedded within or linked to a board. Key behaviors:
- Block-based editor: headings (H1–H6), paragraphs, bullet lists, numbered lists, checkboxes, dividers, quotes, callouts, code blocks, tables, images, embeds (YouTube, Loom, Figma, etc.)
- Mention team members with @name — creates an in-doc notification
- Embed a live board or a filtered board view inside the doc
- Embed a dashboard widget inside the doc
- Comments on any block: hover block to see comment icon
- Version history: see who changed what and when
- Real-time collaborative editing (multiple cursors)
- Permission-based: docs inherit workspace sharing settings
- Docs can be standalone (workspace-level) or attached to a specific board

---

### 1.3 Column Types — Exhaustive

#### Status Column
The most important column. Displays colored label chips. Configuration:
- Add up to 40 statuses (each gets a color, 20 preset colors + 6 "dark" colors)
- One status can be designated "Done" — items with Done status trigger automations and affect progress calculations
- Default status on new items (configurable)
- Statuses have a "done percentage" used for battery/progress widgets
- Cannot be a formula output

#### Person Column
Single or multi-select of team members (workspace members only, not guests). Configuration:
- Allow multiple people (up to 20 per item)
- Shows avatar + name
- Used by: automations (assign/notify), Workload view, filter by me

#### Date Column
Stores a single date (and optionally a time). Configuration:
- Show/hide time picker (hour + minute)
- Set format: MM/DD/YYYY, DD/MM/YYYY, etc.
- Deadline notifications: set reminder X days before the date

#### Numbers Column
Stores numeric values. Configuration:
- Unit prefix or suffix (e.g., "$", "hrs", "%")
- Decimal places (0–10)
- Thousands separator
- Direction: higher = better or lower = better (used in Chart view color coding)
- Aggregate functions in the group summary row: sum, average, count, min, max

#### Text Column
Free-form single-line text string. Configuration: none beyond column name.

#### Long Text Column
Multi-line text with rich text formatting (bold, italic, links, code). Renders as a truncated cell; expand on click. Used for notes, descriptions, instructions.

#### Dropdown Column
Single or multi-select from a predefined list. Configuration:
- Define options (up to 999 options)
- Enable multi-select toggle
- Color-coding per option (optional)
- When multi-select: values stored as comma-separated, displayed as tag chips

#### Checkbox Column
Boolean true/false. Renders as a checkbox. When checked triggers automations.

#### Rating Column
1–5 star rating. Renders as star icons. Aggregate: average rating in summary row.

#### Country Column
Dropdown populated with ISO 3166-1 country list. Displays flag icon + country name.

#### Email Column
Stores an email address. Clicking opens default email client with mailto link.

#### Phone Column
Stores a phone number. Clicking opens click-to-call dialog. Country code prefix optional.

#### Timeline Column
Stores a date range (start date + end date). Displays as a mini-bar in Grid view. Used by Gantt and Timeline views. Configuration: exclude weekends from duration calculations.

#### Tags Column
Multi-label taxonomy across boards. Tags are shared across the entire account (not per-board). Used for cross-board filtering in dashboards.

#### Link Column
Stores a URL + display text. Clicking opens in new tab.

#### File Column
Attach files, images, videos, or links (Dropbox, Google Drive, Box, OneDrive). Can attach multiple files per item. Files are stored in Monday.com's storage (10MB per file limit on Standard plan; up to 1GB on Enterprise).

#### Formula Column
Compute values from other columns using Excel-like syntax. Supported operations:
- Arithmetic: +, -, *, /, MOD, ROUND, SQRT, POWER, ABS
- Text: CONCATENATE, LEFT, RIGHT, MID, LEN, UPPER, LOWER, TRIM, FIND, REPLACE, SUBSTITUTE
- Date: DATEDIF, TODAY, NOW, DAYS, EDATE, YEAR, MONTH, DAY
- Logical: IF, AND, OR, NOT, IFS, SWITCH
- Lookup-style: can reference other columns on the same item
- Cannot reference other items' values (no cross-item formulas — use Mirror/Rollup for that)

#### Time Tracking Column
Built-in timer. Team members click play/pause to track time spent on an item. Multiple sessions accumulate. Configuration:
- Summary row: total hours tracked
- View individual sessions with timestamps
- Manual time entry (add past sessions)

#### Vote Column
Team members click to vote on an item (emoji thumbs up). Shows count of votes. Used for prioritization.

#### World Clock Column
Displays current time in a selected timezone. Used for distributed team awareness.

#### Color Picker Column
Stores a hex color value. Useful for design projects, branding work.

#### Connect Boards Column (Link to Board)
Creates a relationship between items on different boards. Configuration:
- Select which board to link to
- Choose display field from the linked board
- One-to-many relationship: one item can link to many items on another board
- Triggers bidirectional display (the linked board shows a reciprocal "connected" item)

#### Mirror Column
Reads a value from a connected board's column and displays it read-only on the current board. Requires a Connect Boards column to be set up first. Useful for showing a linked item's status, due date, or assignee without switching boards.

#### Rollup Column
Aggregates values from sub-items or from a connected board using Mirror. Functions: sum, average, count, min, max, combined text.

---

### 1.4 Automation Builder — Exhaustive

Monday.com automations follow a **Trigger → (optional Filter) → Action** model. The builder is a no-code UI where you select trigger, conditions, and actions from dropdowns.

#### Trigger Types

**When status changes** — fires when any Status column (you specify which column) changes to a specific value or any value.

**When date arrives** — fires on a specific date stored in a Date column, or X days/weeks before/after that date. Optional: repeat daily/weekly/monthly.

**When item is created** — fires immediately when any new item is added to the board (or a specific group).

**When column value changes** — fires when any specified column changes (not limited to Status; works on Numbers, Text, Dropdown, Checkbox, etc.).

**When sub-item is created** — fires when a sub-item is added under any item.

**When sub-item status changes** — same as item status trigger but scoped to sub-items.

**When a specific column changes** — granular version: fires only when the value changes from X to Y.

**Periodically (time-based)** — fires every day, week, month at a specified time. Not tied to item data.

**When item is moved to group** — fires when an item is dragged or moved to a specific group.

**When button is clicked** — items can have a Button column. Clicking the button fires the automation.

**When a form is submitted** — fires when a new submission comes in from the Form view.

#### Filter Conditions (optional, stacked with AND)
- Column value equals / does not equal
- Column value is empty / is not empty
- Column value contains text
- Date column is before / after / within X days

#### Action Types

**Notify someone** — send an in-app notification and email to a specified person or persons (can be the person in a Person column, a specific user, or the item creator). Customize message with column value placeholders.

**Send an email** — send a formatted email to an email address (from an Email column or a hardcoded address). Body supports column value placeholders and rich text.

**Create an item** — create a new item on the same board (or a different board), in a specified group, with pre-filled column values (can map current item's column values).

**Create a sub-item** — create a new sub-item under the current item with pre-filled values.

**Move item to group** — move the item to a specified group on the same board.

**Move item to board** — move the item (with all its data) to a different board's group.

**Duplicate item** — create a copy of the item in the same or different group.

**Archive item** — move the item to the board's archive.

**Change column value** — set any column to a specified value.

**Assign person** — set the Person column to a specific user, or to the person who last changed a column, or to the item creator.

**Set date** — set a Date column to today, a relative date, or a specific date.

**Clear column** — remove the value from any column.

**Connect to board** — link the item to a specific item on another board (auto-populate a Connect Boards column).

**Push date** — move a date column forward or backward by X days.

**Create a doc** — create a Monday Workdoc attached to the item.

**Integration action** — trigger an action in an integrated tool (Slack message, Jira ticket, GitHub issue, etc.). These are the native integrations exposed through the automation builder.

**AI action** — summarize item updates using AI, categorize items, extract data from text columns.

#### Automation Limits
- Basic plan: 250 automation runs/month per account
- Standard: 25,000 runs/month
- Pro: 250,000 runs/month
- Enterprise: unlimited
- Custom automations require Standard plan or above

---

### 1.5 Dashboard Widgets — Exhaustive

Dashboards aggregate data from multiple boards. Each dashboard can pull from up to 50 boards. Widgets are drag-resize tiles on a free-form canvas.

**Chart Widget** — bar (vertical/horizontal), line, area, stacked bar, pie, donut. X-axis = any column, Y-axis = count, sum, or average of a Numbers column.

**Battery Widget** — percentage of items in "done" status vs. total. Shows as a colored progress bar (green when high %, red when low).

**Numbers Widget** — displays a single aggregated number: sum, average, count, min, max of a Numbers column across selected boards.

**Gantt Widget** — renders a Gantt chart pulling timeline/date columns from selected boards. Supports grouping.

**Timeline Widget** — same as the board Timeline view but as a dashboard widget spanning multiple boards.

**Calendar Widget** — calendar view pulling date columns from multiple boards.

**Countdown Widget** — shows days remaining until a specific date column value.

**Text Widget** — static text block for labels, instructions, or explanatory copy on the dashboard.

**Image Widget** — embed a static image (logo, org chart, etc.).

**Video Widget** — embed a YouTube or Vimeo video.

**Iframe/Embed Widget** — embed any URL in a frame (Tableau, PowerBI, Loom, Google Maps, etc.).

**Workload Widget** — shows team capacity across boards in a dashboard context.

**Activity Log Widget** — shows a live feed of recent changes across selected boards.

**My Work Widget** — shows items assigned to the viewing user across all boards.

**World Clock Widget** — display multiple timezones simultaneously.

**Custom Widget (via Apps Framework)** — developers can build custom widgets using the monday.com Apps Framework. Published to the Apps Marketplace.

---

### 1.6 Permissions Model

**Board-level permissions:**
- Owner: full control including deletion
- Member: can edit all items and columns
- Editor: can edit items but not board structure (no adding/editing columns)
- View-only: read-only access
- Guests: external users with limited board access (cannot see other boards in the workspace)

**Item-level permissions** (Enterprise only):
- Restrict editing to the item's assignee only
- Restrict editing to item creator only
- Lock specific columns across the board

**Workspace-level permissions:**
- Workspace owner vs. workspace member
- Anyone with workspace access can see all non-private boards

**Private boards:** Only added members can see the board. Not visible in workspace listing.

**Shareable boards:** External guests (outside the account) can be invited to view/edit one specific board. Guests do not count as full seats.

---

### 1.7 Integrations (Key)

Native integrations (no Zapier needed):
- **Slack** — post to channel when status changes; create items from Slack messages
- **GitHub** — link GitHub commits/PRs to board items; auto-move items when PR is merged
- **Jira** — two-way sync: items mirror Jira issues; status changes propagate both directions
- **Salesforce** — sync CRM records to Monday boards
- **HubSpot** — sync contacts and deals
- **Google Calendar / Outlook** — sync date columns to calendar events
- **Zoom** — create Zoom meetings from items
- **PagerDuty** — trigger incidents from item status changes
- **Twilio** — send SMS from automations
- **DocuSign** — send for signature from items
- **Gmail / Outlook** — create items from emails; send emails from automations
- **Zapier / Make** — 3,000+ additional apps

---

### 1.8 Forms (WorkForms)

Monday WorkForms is a separate product within the Monday ecosystem. Key features beyond the basic Form view:
- Fully standalone form builder (not embedded in a board)
- Multiple question types: short text, long text, number, dropdown, checkboxes, multiple choice, rating, date, file upload, signature, matrix, slider
- Conditional logic on every question
- Logic jumps (skip pages/questions)
- Multi-page forms
- Form scoring (quiz mode)
- Custom branding with full CSS control (Business plan+)
- Email notifications to form owner
- Partial response saving (respondents can save and continue later)
- Auto-populated hidden fields via URL parameters (for pre-filling known data)
- Results can go to a Monday board OR export to CSV

---

### 1.9 Sub-Items — Specific Behaviors

- A sub-item is its own item object with a parent_item_id foreign key
- Sub-items have their own distinct column schema (different columns from parent board)
- Sub-items can be assigned their own statuses, dates, and people
- Sub-items appear in a collapsible section at the bottom of the parent item when expanded inline in Grid view
- Automations can target sub-items specifically ("When sub-item status changes to Done...")
- Dashboard widgets can include sub-items in their data aggregation (toggle per widget)
- Sub-items can be viewed as a flat list on a separate "Sub-items board" view
- Rollup column on parent aggregates sub-item values (sum, avg, count)
- Limitation: one level only. Sub-items cannot have their own sub-items.
- Limitation: sub-items are not available in all views (Gantt supports them; Timeline partially; some Dashboard widgets ignore them)

---

### 1.10 Activity Log & Notifications

**Activity Log (per item):** Every change to an item is recorded — who changed what column from what value to what value, with timestamp. Not editable. Accessible in the item detail panel.

**Board Activity Log:** All item changes on a board in reverse-chronological order. Filterable by user or date range.

**Inbox/Notifications:** In-app notification center. Receive notifications when:
- Someone @mentions you
- An automation fires and targets you
- An item assigned to you changes
- A conversation you're part of gets a reply
- Someone creates a new item in a group you follow
- You choose to "watch" an item

**Notification settings:** per-board control of which events generate notifications. Global override in account settings.

---

### 1.11 Time Tracking (Detailed)

The Time Tracking column records active sessions. Behaviors:
- Any board member can start/stop their own timer on any item
- Multiple people can have timers running on the same item simultaneously
- Each session records: user, start timestamp, end timestamp, duration
- Manual sessions: add a past session with a custom start/end time
- View all sessions in item detail panel (breakdown by user)
- Summary row in Grid shows total time tracked across all users for items in the group
- Export time tracking data via API
- Third-party time tracking integrations: Harvest, Toggl, Clockify (through Zapier or marketplace apps)

---

### 1.12 Resource Workload View (Detailed)

- Access: must have a Person column + either a Numbers column (for hours) or Timeline/Date columns (for date-based capacity)
- Capacity mode: set total hours per person per week. If no Numbers column exists, each item counts as 1 unit.
- Allocation mode: if a Numbers column is designated as "effort hours," sum that column per person per week
- Color system: under capacity = green; at capacity = yellow; over capacity = red
- Clicking a cell drills into a list of the specific items contributing to that load
- Compare across boards: workload widget in dashboard aggregates workload from multiple boards
- No auto-rebalancing or assignment suggestions (manual on Monday.com; no AI scheduling as of 2026)

---

## 2. Smartsheet — Complete Feature Inventory

### 2.1 Information Architecture

**Sheet** — the core object. A spreadsheet-like grid where every row is an item and every column is a field. A sheet can have up to 500 columns and 5 million rows (with data storage limits). Sheets are the primary way to organize work.

**Report** — a filtered, multi-sheet rollup. A report reads from one or more sheets and presents a filtered subset of rows. Reports are read-only by default (update report rows = updates source sheet). Reports do not duplicate data — they reference it.

**Dashboard** — a collection of widgets reading from sheets and reports. Fully read-only for visitors; owners configure it.

**Workspace** — a folder-like container. Workspaces are shared with collaborators at the workspace level. Items in a workspace: sheets, reports, dashboards, forms, templates.

**Folder** — grouping within a workspace or personal My Smartsheet area.

**Row** — the atomic item of work. A row can be a parent (with child rows indented under it) or a child row.

**Row Hierarchy / Indent** — Smartsheet's key differentiator from Monday.com. Rows can be indented 1–8 levels deep. Parent rows aggregate child rows' values (sum/average depending on column type). This creates true WBS (Work Breakdown Structure) nesting. Keyboard shortcut: Tab to indent, Shift+Tab to outdent. This hierarchy is visible in Gantt view as the project outline.

---

### 2.2 Views

#### Grid View (Sheet View)
The default spreadsheet interface. Key behaviors:
- Every row is an item; every column is typed
- Inline cell editing: click or double-click to edit
- Row hierarchy: indent rows to create parent-child nesting. Parent rows auto-aggregate children (sum for numbers, roll-up status, etc.)
- Conditional formatting: highlight entire rows or individual cells based on rules. Up to 50 conditional formatting rules per sheet. Highlight colors include background + text color + bold/italic.
- Row locking: lock a specific row so only Admins can edit it
- Cell linking: create a live reference from one cell to a cell on another sheet ("inbound link" = this cell receives; "outbound link" = this cell sources). Cross-sheet cell linking is bidirectional and live-updating.
- Column formulas: apply one formula to all rows in a column (instead of per-cell formulas). Column formulas lock individual cells from override.
- Freeze rows/columns: freeze the primary column or top N rows from scrolling
- Row grouping: not available (rows are organized by indent only, not by drag-group like Monday)
- Sort rows: by any column, multiple sort keys, ascending/descending
- Filter rows: hide rows that don't match criteria. Filters are per-user (not shared) by default, or can be saved as a "shared view"

#### Gantt Chart View
Smartsheet's Gantt is more powerful than Monday.com's. Key behaviors:
- Requires a Start Date column, an End Date (or Duration) column, and optionally a % Complete column, Predecessors column, and Assigned To (Contact) column
- Duration: can be entered in days, hours, weeks. Auto-calculated from start/end. Business days mode (skip weekends/holidays).
- Predecessors column: enter row numbers to define dependency. Dependency types: FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish). Lag and lead time: append "+3d" or "-2d" to the predecessor to add lag/lead.
- Critical Path: toggle highlights tasks on the longest path to project completion in red. Smartsheet's critical path is based on the dependency network, not just the longest date range.
- Baseline: save the current plan as a baseline (snapshot). The Gantt then shows original bars (baseline) in gray behind the current bars. Multiple baselines not supported (only one baseline per sheet).
- Milestone rows: rows with 0 duration display as a diamond
- Row hierarchy in Gantt: summary bars (parent rows) span from earliest child start to latest child end. Collapsing a parent hides all children.
- Column "% Complete": enter 0–100 to show a progress fill on the Gantt bar. Alternatively, a formula can calculate % complete from child rows.
- Print mode: export Gantt to PDF, adjustable to letter/legal/A4. Header/footer customization.
- Roll-up: parent row duration shows automatic summary bar (not user-configurable)

#### Card View (Kanban Equivalent)
- Cards organized by swimlane columns based on any single-select or contact column
- Cards show: primary column (title) + up to 5 additional fields configured by the user
- Drag cards between columns to update the column value
- Drag cards within a column to set row order
- Collapse columns
- No WIP limit feature (unlike Monday.com)
- No conditional column coloring on cards

#### Calendar View
- Rows appear as events on a calendar grid
- Requires at least one Date column. Can use Start Date + End Date for multi-day events.
- Month, week, day views
- Click on a day to add a new row with that date
- All-day event: displayed as a banner across the day cell
- Color coding: by value in a specific column
- Drag events to reschedule (updates the date column in the sheet)

---

### 2.3 Column Types — Exhaustive

#### Primary Column
Every sheet has exactly one primary column. It is always the leftmost data column (the row name). Type: Text/Number (cannot be changed). Cannot be deleted. This is the item's display name.

#### Text/Number
The most versatile column. Accepts any text, any number, or both in the same column. Smartsheet does not force you to choose text OR number at the column level (unlike a SQL table). Formatting:
- Number formatting: currency (select currency symbol), percentage, thousands separator, decimal places
- Text formatting: bold, italic, strikethrough, underline, font color, background color per-cell
- Leading zeros preserved by prepending an apostrophe automatically (stored as text)

#### Contact List
Stores email addresses of Smartsheet users or external contacts. Behaviors:
- Auto-suggest from: sheet collaborators, account user directory, personal contact list
- Allow multiple contacts per cell (up to 20)
- Preferred contacts: admin restricts column to a predefined list
- Used by: automation (notify assignee), resource management, report filtering ("assigned to me")
- Non-email values (names without @) are stored as free text and lose automation functionality

#### Date
Stores a single calendar date. Configuration:
- Date format based on account locale
- Used by: calendar view, Gantt (start/end dates), automation triggers (date-based workflows)
- Keyboard shortcuts: T for today, + and - to increment/decrement by one day

#### Dropdown List
Predefined set of options. Configuration:
- Single-select or multi-select per cell (toggle)
- No hard limit on number of options (practically thousands)
- Options can be typed inline or imported
- No color-coding per option (unlike Monday.com Status column)

#### Checkbox
Boolean. Displays as a checkbox. Three visual styles available: Box, Flag, Star (single star).

#### Symbols
Visual symbol from predefined symbol sets. Available symbol sets:
- Harvey Balls (0/25/50/75/100%)
- Priority (Critical, High, Medium, Low, None)
- RYG (Red, Yellow, Green circles)
- Progress (filled circles)
- Direction (Up, Down arrows)
- Weather (Sun, Cloud, Rain, Storm)
- Arrows (up/right/down/left)
- Flags (various colors)
- Stoplight
- Stars (1–5 fill)
- Status (rows of shapes)
Custom symbol sets cannot be created.

#### Auto-Number
Automatically assigns a sequential number to every row that has data. Format configurable: prefix, suffix, zero-padding (e.g., "REQ-{000001}"). Numbers are assigned on row creation and never change (even if rows are reordered or deleted). Not editable.

#### System Columns
Four types:
- **Created By** — displays the Smartsheet username who created the row. Read-only.
- **Created Date** — timestamp of row creation. Read-only.
- **Modified By** — last user to modify any cell in the row. Read-only, updates on every save.
- **Modified Date** — timestamp of last modification. Read-only.

#### Duration
Available only in sheets with Project Settings enabled. Stores task duration (number of days). Accepts: integer days, or hours format (e.g., "8h"). When Project Settings include "work days per week," duration calculations skip non-work days.

#### Latest Comment Column
Shows the text of the most recent conversation comment on the row. Read-only. Updates live when new comments are added.

#### Predecessor Column
Available only in Project Settings mode. Stores dependency references as row numbers + type codes (FS, SS, FF, SF). Example value: "4FS, 6SS+2d". Used by Gantt view to draw dependency arrows and calculate critical path.

#### % Complete Column
Available in Project Settings mode. Accepts 0–100. Displays as a fill indicator. Parent rows auto-calculate weighted average of children.

---

### 2.4 Formulas — Detailed

Smartsheet formulas use Excel-like syntax. They live in individual cells (or as column formulas that apply to all rows).

**Cell reference syntax:**
- `[Column Name]@row` — reference the same row, different column
- `[Column Name]5` — reference row 5
- `[Column Name]:[Column Name]` — reference entire column
- `{Sheet Name Range Name}` — cross-sheet reference (via named ranges)

**Key functions available:**
- `SUMIF`, `COUNTIF`, `AVERAGEIF`, `SUMIFS`, `COUNTIFS`
- `VLOOKUP(value, range, col_index, [match_type])`
- `MATCH`, `INDEX`
- `IF`, `IFS`, `AND`, `OR`, `NOT`
- `IFERROR`, `ISBLANK`, `ISDATE`, `ISNUMBER`, `ISTEXT`
- `TODAY()`, `NOW()`, `NETWORKDAYS(start, end, [holidays])`
- `DATEONLY()`, `TIMEONLY()`, `YEAR()`, `MONTH()`, `DAY()`, `WEEKDAY()`
- `WORKDAY(date, num_days)` — add business days
- `DESCENDANTS()` — reference all child rows of a parent (used with SUM, COUNT, etc.)
- `ANCESTORS()` — reference all parent rows of a row
- `CHILDREN()` — reference direct children of a row (not grandchildren)
- `PARENT()` — reference the direct parent row
- `TRIM()`, `LEN()`, `FIND()`, `MID()`, `LEFT()`, `RIGHT()`, `SUBSTITUTE()`
- `CONTAINS()`, `HAS()` (for multi-value columns)
- `JOIN()` — concatenate with delimiter
- `COLLECT()` — gather values meeting criteria (used with SUM, COUNT)
- `LARGE()`, `SMALL()` — nth largest/smallest
- `RANK()`, `PERCENTILE()`

**Cross-sheet references (two mechanisms):**
1. **Cell Links (inbound/outbound)** — a direct 1:1 link between two specific cells. If the source changes, the destination updates. Visual indicator on linked cells.
2. **Sheet References** — create a named reference to a range on another sheet. Used in formulas like `=SUMIF({OtherSheetRange}, "criteria", {OtherSheetSumRange})`. References update whenever either sheet is saved.

**Column Formulas:**
Apply one formula to ALL rows in a column. Benefits: new rows automatically get the formula; no per-row editing needed. Limitation: individual cells in a column formula column cannot be overridden with different values.

---

### 2.5 Automated Workflows — Detailed

Smartsheet's automation builder uses a visual flowchart (trigger → condition blocks → action blocks).

**Trigger Types:**
- **When rows are added** — any new row
- **When rows are changed** — any row modification (column value change)
- **When a specific column changes** — only fires when the specified column is modified
- **Based on a date** — fires on a date column value, or X days before/after
- **Time-based (scheduled)** — fires at a specific time each day, week, or month regardless of row data
- **Manually run** — no trigger; user manually runs the workflow on demand

**Condition Blocks (filters applied after trigger):**
- Column value equals / does not equal / contains / does not contain
- Column is blank / not blank
- Date is before / after / is today / is within X days
- Multiple conditions stacked with AND logic
- Condition paths: branch the workflow into different paths based on different conditions (if-else branching)

**Action Types:**
- **Notify** — send email notification to contacts in a Contact column, specific users, or specific email addresses. Custom message with {{column placeholder}} substitution.
- **Request an update** — send an email asking the recipient to fill in specified cells in a form-like email interface. Recipient can edit the row cells without logging into Smartsheet.
- **Request an approval** — send an approval request email. Recipient clicks Approve or Decline. Workflow can branch based on the approval decision.
- **Move row** — move the row to a specified sheet (or archive)
- **Copy row** — duplicate the row to a specified sheet
- **Lock row** — prevent further edits to a row
- **Unlock row** — re-enable edits
- **Change cell value** — set a specified column to a specified value. Supported column types: Text/Number, single-select dropdown, multi-select dropdown, Checkbox.
- **Record a date** — insert the current date into a Date column
- **Clear cell** — empty a specified column value
- **Assign people** — set a Contact column to specified users
- **Generate a document** — fill a Word or PDF template with row data and attach it to the row or send it as an email attachment (DocGen feature, Enterprise plan)
- **Send a Slack message** — via Slack integration
- **Create a Jira issue** — via Jira connector
- **Trigger Bridge** — call a Smartsheet Bridge workflow (advanced automation with more complex logic)

**Workflow limits:**
- Up to 150 workflows per sheet
- Up to 100 blocks per workflow (trigger + condition + action blocks combined)
- Up to 30 action blocks per workflow
- Condition blocks: up to 20 condition statements per block

**Bridge (premium add-on):**
More complex automation using a visual logic builder with looping, branching, cross-sheet operations, and API calls. Replaces Zapier-style connections for Smartsheet-to-Smartsheet and Smartsheet-to-external-service workflows.

---

### 2.6 Reports

Reports are multi-sheet rollups. Key behaviors:
- One report can pull from up to 30,000 rows across multiple sheets
- Filter criteria set at report creation: only rows meeting conditions appear
- Sorting: up to 3 sort keys
- Group by column: collapse rows by a common column value (e.g., group by Assigned To)
- Summary row: count, sum, average per group
- Reports are live-reading: changes in source sheets appear immediately in the report
- Reports can be shared independently of the source sheets
- Publishing reports: create a read-only public URL for external stakeholders
- Update from report: users with Editor access on the source sheet can edit row values from within the report. Changes write back to the source sheet.
- Report columns: choose which columns from source sheets to display. If multiple sheets have different column names, you can map them.

---

### 2.7 Dashboards (Smartsheet)

Smartsheet dashboards contain widgets that pull from sheets/reports. Unlike Monday.com, Smartsheet dashboards are more static (no free canvas drag-resize to pixel precision — widgets are in a column grid).

**Widget Types:**

**Metric Widget** — shows a single numeric value. Source: a specific cell from a sheet (can be a formula). Can show trend arrow, comparison value, goal line. Commonly used for KPIs.

**Chart Widget** — bar, line, pie, column charts from a sheet's column data. Up to 100 rows of data. Data range is a cell range on a sheet. To chart dynamic filtered data, source from a Report.

**Shortcut Widget** — a clickable tile linking to a sheet, report, dashboard, external URL, or file attachment. Used for navigation within a Smartsheet workspace.

**Image Widget** — display a static image (upload or external URL). Used for logos, diagrams.

**Web Content Widget** — embed any URL via iframe. Used for Tableau, PowerBI, Google Maps, YouTube, etc.

**Report Widget** — embed a live report view inside the dashboard. Shows the filtered report rows as a table. Viewers can see live data but cannot edit from this widget.

**Title Widget** — text block for headings, labels, or explanatory copy. Supports basic rich text.

**Richtext Widget** — larger text block with heading levels, bold/italic, links.

---

### 2.8 Forms (Smartsheet)

Smartsheet forms are tied to a specific sheet. Submissions create new rows. Key behaviors:
- Configure which columns appear as form fields
- Mark fields as required
- Field types match column types (dropdown, date, checkbox, contact, text)
- Conditional logic: show/hide form fields based on previous answers
- Field validation: restrict Text/Number fields to numbers only, or min/max values
- Custom logo and header image
- Custom thank-you page message (or redirect URL)
- Share form URL publicly (no login required)
- Form submissions append as new rows at the bottom of the sheet
- Forms do NOT support file uploads in the standard plan (file upload requires Enterprise DocGen/Forms+ feature)
- Forms can be embedded via iframe

**Update Requests (email-based forms):**
A unique Smartsheet feature. Instead of a web form, the owner sends an email to a specific person asking them to fill in specific cells for a specific row. The email contains an inline form. The recipient edits the values and clicks Submit. No Smartsheet login required. Used for:
- Collecting status updates from external contractors
- Collecting approval decisions
- Collecting progress updates without granting sheet access

---

### 2.9 Conditional Formatting

Up to 50 rules per sheet. Configuration per rule:
- Condition: any column, any operator (equals, contains, is blank, date comparisons, etc.)
- When condition is met: apply background color, text color, bold, italic, strikethrough to the row or just the triggering cell
- Rules evaluated top-to-bottom; first matching rule wins (unless "apply all matching rules" is enabled)
- Conditional formatting is displayed in all views (Grid, Gantt, Card, Calendar)
- Not available in reports or dashboard Report widgets

---

### 2.10 Dynamic View (premium add-on)

Dynamic View allows creating a filtered, permission-controlled window into a sheet for external users. Key behaviors:
- Create a view based on filter criteria (e.g., show only rows where Contact column = viewer's email)
- Each recipient sees only their own rows
- Configure which columns are visible and which are editable
- No full Smartsheet access required — recipient accesses via a URL
- Used for: client status portals, contractor update portals, vendor-facing views
- The underlying sheet data is never exposed beyond the configured columns

---

### 2.11 Resource Management (premium add-on)

A separate tool for capacity planning. Key features:
- People: each person has defined capacity (hours/week), roles, skills, and project allocations
- Project portfolio: view all projects, their timelines, and team allocations on a master timeline
- Allocation: assign a person to a project at X hours/week for a date range
- Utilization reports: see who is over/under-utilized across the portfolio
- Time tracking: team members submit hours via the RM interface; approvers confirm
- Integrates bidirectionally with Smartsheet sheets (allocations can pull from Gantt rows)

---

### 2.12 Control Center (premium add-on)

Template-based project portfolio provisioning. Key features:
- Define a "blueprint" (a workspace of templates: sheets, reports, dashboards, automations)
- When a new project starts, Control Center provisions a complete copy of the blueprint with one click
- Global Reports / Global Updates: make a change to a template blueprint and propagate it to all live projects at once
- Portfolio rollup: a single master report or dashboard that aggregates data from all project instances
- Used by PMOs for standardized project delivery at scale

---

### 2.13 Cell Linking (Cross-Sheet)

Two types:
1. **Direct Cell Links** — link a specific cell on one sheet to a specific cell on another. The destination cell shows the source value live. Visual indicator (chain icon) on linked cells. Update propagates on next sheet load or immediate (configurable).
2. **Cross-Sheet Formulas / Sheet References** — define a named reference to a range on another sheet. Use in formulas: `=SUMIF({ProjectStatusRange}, "Green", {ProjectBudgetRange})`. References update when source is saved.

Limitation: cross-sheet formulas are read-only in the destination (cannot write back via formula). Bridge workflows are required for cross-sheet writes.

---

### 2.14 Proofing

Enterprise feature for reviewing media files (images, PDFs, video). Key behaviors:
- Attach a proof (image, PDF) to a row
- Reviewers can annotate directly on the proof (draw boxes, add text comments, pin comments to specific locations)
- Version history: upload a revised proof and compare versions
- Approval status: mark proof as Approved/Requested Changes
- Feeds back into row status via automation

---

### 2.15 Permissions Model

**Sheet-level sharing:**
- Owner: full control, can delete sheet
- Admin: can share with others, edit structure, create automations
- Editor (can share): can edit rows and columns, can share with others
- Editor (cannot share): can edit rows and columns only
- Commenter: can view and comment, cannot edit cells
- Viewer: read-only

**Row-level permissions:** Not natively available. Dynamic View (premium) provides row-level filtering per user.

**Workspace-level sharing:** Share the entire workspace (all sheets, reports, dashboards within it) with a user at a specified permission level.

**Admin Center:** Account-level management of users, groups, domains, SSO, SCIM provisioning (Enterprise).

---

## 3. Feature Comparison Matrix

| Feature | Monday.com | Smartsheet | GateGuard Tracker (Current) | Build Priority |
|---------|-----------|-----------|----------------------------|---------------|
| **VIEWS** | | | | |
| Grid / Table view | Yes — primary view | Yes — spreadsheet feel | Partial (tracker table) | P0 |
| Kanban / Card view | Yes — full drag-drop | Yes (Card view) | Partial (board toggle) | P0 |
| Gantt chart | Yes — full (deps, critical path, baseline) | Yes — most powerful feature | No | P1 |
| Calendar view | Yes | Yes | Partial (separate calendar page) | P1 |
| Timeline view (roadmap) | Yes | Part of Gantt | No | P2 |
| Workload / Resource view | Yes — dedicated view | Yes (RM add-on) | No | P2 |
| Chart view (per-board) | Yes | No (dashboards only) | No | P2 |
| Map view | Yes (Location column) | No | No (separate portal feature) | P3 |
| Form view | Yes — full conditional logic | Yes — tied to sheet | No (surveys are separate) | P1 |
| **ROW / ITEM HIERARCHY** | | | | |
| Groups (sections) | Yes — color-coded collapsible | No (indent-based only) | Yes (tracker has groups) | P0 |
| Sub-items (1 level nesting) | Yes — separate column schema | Indented rows (8 levels, same schema) | Partial (parent_item_id exists) | P1 |
| Indent / WBS hierarchy | No (only 1 sub-level) | Yes — up to 8 levels, true WBS | No | P1 |
| **COLUMN TYPES** | | | | |
| Status (labeled colors) | Yes — 40 custom statuses | Symbols column (predefined sets only) | Yes (status field) | P0 |
| Person / Assignee | Yes | Yes (Contact List) | Partial (owner_name text field) | P0 |
| Date | Yes | Yes | Partial (due_date exists) | P0 |
| Numbers | Yes | Yes (Text/Number with formatting) | No | P1 |
| Text (single line) | Yes | Yes | Yes (description) | P0 |
| Long Text / Rich Text | Yes | Yes (Text/Number + formatting) | No | P1 |
| Dropdown (single-select) | Yes | Yes | No | P1 |
| Dropdown (multi-select) | Yes | Yes | No | P2 |
| Checkbox | Yes | Yes | No | P1 |
| Rating (stars) | Yes | Yes (Symbol: Stars) | No | P2 |
| Tags (cross-board) | Yes | No | No | P2 |
| Link (URL) | Yes | Yes (hyperlink in text cell) | No | P2 |
| File attachment | Yes | Yes (per-row attachments) | No | P2 |
| Formula | Yes (within-row only) | Yes (cross-row, cross-sheet, complex) | No | P2 |
| Timeline / Date range | Yes | Yes (Start + End Date columns) | No | P1 |
| Connect Boards / Cell Link | Yes | Yes (Cell Linking, cross-sheet ref) | No | P3 |
| Mirror / Rollup | Yes | Yes (via formulas + cell links) | No | P3 |
| Auto-Number | No dedicated column (formula workaround) | Yes | No | P2 |
| System columns (Created/Modified) | Yes (activity log only) | Yes (4 System column types) | Partial (created_at in DB) | P1 |
| Time Tracking | Yes — built-in timer | No native | No | P2 |
| Progress % | Yes (via Formula + Status) | Yes (% Complete column) | No | P2 |
| Predecessor / Dependencies | Yes (in Gantt view) | Yes (Predecessor column) | No | P1 |
| **AUTOMATION** | | | | |
| Status-change trigger | Yes | Yes | No | P1 |
| Date-based trigger | Yes | Yes | No | P1 |
| Row created trigger | Yes | Yes | No | P1 |
| Column change trigger | Yes | Yes | No | P1 |
| Time-based (scheduled) trigger | Yes | Yes | No | P1 |
| Manual trigger | Yes (Button column) | Yes | No | P2 |
| Notify action | Yes (in-app + email) | Yes (email only) | No | P1 |
| Send email action | Yes (custom email) | Yes | Partial (Resend routes exist) | P1 |
| Change column value action | Yes | Yes | No | P1 |
| Move item action | Yes | Yes | No | P2 |
| Create item action | Yes | Yes (copy/move row) | No | P2 |
| Assign person action | Yes | Yes | No | P2 |
| Request approval action | No native | Yes — unique Smartsheet feature | No | P2 |
| Request update (email form) | No | Yes — unique Smartsheet feature | No | P2 |
| AI-based actions | Yes (Sidekick integration) | No | No | P3 |
| **DASHBOARDS** | | | | |
| Multi-board / multi-sheet data | Yes (up to 50 boards) | Yes (unlimited via reports) | No | P1 |
| Chart widget | Yes | Yes | Partial (KPI charts on /page.tsx) | P1 |
| Numbers / KPI widget | Yes | Yes (Metric widget) | Yes (KPI cards) | P0 |
| Battery / Progress widget | Yes | No (use Chart) | No | P2 |
| Gantt widget | Yes | No (reports only) | No | P2 |
| Calendar widget | Yes | No | No | P2 |
| Countdown widget | Yes | No | No | P3 |
| Embed / iFrame widget | Yes | Yes | No | P2 |
| Text/Label widget | Yes | Yes (Richtext, Title) | No | P2 |
| Workload widget | Yes | No (separate RM tool) | No | P2 |
| Activity feed widget | Yes | No | No | P2 |
| **COLLABORATION** | | | | |
| @mentions in items | Yes | Yes (in comments) | No | P1 |
| Item-level conversation thread | Yes | Yes (row comments pane) | Partial (TrackerBoard has comments) | P1 |
| Activity log per item | Yes | Yes | Partial | P1 |
| Board-level activity log | Yes | Yes (sheet activity log) | No | P2 |
| File attachments on items | Yes | Yes | No | P2 |
| Update requests (email-based) | No | Yes | No | P3 |
| Proof/markup on files | No native | Yes (Enterprise) | No | P3 |
| **PERMISSIONS** | | | | |
| Board/Sheet-level roles | Yes (5 roles) | Yes (6 roles) | Partial (Clerk roles) | P1 |
| Row-level permissions | Yes (Enterprise) | Yes (Dynamic View, premium) | No | P3 |
| Private boards | Yes | Yes (private sheets) | No | P2 |
| Guest access | Yes (Shareable boards) | Yes | No | P2 |
| **FORMS** | | | | |
| Form creates new item | Yes | Yes | No | P1 |
| Conditional form logic | Yes (Standard+) | Yes | No | P1 |
| Public (no login) form | Yes | Yes | No | P1 |
| File upload in form | Yes | Enterprise only | No | P2 |
| **GANTT SPECIFIC** | | | | |
| Dependency arrows | Yes (4 types) | Yes (4 types) | No | P1 |
| Lag/lead time | Yes | Yes | No | P1 |
| Critical path | Yes | Yes | No | P2 |
| Baseline comparison | Yes | Yes | No | P2 |
| Milestones | Yes | Yes (0-duration rows) | No | P1 |
| Resource leveling | No | No (manual only) | No | P3 |
| **REPORTING** | | | | |
| Cross-board / cross-sheet reporting | Yes (Dashboards) | Yes (Reports feature) | No | P2 |
| Scheduled report emails | No native (automation workaround) | Yes | No | P2 |
| PDF/Excel export | Yes (export board) | Yes (export sheet) | No | P2 |
| **MISC** | | | | |
| Rich text docs (embedded) | Yes (Workdocs) | No (notes only) | No | P3 |
| Time tracking | Yes (built-in) | No | No | P2 |
| Templates | Yes (hundreds) | Yes (hundreds) | No | P2 |
| Mobile apps (iOS + Android) | Yes — strong apps | Yes — decent apps | No (PWA only) | P2 |
| API access | Yes (GraphQL) | Yes (REST) | Yes (Next.js API routes) | P0 |
| AI/ML features | Yes (Sidekick, Agent Builder) | Limited | Yes (Claude integration) | P2 |

---

## 4. Data Model Recommendations

This section defines the Supabase schema required to support all P0 and P1 features. All tables require GRANT blocks per the October 30, 2026 Supabase enforcement rule.

### 4.1 Core Tables

```sql
-- Migration 105: Core project management tables

-- Projects (boards in Monday, sheets in Smartsheet)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6B7EFF',
  icon TEXT,
  board_type TEXT DEFAULT 'standard'
    CHECK (board_type IN ('standard', 'private', 'template')),
  entity_type TEXT,           -- work_order | opportunity | site | lead | null
  entity_id UUID,
  settings JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  archived_at TIMESTAMPTZ
);

GRANT ALL ON TABLE public.projects TO postgres, anon, authenticated, service_role;

-- Project Groups (sections within a project board)
CREATE TABLE IF NOT EXISTS public.project_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7EFF',
  position INTEGER NOT NULL DEFAULT 0,
  is_collapsed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON TABLE public.project_groups TO postgres, anon, authenticated, service_role;

-- Project Columns (schema definition for each board)
CREATE TABLE IF NOT EXISTS public.project_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  column_type TEXT NOT NULL
    CHECK (column_type IN (
      'status','person','date','date_range','numbers','text',
      'long_text','dropdown','checkbox','rating','tags','link',
      'file','formula','time_tracking','vote','auto_number',
      'system_created_by','system_created_date','system_modified_by',
      'system_modified_date','progress','predecessor','email','phone',
      'country','color_picker','button','connect_board'
    )),
  settings JSONB DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,
  width INTEGER DEFAULT 200,
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON TABLE public.project_columns TO postgres, anon, authenticated, service_role;

-- Status Options (per project — allows fully custom statuses per board)
CREATE TABLE IF NOT EXISTS public.project_status_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0F9D58',
  is_done BOOLEAN DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0
);

GRANT ALL ON TABLE public.project_status_options TO postgres, anon, authenticated, service_role;

-- Project Items (tasks / rows)
CREATE TABLE IF NOT EXISTS public.project_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES project_groups(id) ON DELETE SET NULL,
  parent_item_id UUID REFERENCES project_items(id) ON DELETE CASCADE,
  indent_level INTEGER DEFAULT 0,       -- 0–8 for WBS hierarchy (Gantt WBS mode)
  name TEXT NOT NULL,
  position FLOAT NOT NULL DEFAULT 0,   -- fractional for drag-drop ordering
  status TEXT,                          -- status option id
  assignee_user_id TEXT,
  assignee_name TEXT,
  due_date DATE,
  start_date DATE,
  column_values JSONB DEFAULT '{}',    -- { column_id: typed_value }
  is_done BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  is_draft BOOLEAN DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  archived_at TIMESTAMPTZ
);

GRANT ALL ON TABLE public.project_items TO postgres, anon, authenticated, service_role;

-- Project Item Comments
CREATE TABLE IF NOT EXISTS public.project_item_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES project_items(id) ON DELETE CASCADE NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  body TEXT NOT NULL,
  body_html TEXT,
  mentions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON TABLE public.project_item_comments TO postgres, anon, authenticated, service_role;

-- Project Activity Log
CREATE TABLE IF NOT EXISTS public.project_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES project_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,  -- created | updated | moved | deleted | commented
  field TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON TABLE public.project_activity_log TO postgres, anon, authenticated, service_role;

-- Project Automations
CREATE TABLE IF NOT EXISTS public.project_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN (
      'status_changes','date_arrives','item_created','column_changes',
      'item_moved','button_clicked','form_submitted','scheduled'
    )),
  trigger_config JSONB NOT NULL DEFAULT '{}',
  conditions JSONB DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  run_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON TABLE public.project_automations TO postgres, anon, authenticated, service_role;

-- Project Automation Run Log
CREATE TABLE IF NOT EXISTS public.project_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES project_automations(id) ON DELETE CASCADE,
  item_id UUID REFERENCES project_items(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'success' CHECK (status IN ('success','failed','skipped')),
  error_message TEXT,
  actions_executed JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON TABLE public.project_automation_runs TO postgres, anon, authenticated, service_role;

-- Project Dashboards
CREATE TABLE IF NOT EXISTS public.project_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  source_project_ids UUID[] DEFAULT '{}',
  layout JSONB DEFAULT '[]',  -- array of { widget_id, widget_type, col, row, width, height, config }
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON TABLE public.project_dashboards TO postgres, anon, authenticated, service_role;

-- Project Time Tracking Sessions
CREATE TABLE IF NOT EXISTS public.project_time_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES project_items(id) ON DELETE CASCADE NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  note TEXT,
  is_manual BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON TABLE public.project_time_sessions TO postgres, anon, authenticated, service_role;

-- Project File Attachments
CREATE TABLE IF NOT EXISTS public.project_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES project_items(id) ON DELETE CASCADE NOT NULL,
  column_id UUID REFERENCES project_columns(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON TABLE public.project_attachments TO postgres, anon, authenticated, service_role;

-- Project Baselines (Gantt snapshots)
CREATE TABLE IF NOT EXISTS public.project_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  snapshot JSONB NOT NULL,  -- { item_id: { start_date, end_date, duration }, ... }
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON TABLE public.project_baselines TO postgres, anon, authenticated, service_role;

-- Project Views (saved view state per user per board)
CREATE TABLE IF NOT EXISTS public.project_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id TEXT NOT NULL,
  view_type TEXT NOT NULL
    CHECK (view_type IN ('grid','kanban','gantt','calendar','timeline','workload','chart')),
  name TEXT NOT NULL DEFAULT 'Default',
  settings JSONB DEFAULT '{}',  -- { hidden_columns, column_order, filters, sort, group_by }
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON TABLE public.project_views TO postgres, anon, authenticated, service_role;

-- Project Members
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor'
    CHECK (role IN ('owner','admin','editor','commenter','viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

GRANT ALL ON TABLE public.project_members TO postgres, anon, authenticated, service_role;

-- Project Forms
CREATE TABLE IF NOT EXISTS public.project_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES project_groups(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]',   -- ordered array of form field configs
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  submission_count INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON TABLE public.project_forms TO postgres, anon, authenticated, service_role;

-- Indexes
CREATE INDEX idx_project_items_project_id ON project_items(project_id);
CREATE INDEX idx_project_items_group_id ON project_items(group_id);
CREATE INDEX idx_project_items_parent_item_id ON project_items(parent_item_id);
CREATE INDEX idx_project_items_status ON project_items(status);
CREATE INDEX idx_project_items_assignee ON project_items(assignee_user_id);
CREATE INDEX idx_project_items_due_date ON project_items(due_date);
CREATE INDEX idx_project_items_updated_at ON project_items(updated_at DESC);
CREATE INDEX idx_project_activity_log_item_id ON project_activity_log(item_id);
CREATE INDEX idx_project_activity_log_project_id ON project_activity_log(project_id, created_at DESC);
CREATE INDEX idx_project_time_sessions_item_id ON project_time_sessions(item_id);
CREATE INDEX idx_project_columns_project_id ON project_columns(project_id);
CREATE INDEX idx_projects_org_id ON projects(org_id);
CREATE INDEX idx_projects_entity ON projects(entity_type, entity_id) WHERE entity_id IS NOT NULL;
```

### 4.2 JSONB Schema Conventions

**column_values on project_items:**
```json
{
  "col_uuid_1": "status_option_id",
  "col_uuid_2": ["user_id_1", "user_id_2"],
  "col_uuid_3": "2026-07-15",
  "col_uuid_4": 47500,
  "col_uuid_5": { "start": "2026-07-01", "end": "2026-07-15" },
  "col_uuid_6": { "url": "https://...", "label": "Design File" }
}
```

**project_columns settings examples by type:**
```json
// Status column
{ "options": [{ "id": "uuid", "label": "In Progress", "color": "#FF9900", "position": 1, "is_done": false }] }

// Dropdown column
{ "options": [{ "id": "opt_a", "label": "Option A" }], "allow_multiple": false }

// Numbers column
{ "prefix": "$", "suffix": "", "decimals": 2, "thousands_separator": true, "aggregate": "sum" }

// Formula column
{ "formula": "=IF({Status} = 'done', 'Complete', 'Pending')", "result_type": "text" }

// Date column
{ "include_time": false, "remind_days_before": 2 }

// Date range (Timeline) column
{ "exclude_weekends": true }

// Person column
{ "allow_multiple": true, "max_people": 5 }

// Auto-Number column
{ "prefix": "TASK-", "suffix": "", "pad_zeros": 4, "start_at": 1 }
```

**project_automations trigger_config examples:**
```json
// Status changes trigger
{ "column_id": "col_uuid_1", "from_value": "any", "to_value": "done_option_id" }

// Date arrives trigger
{ "column_id": "col_uuid_3", "offset_days": -2, "offset_direction": "before", "repeat": "none" }

// Scheduled trigger
{ "frequency": "weekly", "day_of_week": 1, "time": "09:00", "timezone": "America/New_York" }
```

**project_automations actions array:**
```json
[
  { "type": "notify", "target": "assignee", "message": "Item {{name}} is now {{Status}}." },
  { "type": "change_column_value", "column_id": "col_uuid_5", "value": "2026-12-31" },
  { "type": "move_to_group", "group_id": "group_uuid_2" },
  { "type": "send_email", "to": "{{Email}}", "subject": "Update: {{name}}", "body_html": "<p>Status changed to {{Status}}</p>" },
  { "type": "create_work_order", "template_id": "wo_template_uuid" },
  { "type": "create_crm_activity", "activity_type": "task", "subject": "Follow up on {{name}}" }
]
```

---

## 5. View Implementation Specs

### 5.1 Grid View

**Component:** `components/projects/GridView.tsx`

**Layout:** Full-width table. Sticky header row. Sticky primary column on left. Horizontal scroll for many columns.

**Column header behaviors:**
- Click column name: sort (toggle asc/desc; third click clears sort)
- Right-click column header: context menu (Rename, Hide Column, Insert Column Left/Right, Duplicate, Delete)
- Drag column header: reorder columns
- Drag column border: resize (store width in project_views.settings.column_widths)
- Small type icon on left of column name

**Row behaviors:**
- Click any cell: edit inline (no modal required)
- Press Enter: commit and move to next row; Tab: next cell; Escape: cancel
- Hover row: show row number, drag handle, checkbox, "..." action menu (Delete, Duplicate, Move to group, Open item detail)
- Click row drag handle: drag to new position (updates position float value using @dnd-kit/sortable)
- Shift-click + cmd-click: multi-row select → bulk action bar at bottom (Change Status, Move Group, Delete, Duplicate)
- Click item name: open ItemDetailPanel (right-side drawer, 480px wide)
- Sub-items: expand chevron on parent row; renders indented rows below parent

**Group behaviors:**
- Group header row (full-width colored bar): group name, item count, collapse chevron
- Click collapse: collapse/expand all group items
- Group summary row at bottom: aggregate values per column (sum for numbers, count for items)
- "+ Add Item" button at bottom of each group
- Drag group header to reorder groups
- Right-click group: Rename, Change Color, Duplicate, Delete

**Filter bar:** Always-visible at top. "+ Add Filter" → column selector → operator → value. Filters are AND. Saved per user per view in project_views.settings.filters.

**Quick filter presets:** "Assigned to me", "Due this week", "Overdue", "Not done"

**Inline value editors by column type:**
- Status: chip dropdown showing all status options with their colors
- Person: user search popover with avatar list (members of the project)
- Date: datepicker popover (react-day-picker or similar)
- Numbers: direct number input with prefix/suffix display
- Dropdown: option list popover (single or multi)
- Checkbox: toggle on click
- Text: inline text input; Long Text expands to textarea on click

---

### 5.2 Kanban View

**Component:** `components/projects/KanbanView.tsx`

**Layout:** Horizontal scrollable columns (overflow-x-auto). Each column = one status option. Column width: 280px fixed.

**Column header:** Status label chip + item count badge + WIP limit indicator (red when exceeded) + "+" button to add item.

**Card layout:**
```
┌─────────────────────────────┐
│ [assignee avatar(s)]        │
│ Item Name (2-line max)      │
│ [due date] [sub-items: X]  │
│ [any configured quick info] │
└─────────────────────────────┘
```

**Card interactions:**
- Click: open ItemDetailPanel
- Drag between columns: updates status column value, optimistic UI update, patches database
- Drag within column: updates position float value
- Long-press (mobile): initiate drag

**WIP limits:** Configured in project settings. Column header shows "X/limit" when WIP limit set. Header and count turn red when exceeded.

**Swimlanes (optional):** Secondary grouping dimension. If "Group by Person" is active, each status column gets horizontal swimlane separators per assignee.

---

### 5.3 Gantt View

**Component:** `components/projects/GanttView.tsx`

Two-panel layout: left panel (280px fixed, resizable) + right panel (flexible, horizontally scrollable canvas).

**Left panel:**
- Item rows: name, assignee avatar, start date, end date
- Collapsible groups matching Grid view groups
- Expand sub-items and indented WBS rows
- Tab/Shift+Tab keyboard shortcuts for indent/outdent

**Right panel (SVG/Canvas timeline):**
- X-axis: time scale with zoom controls (Day/Week/Month/Quarter/Year)
- Y-axis: one row per item, same height as left panel rows
- Gantt bars:
  - Color from group color (configurable to use status color)
  - Drag bar horizontally: updates both start_date and due_date together
  - Drag right edge: extends/shrinks due_date (duration changes)
  - Drag left edge: moves start_date (duration changes)
  - Progress fill from left based on % Complete column value
  - Item name label inside bar when bar is wide enough, outside when narrow
- Dependency arrows: SVG curved arrows. Click to view/edit type. Drag from bar endpoint circles to create new dependencies.
  - FS (Finish-to-Start): most common, arrow from end of A to start of B
  - SS (Start-to-Start): arrow from start of A to start of B
  - FF (Finish-to-Finish): arrow from end of A to end of B
  - SF (Start-to-Finish): arrow from start of A to end of B
  - Lag/lead displayed as a label on the arrow line
- Milestone diamonds: items where start_date = due_date
- Today line: vertical red dashed line
- Critical path toggle: critical-path bars and arrows render in red
- Baseline overlay: toggle shows gray shadow bars behind current bars
- Group summary bars: span from earliest child start to latest child end; automatically computed

**Toolbar:** Zoom in/out, Today button (scroll to today), Baseline button (take snapshot / compare), Critical Path toggle, Export to PDF.

---

### 5.4 Calendar View

**Component:** `components/projects/CalendarView.tsx`

**Modes:** Month (default) | Week

**Month mode:**
- Standard 7-column calendar grid
- Items appear on due_date (or start_date if no due_date) as colored chip bars
- Items with both start_date and due_date span multiple day cells as horizontal bars
- Max 3 items shown per day cell; "+X more" expands to a popover
- Click day cell: quick-add item with that date pre-filled
- Drag items between day cells: updates the date (optimistic)

**Color coding:** by Group color (default) or Status color. Toggle in toolbar.

---

### 5.5 Item Detail Panel

**Component:** `components/projects/ItemDetailPanel.tsx`

Right-side drawer. Width: 480px on desktop. Full-screen on mobile. Slide-in animation. Rest of the view remains visible and usable.

**Sections (top to bottom):**
1. **Header:** Item name (H2, editable inline), breadcrumb (Project > Group), status chip (click to change), assignee avatars (click to assign/remove)
2. **Core Column Values:** Two-column grid showing every column with its edit-friendly input. Labels on left, values on right. Compact layout.
3. **Description:** Long-text rich text block (TipTap or similar). Placeholder: "Add a description..."
4. **Sub-items:** Expandable section. Shows all sub-items in a mini-table with status, assignee, due date. "+ Add sub-item" button at bottom.
5. **Attachments:** Drag-drop zone. File list with thumbnails for images, type icon for other files. File name, size, uploader, upload date. Download and delete actions.
6. **Conversation:** Comment thread. Each comment: avatar + name + timestamp + body (markdown rendered). @mention support with user search popover. Emoji reactions by clicking the smiley icon on any comment.
7. **Activity Log:** Chronological reverse list. Each entry: avatar + "UserName changed Status from X to Y" + timestamp. Expandable.
8. **Time Tracking:** Play/pause button (green when stopped, red when running). Current session timer. List of all past sessions by user. Manual add button.

---

### 5.6 Form View (Public Form)

**Builder component:** `components/projects/FormBuilder.tsx` (authenticated, drag-drop)
**Public page:** `app/projects/[id]/forms/[slug]/page.tsx` (no auth required)

**Field types in public form:**
- Text → maps to Text column
- Long Text (with optional character limit) → maps to Long Text column
- Number → maps to Numbers column
- Dropdown → shows configured options; maps to Dropdown column
- Date → date picker; maps to Date column
- Checkbox → maps to Checkbox column
- Rating → star selector; maps to Rating column
- File Upload → maps to File column (stored in Supabase Storage)

**Conditional logic:** Rules stored per field: `{ "show_if": { "field_id": "col_uuid", "operator": "equals", "value": "Yes" } }`. Client-side evaluation.

**Submission:** POST to `/api/projects/[id]/forms/[slug]/submit` → creates a `project_items` row in the designated group with all mapped column values.

---

## 6. Column Type Specs

### 6.1 Status Column
```typescript
interface StatusColumnSettings {
  options: Array<{
    id: string;       // stable UUID reference
    label: string;
    color: string;    // hex
    is_done: boolean; // counts toward completion %
    position: number;
  }>;
}
// Storage: string (option id) in column_values
// Kanban view: each option becomes a swimlane column
// When is_done = true: item.is_done is set to true by trigger
// Group summary: count of items per status
```

### 6.2 Person Column
```typescript
interface PersonColumnSettings {
  allow_multiple: boolean;
  max_people: number; // max 20
}
// Storage: string (user_id) or string[] (multiple)
// Display: avatar from Clerk user profile + display name
// Workload view uses this column as the "person" dimension
// Automation: "notify assignee" reads this column
```

### 6.3 Date Column
```typescript
interface DateColumnSettings {
  include_time: boolean;
  remind_days_before: number | null;
  format: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
}
// Storage: ISO date string "2026-07-15" or datetime "2026-07-15T14:30:00Z"
// Calendar view uses this column for item placement
// Automation date_arrives trigger reads this column
```

### 6.4 Date Range (Timeline) Column
```typescript
interface DateRangeColumnSettings {
  exclude_weekends: boolean;
}
// Storage: { start: "2026-07-01", end: "2026-07-15" }
// Gantt view uses this for bar rendering (alternative to separate start_date + due_date)
// Duration auto-calculated at render time
```

### 6.5 Numbers Column
```typescript
interface NumbersColumnSettings {
  prefix: string;           // e.g., "$"
  suffix: string;           // e.g., " hrs"
  decimals: number;         // 0–10
  thousands_separator: boolean;
  aggregate: 'sum' | 'avg' | 'count' | 'min' | 'max';
  direction?: 'higher_better' | 'lower_better'; // for dashboard color coding
}
// Storage: number (float)
// Group summary row: shows aggregate value
// Workload view: if designated as "effort_hours", sums per person per week
```

### 6.6 Dropdown Column
```typescript
interface DropdownColumnSettings {
  options: Array<{ id: string; label: string; color?: string }>;
  allow_multiple: boolean;
}
// Storage: string (single option id) or string[] (multiple option ids)
// Display: tag chips with color if configured
```

### 6.7 Formula Column
```typescript
interface FormulaColumnSettings {
  formula: string;      // Excel-like syntax referencing {ColumnName}
  result_type: 'text' | 'number' | 'date' | 'boolean';
}
// Formula evaluated server-side on every item save
// References: {ColumnName} = value of that column on same item
// P0/P1 functions: IF, AND, OR, NOT, ROUND, ABS, MIN, MAX,
//   TODAY, DATEDIF, LEFT, RIGHT, MID, LEN, UPPER, LOWER,
//   CONCATENATE, TRIM, CONTAINS
// P2 functions: cross-item via Rollup
// Storage: computed value cached in column_values; recomputed when dependency columns change
// Circular reference detection required
```

### 6.8 Progress Column
```typescript
// P1: used in Gantt bar fill
// Storage: number 0–100 in column_values
// Parent rows: auto-calculated as weighted average of children's progress values
// Gantt bar fills from left proportionally
```

### 6.9 Predecessor Column
```typescript
// P1: used in Gantt dependency arrows
// Storage: string with dependency references in column_values
// Format: "3FS, 5SS+2d" where 3 and 5 are item positions, FS/SS are types, +2d is lag
// Parsed at Gantt render time to draw SVG dependency arrows
// Types: FS=Finish-to-Start, SS=Start-to-Start, FF=Finish-to-Finish, SF=Start-to-Finish
// Lag: +Nd adds N days; -Nd is lead time (start earlier)
```

### 6.10 Auto-Number Column
```typescript
interface AutoNumberColumnSettings {
  prefix: string;     // e.g., "TASK-"
  suffix: string;
  pad_zeros: number;  // e.g., 4 → "TASK-0001"
  start_at: number;
}
// Assigned on item creation. Never changes. Unique per project.
// Sequence tracked server-side (MAX + 1 in a DB transaction)
// Storage: string (formatted) in column_values
```

### 6.11 Time Tracking Column
```typescript
// Storage: NOT in column_values; lives in project_time_sessions table
// Column cell displays: total accumulated seconds for the item (all users combined)
// Clicking opens timer controls in the item detail panel
// Start/stop triggers: POST /api/project-items/[id]/time-sessions
// Group summary: total seconds across all items in group, converted to hours display
```

---

## 7. Automation Engine Spec

### 7.1 Architecture

Event-driven background processor using Inngest (already in codebase). When a `project_items` row changes, the engine:

1. Identifies active automations on the project
2. Checks trigger conditions against changed data
3. Evaluates filter conditions (condition blocks)
4. Executes matched action blocks sequentially
5. Logs the run to `project_automation_runs`

**Trigger flow:**
- Supabase Realtime (postgres_changes on project_items) → webhook → `/api/inngest`
- Inngest fires `run-project-automations` function with: `{ item_id, project_id, changed_fields, old_values, new_values, trigger_user_id }`

**Inngest function file:** `inngest/functions/run-project-automations.ts`
- `maxDuration: 60` seconds
- `retries: 2`
- Idempotency key: `project-auto-${item_id}-${event.ts}`

### 7.2 Trigger Evaluation

```typescript
type TriggerType =
  | 'status_changes'    // column_id, from_value ('any' | option_id), to_value
  | 'date_arrives'      // column_id, offset_days, offset_direction ('before'|'after'|'on')
  | 'item_created'      // no config — fires on INSERT
  | 'column_changes'    // column_id — fires on any change to that column
  | 'item_moved'        // target_group_id
  | 'button_clicked'    // button_column_id
  | 'form_submitted'    // form_id
  | 'scheduled'         // frequency, day_of_week, time, timezone

// Trigger evaluation order:
// 1. item_created — checked on INSERT events only
// 2. status_changes — checked when status field changed
// 3. column_changes — checked when any specified column changed
// 4. date_arrives — evaluated by daily cron at 8am UTC against all items
// 5. item_moved — checked when group_id changes
// 6. scheduled — triggered by Inngest scheduled event, applied to all project items
```

### 7.3 Condition Evaluation

```typescript
interface ConditionBlock {
  column_id: string;  // 'status' | 'assignee' | any project_columns.id
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains'
           | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'
           | 'date_before' | 'date_after' | 'is_today' | 'within_days';
  value: any;
}

// All conditions must be true for actions to execute (AND logic)
// Condition blocks evaluated in order; first failure short-circuits
```

### 7.4 Action Execution

```typescript
type ActionType =
  | 'notify'              // in-app + email notification
  | 'send_email'          // custom email via Resend
  | 'change_column_value' // set any column to a value
  | 'move_to_group'       // move item to a different group
  | 'create_item'         // create new item in this or another project
  | 'create_sub_item'     // create sub-item under current item
  | 'duplicate_item'      // copy item
  | 'assign_person'       // set assignee
  | 'clear_column'        // set column to empty
  | 'push_date'           // offset a date column by N days
  | 'archive_item'        // set archived_at
  // GateGuard-specific extensions:
  | 'create_work_order'   // creates work_orders row linked to item
  | 'create_crm_activity' // creates crm_activities row

// Template substitution: message fields support {{ColumnName}} placeholders
// Resolved at execution time by reading item.column_values[column_id]
// Built-in placeholders: {{name}}, {{assignee_name}}, {{due_date}}, {{status}}
```

### 7.5 Pre-built Automation Templates

Display in the automation builder as one-click templates:

| # | Template Name | Trigger | Action |
|---|--------------|---------|--------|
| 1 | Notify on done | Status changes to Done | Notify assignee |
| 2 | Due date reminder | 2 days before due date | Notify assignee |
| 3 | Auto-assign on create | Item created | Assign person to [me] |
| 4 | Set start date | Status changes to In Progress | Set start date to today |
| 5 | Record completion date | Status changes to Done | Set completion date to today |
| 6 | Weekly due-this-week | Every Monday 9am | Notify assignee of items due this week |
| 7 | Checkbox → Done | Checkbox checked | Change status to Done |
| 8 | Send email on status | Status changes to Sent | Send email to client email column |
| 9 | Move to next group | Status changes to Done | Move item to Completed group |
| 10 | Create WO from project | Status changes to Scheduled | Create work order |

---

## 8. Dashboard Spec

### 8.1 Dashboard Architecture

Dashboards live at `/projects/dashboards/[id]`. Free-form widget canvas using a 12-column CSS grid (each column = ~85px on 1280px viewport). Row height unit = 80px. Minimum widget size: 3 cols × 2 rows.

**Widget position schema (stored in project_dashboards.layout):**
```typescript
interface WidgetLayout {
  widget_id: string;
  widget_type: WidgetType;
  col: number;      // 1–12 (column start)
  row: number;      // 1–N (row start)
  width: number;    // column span (1–12)
  height: number;   // row span (minimum 2)
  config: WidgetConfig;
}
```

**Dashboard interactions:**
- Create: "+ New Dashboard" from `/projects` page
- Add widgets: "+ Add Widget" button opens right panel with widget type picker
- Resize: drag bottom-right corner of any widget
- Move: drag widget by its header
- Delete: X button on widget header (with confirm)
- Share: copy link to dashboard (respects project_members access)

### 8.2 Widget Type Specs

**Chart Widget:**
```typescript
{
  title: string;
  chart_type: 'bar' | 'line' | 'pie' | 'donut' | 'area' | 'stacked_bar';
  source_project_ids: string[];
  x_axis_column_id: string;
  y_axis: 'count' | 'sum' | 'average';
  y_axis_column_id?: string;    // required for sum/average (must be Numbers column)
  group_by_column_id?: string;  // for stacked bars (adds color dimension)
  filters?: ConditionBlock[];
  color_scheme: 'default' | 'monochrome' | 'brand';
}
```

**Numbers / KPI Widget:**
```typescript
{
  title: string;
  subtitle?: string;
  source_project_ids: string[];
  metric: 'count' | 'sum' | 'average' | 'min' | 'max';
  column_id?: string;
  filters?: ConditionBlock[];
  format: 'number' | 'currency' | 'percentage' | 'duration';
  comparison_value?: number;
  comparison_label?: string;
  trend_direction?: 'up_good' | 'down_good';
}
```

**Battery / Progress Widget:**
```typescript
{
  title: string;
  source_project_ids: string[];
  done_status_ids: string[];    // which status option ids count as "done"
  filters?: ConditionBlock[];
  show_percentage: boolean;
  show_counts: boolean;         // "X of Y items done"
}
// Bar renders: green = done%, gray = remaining%
```

**Gantt Widget:**
```typescript
{
  title: string;
  source_project_ids: string[];
  start_column_id: string;      // Date or Date Range column
  end_column_id: string;        // Date column (if not using Date Range)
  group_by_column_id?: string;
  filters?: ConditionBlock[];
  zoom_level: 'week' | 'month' | 'quarter';
}
```

**Embed / iFrame Widget:**
```typescript
{
  title: string;
  url: string;
  allow_interaction: boolean;
}
```

**Text Widget:**
```typescript
{
  content_html: string;
  font_size: 'small' | 'medium' | 'large';
  alignment: 'left' | 'center' | 'right';
}
```

**Activity Feed Widget:**
```typescript
{
  title: string;
  source_project_ids: string[];
  max_items: number;   // 5–50
  filter_action_types?: string[];
}
```

---

## 9. Phased Build Plan

### P0 — Foundation (Must Have First)

| # | Feature | Files to Create/Edit |
|---|---------|---------------------|
| P0-1 | DB migrations 105 (all core tables) | `supabase/migrations/105_projects.sql` |
| P0-2 | Projects list page | `app/projects/page.tsx` |
| P0-3 | Project detail — Grid view | `app/projects/[id]/page.tsx`, `components/projects/GridView.tsx` |
| P0-4 | Item detail panel | `components/projects/ItemDetailPanel.tsx` |
| P0-5 | Column management | `components/projects/ColumnManager.tsx` |
| P0-6 | Status column + status options | Built into P0-3 |
| P0-7 | Person / Assignee column | Built into P0-3 |
| P0-8 | Date column + datepicker | Built into P0-3 |
| P0-9 | Text / Long Text columns | Built into P0-3 |
| P0-10 | Groups management (create, reorder, color) | `components/projects/GroupHeader.tsx` |
| P0-11 | REST API: projects CRUD | `app/api/projects/route.ts`, `app/api/projects/[id]/route.ts` |
| P0-12 | REST API: items CRUD | `app/api/projects/[id]/items/route.ts`, `app/api/projects/[id]/items/[itemId]/route.ts` |
| P0-13 | REST API: groups CRUD | `app/api/projects/[id]/groups/route.ts` |
| P0-14 | Sidebar navigation | Add Projects to `components/layout/Sidebar.tsx` |
| P0-15 | Project creation wizard | Inline modal: name, color, template picker |
| P0-16 | Real-time updates (Supabase) | Subscribe to project_items changes on project detail page |

### P1 — Core Power Features (Sprint 2)

| # | Feature | Notes |
|---|---------|-------|
| P1-1 | Kanban view | Drag-drop columns by status; WIP limits |
| P1-2 | Gantt view — basic | Timeline bars, drag to reschedule, group summary bars, milestones |
| P1-3 | Gantt dependencies | Dependency arrows, 4 types, lag/lead time |
| P1-4 | Gantt critical path | Toggle to highlight critical path in red |
| P1-5 | Calendar view | Month view with date-based item placement; drag to reschedule |
| P1-6 | Sub-items | One level of nesting; sub-item columns independent of parent board |
| P1-7 | WBS indent in Gantt | Tab/Shift+Tab to indent rows in Gantt mode (Smartsheet-style) |
| P1-8 | Numbers column | Numeric values with sum/avg/count in group summary |
| P1-9 | Dropdown column | Single and multi-select |
| P1-10 | Checkbox column | Boolean toggle |
| P1-11 | Date range (Timeline) column | Start + End dates for Gantt |
| P1-12 | Predecessor column | Dependency references for Gantt |
| P1-13 | Progress % column | 0–100 with Gantt bar fill |
| P1-14 | System columns (Created/Modified) | Auto-populated |
| P1-15 | Automation — status_changes trigger | status_changes, item_created, date_arrives |
| P1-16 | Automation — notify + email actions | Via Resend; in-app notification |
| P1-17 | Automation — change column value | Programmatic column updates |
| P1-18 | Automation builder UI | Visual block builder modal |
| P1-19 | @mentions in comments | @name → search + notify |
| P1-20 | Activity log per item | Change history in ItemDetailPanel |
| P1-21 | Form view | Public form → creates new item; conditional logic |
| P1-22 | Multi-board dashboard | Dashboard page pulling from multiple projects |
| P1-23 | Chart dashboard widget | Bar, line, pie from project data |
| P1-24 | Project member roles | Owner, Admin, Editor, Viewer per project |
| P1-25 | Gantt baseline | Take snapshot; compare to current plan |
| P1-26 | Project templates | 5 pre-built templates (New Install, Service Job, etc.) |
| P1-27 | Won Opportunity → Create Job CTA | On opportunity detail when stage = Won |
| P1-28 | New Install project template | 6-phase workflow with pre-built groups, columns, automations |

### P2 — Full Feature Parity (Sprint 3+)

| # | Feature |
|---|---------|
| P2-1 | Timeline view (roadmap, no deps) |
| P2-2 | Workload view (per-person capacity) |
| P2-3 | Chart view embedded per board |
| P2-4 | Formula column |
| P2-5 | Rating column |
| P2-6 | Tags column (cross-project) |
| P2-7 | Link column |
| P2-8 | File attachment column |
| P2-9 | Time tracking column |
| P2-10 | Auto-number column |
| P2-11 | Conditional formatting (row/cell color rules) |
| P2-12 | Board-level activity log |
| P2-13 | Automation: move item, create item, scheduled trigger |
| P2-14 | Battery / Progress dashboard widget |
| P2-15 | Gantt dashboard widget |
| P2-16 | Embed/iFrame dashboard widget |
| P2-17 | Activity feed dashboard widget |
| P2-18 | Cross-project reporting (multi-project rollup) |
| P2-19 | Scheduled report emails via Resend |
| P2-20 | PDF/Excel export |
| P2-21 | Private boards |
| P2-22 | Guest/external access (shareable project link) |
| P2-23 | Mobile-optimized views |
| P2-24 | Project templates from existing projects |
| P2-25 | Connect Boards column (cross-project links) |
| P2-26 | Mirror column |
| P2-27 | Rollup column (aggregate sub-item values) |

### P3 — Advanced / Differentiating

| # | Feature |
|---|---------|
| P3-1 | AI-powered item creation (plain English → tasks) |
| P3-2 | AI task decomposition (goal → breakdown) |
| P3-3 | AI risk detection (at-risk items based on progress + dates) |
| P3-4 | Update requests (Smartsheet-style email-based form) |
| P3-5 | Proof / file markup (annotate images/PDFs on items) |
| P3-6 | Resource leveling (auto-suggest reassignment) |
| P3-7 | Cross-project cell linking (formula references) |
| P3-8 | Control Center equivalent (blueprint-based project provisioning) |
| P3-9 | Dynamic View (secure filtered sharing for clients) |
| P3-10 | Map view for projects |
| P3-11 | Budget / Earned Value tracking |
| P3-12 | Portfolio-level Gantt (all active projects on one timeline) |
| P3-13 | DocGen (fill Word/PDF templates with project row data) |

---

## 10. UX Decisions

### 10.1 Fundamental Philosophy: Hybrid Model

Monday.com is **column-first**: fixed board schema, all items share columns, 1-level sub-items. Simple, visual, non-technical-user-friendly.

Smartsheet is **row-hierarchy-first**: rows indent up to 8 levels, true WBS, parent rows auto-aggregate children. Maps directly to construction/installation project structures.

**GateGuard decision:** Hybrid. Use Monday.com's Groups + Sub-items as the primary interface (easier to explain to field staff and dealers). Implement Smartsheet's row indent (8-level WBS) as an optional mode within Gantt view, because GateGuard's New Install workflow has natural phase → task → checklist hierarchy.

### 10.2 Status Model

Adopt Monday.com's approach fully: each project defines its own status options with custom colors and labels. This allows the New Install project to have: "Deposit Pending → Equipment Ordered → Assembly → Scheduled → In Progress → QC Review → Invoiced → Complete" while a Service Job uses simpler statuses.

DO NOT use a global status enum. Status options are per-project and stored in `project_status_options`. The `project_items.status` column stores the option ID, not the label text.

### 10.3 Drag-and-Drop

Use `@dnd-kit/core` and `@dnd-kit/sortable` (already a de facto standard in the React ecosystem; lightweight, works with both mouse and touch events). Do not use `react-beautiful-dnd` (deprecated).

Use fractional positioning (`position FLOAT`) rather than integer position. Inserting between positions 1.0 and 2.0 assigns 1.5. Only rebalance all positions when gap < 0.0001 (very rare). This means drag-drop only updates one row's position value, not a full reindex.

### 10.4 Real-time Collaboration

Supabase Realtime subscription on `project_items` filtered by `project_id = eq.${projectId}`. When any item changes, update local React state. Apply optimistic updates on the client before the server confirms to prevent UI lag.

Conflict resolution: last-write-wins per field (acceptable for P0–P1). True conflict merging is P3.

### 10.5 Automation Builder UI

Visual block builder in a full-screen modal. Layout:
- Header: automation name (editable) + active toggle
- Trigger block (top): colored card. Dropdown for trigger type. Inline config fields based on type.
- Arrow down to:
- Optional Condition block(s): + Add Condition button between trigger and first action
- Action block(s): colored cards in sequence. + Add Action button at bottom.
- Footer: plain-English preview "When [trigger], if [conditions], then [actions]" + Save + Test Run buttons

Template gallery: shown first when creating a new automation. Grid of pre-built cards. Click to pre-populate the builder.

### 10.6 GateGuard-Specific Project Templates

**New Install Template** — groups and pre-configured statuses:
- Group 1: Pre-Installation (statuses: Deposit Pending, Equipment Ordered, Equipment Received, Ready to Schedule)
- Group 2: Scheduling (statuses: Scheduling, Confirmed, Rescheduled)
- Group 3: Installation (statuses: In Progress, Blocked, Complete)
- Group 4: Quality Control (statuses: QC Pending, Revision Needed, Approved)
- Group 5: Billing & Handoff (statuses: Invoice Drafted, Invoice Sent, Paid, Closed)

Columns pre-configured: Status, Assigned Technician (Person), Scheduled Date (Date), Equipment List (Long Text), Site Name (Text), Quote # (Text), Notes (Long Text)

Pre-built automations included:
- "When status changes to Equipment Received → notify assigned technician to schedule"
- "When Installation status changes to Complete → change QC status to QC Pending and notify QC supervisor"
- "When QC status = Approved → change Billing status to Invoice Drafted and notify billing"
- "3 days before Scheduled Date → notify technician and site contact"

**Service Job Template** — simpler:
- Group 1: New Requests
- Group 2: Scheduled
- Group 3: In Progress
- Group 4: Awaiting Parts
- Group 5: Complete

### 10.7 Integration with Existing Portal

DO NOT replace the existing `TrackerBoard.tsx` and `/tracker` route. The relationship is:

| Feature | When to use |
|---------|-------------|
| `TrackerBoard.tsx` (embedded) | Lightweight task board for a single entity (work order, opportunity, site, lead). In-context, quick tasks, no complex views. |
| `/projects` (new) | Full project management for complex, multi-phase work (New Install jobs, multi-dealer deployments, internal operations). |

When a Won Opportunity triggers "Create Job":
1. Creates a new `projects` row using the New Install template
2. Sets `entity_type = 'opportunity'` and `entity_id = opportunity.id`
3. Links back from opportunity detail: "View Full Project →" link opens `/projects/[new_project_id]`
4. The embedded TrackerBoard on the opportunity detail still shows quick tasks (they are `tracker_items`, not `project_items`)

### 10.8 Design Language

Consistent with existing portal:
- Background: `#F8FAFC`
- Brand blue: `#6B7EFF`
- Card style: white bg, `rounded-xl`, `shadow-sm`, `border border-gray-100`
- Group header: colored left border (4px) matching the group's color property
- Kanban cards: same card quality as dashboard KPI cards — no excessive borders or shadows
- Gantt bars: color matches group color (configurable to use status color via toolbar toggle)
- Status chips: colored background, white text, 6px border-radius, same pattern as existing portal status displays
- Typography: Inter throughout (no exceptions in this module)
- Toolbar pattern: same as dispatch/ARIA top bars — white bg, `border-b border-gray-100`, `h-14`

### 10.9 Monday.com vs. Smartsheet — Final UX Choices

| Decision Point | Choice | Reason |
|---------------|--------|--------|
| Adding new items | Click "+ Add Item" button at bottom of group | More explicit than clicking an empty row (Smartsheet style); better for non-technical users |
| Column type display | Column name + small type icon in header | Monday style; cleaner than Smartsheet's verbose header |
| Status column | Custom colors + labels per project | Monday style; Smartsheet symbol sets are too limited |
| Row hierarchy | Groups + 1-level sub-items (primary) + 8-level WBS indent in Gantt mode | Hybrid |
| Filter UX | Always-visible filter bar above table | Monday style; Smartsheet's hidden filter icon is hard to discover |
| Automation builder | Block-based visual builder | Monday style; cleaner for non-technical users |
| Forms | Separate Form tab within the project | Monday style |
| Dashboard creation | Standalone dashboards, pull from multiple projects | Monday style |
| Cross-board data | Connect Boards column + Mirror (P2) | Monday style; Smartsheet-style cell links in P3 |
| Deadline notifications | Via automation engine + Resend | Use existing portal infrastructure |
| Inline item editing | Click to edit in the grid cell itself | Both platforms do this; keep consistent with existing TrackerBoard |
| Approval workflow | Automation + DocuSign integration (existing) | Use existing `/sign/[token]` infrastructure rather than building Smartsheet-style update requests |

---

*Document maintained in `/docs/project-management-research.md`. Update after each projects sprint. Reference in CLAUDE.md sessions as "PM Research Spec." Next steps: write migration 105 and the projects list page.*
