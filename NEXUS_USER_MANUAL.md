# NEXUS — GateGuard Dealer Portal
## Complete User Manual

**Version 15 · Updated May 27, 2026**
**Portal:** [portal.gateguard.co](https://portal.gateguard.co)

---

> **What is NEXUS?**
> NEXUS is the GateGuard command center for your entire dealer operation. From onboarding a new dealer to closing a quote, dispatching a technician, and reviewing invoices — everything lives here. This manual walks you through every section step by step.

---

## Table of Contents

1. [Getting Started — Login & Navigation](#1-getting-started)
2. [Dashboard — Your Command Center](#2-dashboard)
3. [Dealer Onboarding — Adding a New Dealer](#3-dealer-onboarding)
4. [Dealer Detail & Compliance](#4-dealer-detail--compliance)
5. [Feature Settings — Controlling What Each Tier Sees](#5-feature-settings)
6. [Platform Users — Managing User Access](#6-platform-users)
7. [CRM — Leads & Opportunities](#7-crm)
8. [ARIA — AI Lead Intelligence](#8-aria)
9. [Quotes & Proposals](#9-quotes--proposals)
10. [Sites & Properties](#10-sites--properties)
11. [Dispatch & Work Orders](#11-dispatch--work-orders)
12. [Field Tech Tool (/tech)](#12-field-tech-tool)
13. [Site Surveys](#13-site-surveys)
14. [AI Agents (AI Army)](#14-ai-agents)
15. [Billing & Invoices](#15-billing--invoices)
16. [Map View](#16-map-view)
17. [Training & Scorecards](#17-training--scorecards)
18. [Installing NEXUS on Your Phone (PWA)](#18-installing-nexus-on-your-phone)
19. [Support & Troubleshooting](#19-support--troubleshooting)

---

## 1. Getting Started

### 1.1 Signing In

1. Open your browser and go to **portal.gateguard.co**
2. Enter your GateGuard email address and password
3. Click **Sign In**
4. If you have two-factor authentication enabled, enter your code when prompted

> **First time?** Check your email for a portal invite from GateGuard. Click the link in the email — it takes you directly to the sign-up page where you create your password.

### 1.2 Understanding Your Role

Your access level depends on the role assigned to your account. There are two layers:

**Portal Role** (what actions you can take):

| Role | What you can do |
|------|----------------|
| **Admin** | Everything — onboard dealers, countersign documents, manage all orgs |
| **Supervisor** | Manage dealers and sites in your territory |
| **Agent** | Create and edit quotes, work orders, surveys |
| **Dealer** | View your own org's data — sites, quotes, work orders, invoices |

**Org Tier** (where you sit in the dealer hierarchy):

| Tier | Who this is |
|------|------------|
| **GateGuard Corporate** | GateGuard internal team — sees everything |
| **Master Agent** | Recruits and manages dealer networks |
| **MSO (Master System Operator)** | Billing entity for a property portfolio |
| **Full Dealer** | Sells, installs, and services |
| **Service Dealer** | Ongoing service and maintenance only |
| **Install Contractor** | Installation and commissioning only |
| **Sales Partner** | Brings leads and earns lifetime commission |

> **Important:** You can only see dealers, users, and data at your own org tier or below — never above. A Full Dealer cannot see MSO-level data.

### 1.3 Navigating the Portal

The **left sidebar** is your main navigation. It is organized into sections:

- Click a section header to expand or collapse it
- The section you are currently in stays expanded automatically
- Your active page is highlighted with a blue indicator
- On mobile, tap the menu icon to open the sidebar

**Quick links at the top of the sidebar (admin accounts only):**
- **Features** → Global tier defaults
- **Dealers** → Dealer list and per-org settings
- **Users** → Platform user management

**AI Army** (expandable panel in the sidebar):
Shows your 8 AI agents with a green dot indicating which are live. Click any agent name to open that tool.

---

## 2. Dashboard

**Route:** `/` (Home)

The Dashboard is the first screen you see after logging in. It gives you a live snapshot of your operation.

### 2.1 KPI Cards

Four cards across the top of the screen. Each shows a primary metric, a sparkline chart, and a trend delta:

| Card | What it measures |
|------|-----------------|
| **Revenue & Pipeline** | Active monthly recurring revenue + open quote pipeline |
| **Ops Health** | Cameras and doors online vs. total + open work orders |
| **Account Growth** | Total active accounts + new activations this month |
| **Critical Alerts** | Unresolved alerts requiring attention |

On mobile, only the primary metric shows. The full detail appears on desktop.

### 2.2 EOS + Team Performance

Three panels below the KPI cards:

**Q2 Rocks** — Your six quarterly company goals with status badges (On Track / At Risk / Off Track). Links to the full EOS section.

**Team Performance** — Your XP level, streak days, and the current leaderboard showing the top 3 performers.

**Challenges + Scorecard** — Active challenges with progress bars and weekly Scorecard metrics (New Opportunities, Proposals Sent, Active Dealers, Installed Properties, Uptime).

### 2.3 All Accounts Table

The bottom-left shows your most recently added accounts. Each row has:
- Account name with status indicator
- Organization tier (color-coded pill)
- Date added *(desktop only)*
- Hover actions: **+ Add to L10**, view, and settings

### 2.4 System & Alerts Panel

Bottom-right column shows three mini-sections:
1. **Recent alerts** — last 4 system events with timestamp
2. **Quick Actions** — one-click: New Quote, New Work Order, Add Account, View SOC
3. **Platform Status** — live status of connected APIs (EagleEye, Brivo, DirecTV, Supabase, Vercel)

---

## 3. Dealer Onboarding

**Route:** `/admin/dealers/new`

Use this wizard to set up a new dealer organization from scratch. The wizard has **9 steps** and takes about 10 minutes to complete.

> **Before you start:** Have the dealer's legal name, address, primary contact email, and their preferred entity type ready.

### Step 1 — Choose Dealer Tier

Select which type of dealer this organization is:

| Option | Choose this when... |
|--------|-------------------|
| **Full Dealership** | They will sell, install, AND service properties |
| **Service Dealer** | They will handle ongoing maintenance only |
| **Installing Contractor** | They are installing equipment but not selling |
| **Sales Partner** | They bring leads and close deals — no field work |
| **MSO** | They are a billing/management umbrella for other dealers |
| **Master Agent** | They recruit and manage a network of dealers |

Click the card that matches, then click **Next →**

### Step 2 — Organization Info

Fill in the dealer's company details:

1. **Organization Name** — Enter the full legal name exactly as it appears on their business registration (this goes into the NDA and Agreement)
2. **Entity Type** — Select from the dropdown: LLC, Corporation, S Corp, etc.
3. **License Number** — Their low-voltage or contractor license number
4. **Service Area States** — Click each state they operate in (you can select multiple)
5. **Number of Technicians** — Approximate team size
6. **Address** — Street, City, State, ZIP
7. **Phone** — Primary business phone
8. **Email** — Primary contact email (signing links will be sent here)
9. **Website** — Optional

Click **Next →** — the system creates a draft org record at this point.

### Step 3 — Non-Disclosure Agreement (NDA)

This step sends the Mutual NDA to the dealer for signature. Before sending:

**Review the document:**
1. Check that the **Effective Date** field shows the correct date (defaults to today — click to change)
2. Click **Preview & Edit** to open the full NDA text
3. Read through the document — all merge fields (dealer name, address, entity type) are pre-filled from Step 2
4. If any text needs to change, edit directly in the text box
5. Click **Preview & Edit** again to close the preview

**Send the NDA:**
1. Verify the dealer's email address shown at the top is correct
2. Click **Send for Signature** in the signing panel
3. The dealer will receive an email with a link to review and sign
4. The status updates to **Pending**

**After the dealer signs:**
1. You'll receive a notification email
2. Return to this step and click **Check Status** to refresh
3. Status changes to **Counterparty Signed**
4. Click **Countersign** to add GateGuard's signature — this completes the NDA
5. Status becomes **Fully Executed** and Step 4 unlocks

> **Tip:** You can skip NDA signing for now and come back to it from the dealer's detail page under the Compliance tab. However, Step 4 (Relationships) will not unlock until both parties have signed.

### Step 4 — Org Relationships

Map this dealer to their parent organization:

- **Master Agent** — The Master Agent who recruited this dealer (earns $0.50/unit/month)
- **MSO** — The Master System Operator this dealer operates under
- **Full Dealership** — For Service Dealers, Install Contractors, and Sales Partners only — their direct parent dealer

Use the search box to find and select each organization. All fields are optional — you can assign relationships later from the dealer's detail page.

Click **Next →**

### Step 5 — Commission Configuration

*(Only shown for Full Dealer, Service Dealer, MSO, and Master Agent tiers)*

Set the revenue split for this dealer:

- **Hardware Discount %** — How much below list price they buy hardware (e.g., 40%)
- **Software MRR %** — Their share of monthly recurring revenue (e.g., 30%)
- **Notes** — Any special commission terms

These numbers are automatically filled into Exhibit A of the Dealer Agreement.

Click **Next →**

### Step 6 — Authorized Dealer Agreement

This step sends the tier-appropriate agreement for signature. The process is identical to Step 3:

1. Check or adjust the **Effective Date**
2. Click **Preview & Edit** to review the full agreement text (includes Exhibit A with your commission settings from Step 5)
3. Edit any terms if needed
4. Click **Send for Signature**
5. After the dealer signs, click **Countersign** to fully execute

Click **Next →** once the agreement is fully executed (or skip to complete later).

### Step 7 — Users

Set up the dealer's first portal account:

1. **First Name** and **Last Name** of the primary admin
2. **Email Address** — A portal invite will be sent to this address when you launch in Step 9
3. **Portal Role** — Typically `admin` for the owner or `dealer` for a standard user
4. Optional: Add technicians by clicking **+ Add Technician** and filling in their info

Click **Next →**

### Step 8 — Compliance Docs

Upload or mark the status of required compliance documents:

- **Certificate of Insurance (COI)** — Upload the PDF or set status to Pending/On File
- **W-9** — Same
- **Contractor License** — Same; add expiration date if applicable
- **Background Check Acknowledgment** — Checkbox confirming you have completed background screening

All of these can be updated later from the dealer's Compliance tab.

Click **Next →**

### Step 9 — Review & Launch

A full summary of everything you've entered. Review carefully:

- Org name, tier, and contact details
- Assigned relationships
- Commission rates
- Admin user email
- Document sending status

When everything looks correct, click **🚀 Launch Dealer**. This:
1. Activates the draft org record
2. Sends the Clerk portal invite to the admin user's email
3. Fires any pending document emails

> **The dealer will receive their portal invite email within a few minutes.** They click the link, set a password, and they're in.

---

## 4. Dealer Detail & Compliance

**Route:** `/admin/dealers/[id]`

Click any dealer in the Dealers list to open their detail page. The page is organized into tabs.

### Overview Tab

Shows the dealer's core information:
- Legal name, entity type, tier
- Contact info
- Service area states
- Active sites count, open work orders, technician count

### Compliance Tab

The Compliance tab manages the full document lifecycle for this dealer.

**Document cards** show the current status of each required document:

| Status | What it means |
|--------|--------------|
| **Not Sent** | No signing link has been sent yet |
| **Pending** | Link sent — waiting for the dealer to sign |
| **Counterparty Signed** | Dealer has signed — your countersignature is needed |
| **Fully Executed** | Both parties have signed — document is complete |

**Actions available:**

- **Send for Signature** — Generates a new signing link and emails it to the dealer
- **Resend** — If the dealer lost their link, click Resend to send a new one
- **Countersign** — Appears when the dealer has signed. Click to add GateGuard's signature. This immediately marks the document as Fully Executed.
- **Manual Upload** — Upload a pre-signed PDF (for paper agreements)

### Features Tab

Control which portal features this specific dealer organization can access. See [Section 5](#5-feature-settings) for how the feature system works.

**Reading the Features tab:**
- Each feature row shows the feature name, the **Tier Default** access level (inherited from Feature Settings), and the **Override** selector
- Set the override to None / View / Edit to customize access for this org
- Toggle **Promo** to grant temporary access to a paid feature for free
- Set an **Expiry Date** if the access is time-limited (e.g., a 30-day trial)
- Click **Save Changes** when done

---

## 5. Feature Settings

**Route:** `/admin/settings/features`
**Who can access:** GateGuard Corporate admins only

Feature Settings is the global control panel for what each dealer tier can see across the portal. Every portal feature — every page in the sidebar — is listed here with access controls per tier.

### How the Feature System Works

Access is controlled at three levels, in order of priority:

```
1. Global Tier Default  (Feature Settings page — you set this)
       ↓
2. Per-Org Override     (Dealer Detail → Features tab)
       ↓
3. Per-User Override    (Platform Users → Feature Access tab)
```

A user can never have MORE access than their org, and an org can never have MORE access than the global tier default.

**Access levels:**

| Level | What the user sees |
|-------|-------------------|
| **None** | Feature is completely hidden from sidebar — doesn't exist to them |
| **View** | Feature is visible and readable — no create/edit/delete |
| **Edit** | Full access — create, edit, delete |

### Reading the Feature Settings Page

Features are grouped into sections (Sales & Marketing, Field & Tech, AI Agents, etc.). Each section is collapsible — click the header to expand or collapse it.

**Columns:**
- **Feature** — Feature name and description
- **MA / MSO / FD / SD / IC / SP** — Access level for each org tier (Master Agent, MSO, Full Dealer, Service Dealer, Install Contractor, Sales Partner)

The colored dropdowns show the current access level:
- **Grey (None)** — Hidden from this tier
- **Amber (View)** — Read-only for this tier
**Green (Edit)** — Full access for this tier

### How to Change a Tier's Access to a Feature

1. Navigate to **Dealer Network → Feature Settings** in the sidebar (or use the **Features** quick link in the Access Control strip)
2. Find the feature you want to change (use browser Ctrl+F to search)
3. Click the dropdown in the tier column you want to change
4. Select **None**, **View**, or **Edit**
5. A small amber dot appears next to the feature name — indicating unsaved changes
6. When you're done making changes, click **Save (X)** in the top-right corner
7. All changes save together in one action

### Extended Settings (Stripe / Paid / Beta)

Each feature has a gear icon (⚙) on the right. Click it to expand:
- **Stripe ID** — Enter a `prod_...` Stripe product ID to gate this feature behind a subscription
- **Paid** — Toggle on to mark this feature as a paid add-on
- **Beta** — Toggle on to show a "Beta" badge next to the feature name

### Sections That Can Be Collapsed

Click any section header to collapse it — useful when you're focused on one area.

---

## 6. Platform Users

**Route:** `/admin/users`
**Who can access:** Corporate, Master Agent, MSO, and Full Dealer admins

### 6.1 Viewing Users

The user list shows all portal users in your organization and any orgs you manage. Each row shows:
- Name and email
- Org tier and role
- Last sign-in date
- Status (Active / Pending invite)

> **Note:** You will only see users at your org tier or below. You cannot view users from orgs above you in the hierarchy.

### 6.2 Inviting a New User

1. Click **+ Invite User** in the top-right corner
2. Enter the user's email address
3. Select their **Portal Role** (Admin, Supervisor, Agent, or Dealer)
4. Click **Send Invite**

The user receives an email with a link to set their password and access the portal.

### 6.3 Managing a User's Access

Click any user in the list to open their detail panel on the right side. Two tabs appear:

**Role & Modules tab:**
- Change the user's portal role (Admin / Supervisor / Agent / Dealer)
- Assign them to a specific organization

**Feature Access tab:**
- View every portal feature and the user's current access level
- The **Org Cap** column shows the maximum access allowed by their org's settings — you cannot grant higher than this
- Click any row's dropdown to override access for this specific user
- Greyed-out options are above the org cap — they cannot be selected
- Click **Save Feature Access** when done

---

## 7. CRM

**Route:** `/crm`

The CRM is your sales pipeline and lead management hub.

### 7.1 Dashboard Overview

**Four KPI cards** at the top:
- Total Pipeline value (all open opportunities)
- Open Opportunities count
- Closed Won this month
- Inbound Leads total

Each card has a sparkline chart and a quarter-over-quarter delta badge.

**My Pipeline funnel** — horizontal bars showing the dollar value at each stage (Meet & Present → Survey Request → Propose → Negotiate). Click any stage bar to filter the table below to that stage only.

### 7.2 Working with Opportunities

**To create a new opportunity:**
1. Click **+ New Opportunity** in the top right
2. Enter the property name and contact info
3. Set the estimated deal amount and close date
4. Select the stage
5. Click **Save**

**To update an opportunity:**
1. Click the opportunity name in the table
2. The detail page opens with all fields editable
3. Update the stage, amount, notes, or contact
4. Log a call, email, or meeting using the activity buttons

**AI Deal Score** — Each opportunity shows a score from 0–99 in a colored badge. This is automatically calculated based on deal stage and activity. Green (70+) = high confidence. Amber (50–69) = needs attention. Red (below 50) = at risk.

### 7.3 Working with Leads

**Route:** `/crm/leads`

Inbound leads appear here in real time. Each lead shows:
- Contact name and property
- Lead source (conference, website, referral, etc.)
- Assignment status

**To assign a lead:**
1. Click **+ Assign** on any unassigned lead
2. Type the dealer name or search for them
3. Click **Assign** — the lead is now in that dealer's queue

**Hover actions on each lead row:**
- **Mail** — Opens a draft email to the contact
- **Phone** — Shows the phone number
- **Calendar** — Opens the scheduling flow

---

## 8. ARIA — AI Lead Intelligence

**Route:** `/aria`

ARIA researches multifamily properties and builds detailed intelligence profiles — decision maker contacts, tech stack, budget signals, and a recommended pitch strategy.

### 8.1 Running a Search

1. Type a property name, address, or management company in the search box on the left panel
2. Choose your research depth:
   - **Base** — Fast (20–30 seconds). Good for initial screening.
   - **Deep** — Slower (35–55 seconds). Adds contact enrichment, behavioral profiles, and pitch strategy.
3. Click **Launch ARIA**
4. Watch the 5-phase animation as ARIA works (Property Intel → Decision Maker → Intent Signals → AI Profiling → Synthesis)
5. Results appear in the list on the left — click any property to open its detail

### 8.2 Reading a Property Profile

The detail view has four tabs:

**Property tab:**
- Unit count, class, year built, occupancy
- Current owner (REIT, PE fund, management company)
- ISP providers, existing tech stack (gate systems, access control, cameras)
- CapEx signals — any renovation, sale, or refinancing activity detected

**Decision Maker tab:**
- Primary contact name, title, email format, LinkedIn
- Full hierarchy: Owner → Asset Manager → Regional VP → Property Manager
- Conversation hooks from their recent LinkedIn activity

**Intel tab:**
- ARIA buy score (0–10) with urgency badge
- Intent signals with source labels (resident complaints, property listings, financial filings)
- Current vendor and contract window

**SCOUT tab:**
- Recommended outreach angle
- Key talking points
- **Import to Leads** — Adds this property to your CRM leads list
- **Launch SCOUT Campaign** — Sends automated SCOUT outreach emails

### 8.3 Deep Mode Additional Output

When you run a Deep search, the Intel tab also shows:
- **Behavioral profile** — How this decision maker thinks and communicates (analytical, driver, expressive, or amiable style)
- **Pitch strategy** — Specific opening hook for this property, topics to avoid, best time to call
- **Freshness score** — How actionable is this intel right now (1–5, where 5 = contract expiring within 90 days)

### 8.4 Saved Searches

ARIA saves every search automatically for 30 days. When you open ARIA without searching, recent searches appear in the left panel. Click any saved search to restore the full results instantly.

---

## 9. Quotes & Proposals

**Route:** `/quotes`

### 9.1 Quotes Dashboard

The Quotes list page shows your full pipeline at a glance:

- **Three KPI sparklines** at the top: Active MRR, Pipeline MRR, Dealer Override MRR
- **Pipeline funnel** — horizontal bars per stage (Draft → Sent → Viewed → Accepted); click a stage to filter the table
- **Quotes table** on the left with filter tabs (All / Draft / Sent / Viewed / Accepted / Declined)
- **Deal Velocity panel** on the right — conversion funnel, avg. time to close, win rate

### 9.2 Creating a New Quote

1. Click **+ New Quote** in the top right corner
2. The **Scenario Gallery** opens — six pre-built starting templates:

| Scenario | Best For |
|----------|----------|
| Multi-Family Smart Core | MDU with smart locks, app, and network |
| Premium Gate & Access | Vehicular barrier, call box, cameras, monitoring |
| Custom Package Management | Luxor lockers and cloud sync |
| Comprehensive Security | Brivo access control, cameras, full monitoring |
| Device-Only Hardware | One-time hardware sale, no MRR |
| AI Voice Import (Beta) | Upload a site-walk recording, AI drafts the BOM |

3. Click a scenario card — the builder opens with pre-loaded line items
4. Or scroll down and click **Survey Wizard** to build from a step-by-step property survey
5. Or click **Import Site Survey** to pull a BOM from an existing survey

### 9.3 Building a Quote

Inside the quote builder (`/quotes/[id]`):

**Line items table:**
- Add items by clicking **+ Add Line Item**
- Set quantity, unit price, and whether each item is one-time or recurring
- Optional items can be flagged — they appear as toggles on the client-facing proposal

**Dependency warnings (amber banner):**
If a line item requires another item to work, a warning appears. Example: "Luxor Cloud Sync requires Network Backhaul Install." Resolve these before sending.

**Internal Financial Summary (right sidebar):**
- Shows blended margin % as a color-coded donut ring
- Green = 40%+ margin · Amber = 25–39% · Red = below 25%
- If margin drops below 25%, the Send button locks and changes to "Request VP Approval"

**View Mode toggle (top bar):**
Switch between **Internal View** (full cost and margin data) and **Proposal View** (opens the client-facing branded proposal in a new tab — no internal costs visible).

### 9.4 Sending a Quote to a Client

1. Open the quote and confirm the margin is green (auto-approved)
2. Click **Send to Client** — this changes the status to Sent and opens the proposal link
3. Copy the proposal link and share it with the client, OR the system can email it directly
4. When the client opens it, status changes to Viewed
5. When the client signs, status changes to Accepted

### 9.5 Client-Facing Pages

These pages require no login — share the links directly with clients:

| Page | What the client sees |
|------|---------------------|
| `/quotes/[id]/proposal` | Branded proposal — scope, optional add-ons with live total, investment summary |
| `/quotes/[id]/approve` | Approval and e-signature page |

---

## 10. Sites & Properties

**Route:** `/sites`

Sites are installed or prospective properties in your portfolio.

### 10.1 Viewing Sites

Each site card in the list shows:
- Property name and address
- Assigned dealers (install, service)
- Number of active work orders
- System health status

Click any site to open its detail page.

### 10.2 Site Detail Page

The detail page is organized into tabs:

- **Overview** — Address, map pin, assigned dealers, equipment summary
- **Equipment** — Full inventory of installed devices
- **Work Orders** — All service history for this property
- **Invoices** — Billing history
- **Permits** — Compliance and permit tracking

---

## 11. Dispatch & Work Orders

**Route:** `/dispatch`

The Dispatcher is field operations command center.

### 11.1 Creating a Work Order

1. Click **+ New Job** in the top right corner
2. Select the property (site)
3. Assign a technician
4. Set job type (installation, service call, inspection, etc.)
5. Set priority and ETA
6. Click **Create**

The technician receives a notification.

### 11.2 Tracking Work Orders

**List view** — All work orders in a table. Each row shows priority (colored stripe), property, assigned tech, ETA, and status badge.

**Board view** — Kanban columns: Open / Active / Done. Click the toggle in the panel header to switch. Your preference is saved automatically.

**Filter pills:** All · Urgent · Today · Unassigned — click to scope the view.

### 11.3 Schedule Timeline

Click the **Schedule** tab (or panel on desktop) to see each technician's day as a horizontal timeline. Each block is a job, color-coded by type. Click any block to open the job detail.

### 11.4 Managing Your Tech Roster

The Tech Roster panel shows all technicians with their current status and recent performance.

**Top 3 leaderboard** — Sorted by streak score, showing gold/silver/bronze ranked techs with their completion counts.

**Tech cards** — Each technician has a card showing:
- Current status (Available / On Site / Driving / Offline)
- Current assigned job
- Portal account status

### 11.5 Generating Tech Access Codes

Each technician needs a unique code to use the `/tech` field tool. Here's how to set one up:

1. Find the technician's card in the Tech Roster
2. In the **/tech Access Code** row, click **Generate →**
3. A code in `GG-{INITIALS}-{4digits}` format is created (e.g., `GG-JT-4821`)
4. Click the **copy icon** to copy it to your clipboard
5. Text or message the code to the technician — they enter it on the `/tech` login screen

To replace a lost or compromised code:
1. Click **Regen** on the tech's card
2. A new code is generated immediately — the old one stops working

> **Note:** Migration 093 must be run on Supabase before this feature works.

### 11.6 Mobile Layout

On a phone or tablet, the dispatcher shows three tabs at the bottom:
- **Jobs** — Work orders list
- **Schedule** — Timeline view
- **Roster** — Tech leaderboard and cards

---

## 12. Field Tech Tool

**Route:** `/tech`
**Access:** No portal login required — use your tech access code

The Tech Tool is a mobile-optimized diagnostic and reference tool for technicians in the field.

### 12.1 Logging In

1. Go to **portal.gateguard.co/tech** on any phone or tablet
2. Enter your tech access code (e.g., `GG-JT-4821`) — your dispatcher provides this
3. You're in — no email or password needed

### 12.2 What the Tech Tool Includes

**Device Selector** — Choose the gate controller, access control panel, or device you're working on from a list of 27 supported devices.

**Wiring Diagram** — Visual diagram showing every terminal connection for that device. Terminals are labeled and color-coded. Pull up the diagram before running wire to avoid mistakes.

**Cable Guide** — Reference for CAT cable, 2-wire series, and 2-wire parallel cable runs. Shows correct gauge, max distance, and termination instructions.

**AI Diagnostic** — Describe the problem in plain English (e.g., "Gate opens but won't close" or "Keypad shows ERR-3 after power cycle"). The AI searches the knowledge base and returns step-by-step troubleshooting instructions.

**Site Survey** — Capture device inventory for a new installation:
1. Select the site (or create a new one)
2. Add each device you're installing
3. Add notes
4. The portal generates an AI Scope of Work and Bill of Materials from your survey
5. The survey can be converted into a quote directly

**Resolution Log** — After fixing an issue, log what solved it. This feeds into the AI's knowledge base for future diagnostics.

---

## 13. Site Surveys

**Route:** `/survey`

Site surveys are pre-installation assessments, typically done during a sales visit or before quoting.

### 13.1 Starting a Survey

1. Click **+ New Survey**
2. Select or search for the property
3. Choose the survey type (New Install / Upgrade / Assessment)
4. Walk through the sections, adding the devices and conditions you observe:
   - Gate types and counts
   - Camera locations
   - Access control panels
   - Network infrastructure
   - Special conditions or notes

### 13.2 Generating the SOW and BOM

After completing the survey:
1. Click **Generate AI Documents**
2. Claude AI processes your device list and notes
3. Within 15–30 seconds you get:
   - **Scope of Work (SOW)** — Professional write-up of the full project scope
   - **Bill of Materials (BOM)** — Itemized equipment list with quantities

### 13.3 Creating a Quote from a Survey

1. Review the SOW and BOM
2. Click **Create Quote**
3. The quote builder opens with all items pre-loaded
4. Adjust pricing and add any additional line items
5. Send to the client

---

## 14. AI Agents

NEXUS includes 8 named AI agents, each built for a specific function. The AI Army panel in the sidebar shows all 8 with a green (live) or grey (coming soon) dot.

| Agent | What it does | Status |
|-------|-------------|--------|
| **ARIA** | Lead intelligence — researches properties, finds decision makers, builds SCOUT outreach packets | Live |
| **TRINITY** | Voice AI — handles inbound and outbound calls for lead qualification | Live |
| **SCOUT** | Market intelligence — automated territory and competitive sweeps | Live |
| **BEACON** | Client communications — AI-drafted follow-ups, proposals, and touchpoints | Coming soon |
| **FORGE** | Quote builder AI — scenario templates, dependency checking, margin engine | Live |
| **ATLAS** | DirecTV for Business — quoting and provisioning automation | Live |
| **SAGE** | Training coach — adaptive learning and certification prep | Coming soon |
| **RELAY** | Tier-1 support — handles routine dealer and tech queries | Coming soon |

> **Access to each agent is controlled by Feature Settings.** If you don't see an agent in the sidebar, your org tier may not have access to it. Contact your GateGuard admin.

---

## 15. Billing & Invoices

**Route:** `/billing`

### 15.1 Viewing Invoices

The billing page shows all invoices across your dealer network. Filter by:
- Status (Draft / Sent / Paid / Overdue)
- Dealer
- Date range

Click any invoice to open the detail view.

### 15.2 Creating an Invoice

1. Click **+ New Invoice**
2. Select the property or dealer this invoice is for
3. Add line items (hardware, labor, MRR, services)
4. Set the due date
5. Click **Send Invoice** — this generates a Stripe payment link and emails it to the client

### 15.3 Marking as Paid

When a client pays:
- If they paid online via the Stripe link → status updates automatically
- If they paid by check or ACH → click **Mark as Paid** on the invoice and enter the payment date

---

## 16. Map View

**Route:** `/map`

An interactive Mapbox map showing all your installed and prospective properties as pins.

**Reading the map:**
- **Blue pins** — Active installed sites
- **Green pins** — Sites with no open issues
- **Red pins** — Sites with active alerts or overdue work orders

**Click any pin** to open a summary card with the property name, assigned dealers, and quick links to the site detail and active work orders.

The Map is also used in the Dispatcher view and the SOC split-screen.

> **Requires:** `NEXT_PUBLIC_MAPBOX_TOKEN` environment variable — contact your GateGuard admin if the map doesn't load.

---

## 17. Training & Scorecards

**Training route:** `/training`
**Scorecard route:** `/scorecard`

### 17.1 Training

The Training section provides dealer-facing learning modules:
- Platform training (how to use NEXUS)
- Product training (gate systems, access control, cameras)
- Sales training (demos, objection handling, closing)

Progress is tracked per user. Completions are recognized in the EOS Team Performance panel on the Dashboard.

### 17.2 Scorecard

The Scorecard shows weekly EOS metrics for your dealer network:

| Metric | What it tracks |
|--------|---------------|
| New Opportunities | Opps created this week vs. goal |
| Proposals Sent | Quotes sent to clients vs. goal |
| Active Dealers | Dealers with portal activity vs. goal |
| Installed Properties | New sites activated vs. goal |
| Portal Uptime | System health percentage |

Each metric shows a green ✓ or red ✗ vs. its goal, consistent with EOS Scorecard format. Reviewed weekly at L10.

---

## 18. Installing NEXUS on Your Phone

NEXUS is a Progressive Web App (PWA) — you can install it on your home screen like a native app. No app store required.

### Installing on iPhone

1. Open **portal.gateguard.co** in **Safari** (must be Safari, not Chrome)
2. Tap the **Share** button — the box with an upward arrow at the bottom of the screen
3. Scroll down in the share sheet and tap **Add to Home Screen**
4. The name will pre-fill as "Nexus" — tap **Add** in the top right
5. The GateGuard shield icon appears on your home screen

Tap the icon to open NEXUS in full-screen mode — no browser address bar, no tabs.

### Installing on Android

1. Open **portal.gateguard.co** in **Chrome**
2. Tap the **⋮ menu** (three dots) in the top right corner
3. Tap **Add to Home Screen**
4. Tap **Add** to confirm
5. The icon appears on your home screen

Chrome may also show an automatic install banner at the bottom of the screen — tap it if you see it.

### Mobile-Specific Layout

On a phone or tablet, the portal adapts automatically:
- The sidebar collapses — tap the menu icon to open it
- KPI cards show a compact one-metric format
- Tables hide less-critical columns (dates, hover actions)
- Dispatcher, ARIA, and other multi-panel pages use bottom tab navigation

---

## 19. Support & Troubleshooting

### Common Issues

**"This page shows a 404 error"**
The feature may not be deployed yet or your account may not have access. Check with your admin.

**"I can't see a feature I should have access to"**
Feature visibility is controlled by your org tier. Ask your GateGuard admin to check Feature Settings or your org's Features tab.

**"The map isn't loading"**
The Mapbox token may not be configured. Contact rfeldman@gateguard.co.

**"I'm not receiving portal invite or signing emails"**
Check your spam folder. Email is sent via Resend from `documents@mail.gateguard.co`. If it's not there, ask your admin to resend.

**"The tech tool is rejecting my access code"**
Your code may have been regenerated. Ask your dispatcher to copy your current code from the Tech Roster and send it to you again.

**"My session keeps expiring"**
Click your avatar in the bottom-left corner of the sidebar and select **Refresh Session**.

### Signing Document Issues

**"The dealer hasn't received their signing email"**
1. Go to the dealer's Compliance tab
2. Find the document with Pending status
3. Click **Resend** to generate a new link and email

**"The dealer signed but the portal still shows Pending"**
1. Go to Step 3 (NDA) or Step 6 (Agreement) in the dealer's onboarding, or open the Compliance tab
2. Click **Check Status** to refresh from the database
3. If the dealer has signed, status will update to Counterparty Signed

### Contact

**Internal:** rfeldman@gateguard.co
**Portal:** portal.gateguard.co
**SOC (separate app):** ggsoc.com

---

## Appendix: Document Types & Tier Mapping

Every dealer receives two documents at onboarding:
1. **Mutual Non-Disclosure Agreement (NDA)** — all tiers
2. **A tier-specific agreement** — see table below

| Dealer Tier | Agreement Sent |
|-------------|---------------|
| Full Dealer | Authorized Dealer & Reseller Agreement |
| MSO | Authorized Dealer & Reseller Agreement |
| Master Agent | Master Agent Agreement |
| Service Dealer | Service Dealer Agreement |
| Install Contractor | Installation Partner Agreement |
| Sales Partner | Sales Partner Agreement |

Both documents are editable before sending. The effective date defaults to today but can be changed. After the dealer signs, a GateGuard countersignature is required to make the document fully executed.

---

## Appendix: Org Tier Hierarchy

```
GateGuard Corporate
    └── Master Agent
            └── MSO (Master System Operator)
                    └── Full Dealer
                            ├── Service Dealer
                            ├── Install Contractor
                            └── Sales Partner
```

Each tier can only see orgs and users at their own level or below. Data flows down — not up.

---

*NEXUS User Manual · GateGuard, LLC · 980 Hammond Drive, Suite 200, Atlanta, GA 30328*
*For internal and dealer use only · Last updated May 27, 2026*
