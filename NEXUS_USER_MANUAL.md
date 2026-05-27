# NEXUS — GateGuard Dealer Portal User Manual
### Version 12 · Updated May 27, 2026

> **NEXUS** is the GateGuard internal name for the Dealer Portal at [portal.gateguard.co](https://portal.gateguard.co). It is the command center for dealer ops: onboarding, quoting, field service, billing, compliance, AI diagnostics, and more.

---

## Table of Contents

1. [Roles & Access](#1-roles--access)
2. [Navigation](#2-navigation)
2a. [Nexus Dashboard (Home)](#2a-nexus-dashboard-home)
2b. [CRM Dashboard](#2b-crm-dashboard)
3. [Admin — Dealer Onboarding](#3-admin--dealer-onboarding)
4. [Admin — Dealer Detail & Compliance](#4-admin--dealer-detail--compliance)
5. [Quotes](#5-quotes)
6. [Sites](#6-sites)
7. [Work Orders](#7-work-orders)
8. [Field Tech Tool (/tech)](#8-field-tech-tool-tech)
9. [Site Surveys](#9-site-surveys)
10. [Billing & Invoices](#10-billing--invoices)
11. [NEXUS AI Assistant](#11-nexus-ai-assistant)
12. [Map View](#12-map-view)
13. [Training & Scorecards](#13-training--scorecards)
14. [TRINITY Voice AI](#14-trinity-voice-ai)
15. [Service Marketplace](#15-service-marketplace)
16. [Settings & Permissions](#16-settings--permissions)

---

## 1. Roles & Access

NEXUS uses **Clerk** for authentication with four portal roles:

| Role | What they can do |
|------|-----------------|
| `admin` | Full access — onboard dealers, countersign docs, manage all orgs/sites/quotes |
| `supervisor` | Manage dealers and sites in their territory; no global admin controls |
| `agent` | Read/write access to quotes, work orders, surveys — no dealer management |
| `dealer` | Access to their own org's sites, quotes, work orders, invoices |

The `/tech` field tool uses a separate `x-tech-code` header (no Clerk login required) — intended for technicians in the field who scan a QR code.

---

## 2. Navigation

The left sidebar is NEXUS's primary navigation. Sections are grouped by function:

| Section | Route | Who sees it |
|---------|-------|------------|
| Dashboard | `/` | All roles |
| Dealers | `/admin/dealers` | admin, supervisor |
| Sites | `/sites` | All roles |
| Quotes | `/quotes` | All roles |
| Work Orders | `/work-orders` | All roles |
| Surveys | `/survey` | All roles |
| Map | `/map` | All roles |
| Billing | `/billing` | admin, supervisor |
| Training | `/training` | All roles |
| Scorecard | `/scorecard` | All roles |
| TRINITY | `/trinity` | admin, supervisor |
| Service Marketplace | `/services` | All roles |
| Settings | `/settings` | All roles |
| Field Tech Tool | `/tech` | No Clerk — tech code only |
| NEXUS AI | Floating button (all pages) | All roles |

---

## 2a. Nexus Dashboard (Home)

**Route:** `/`

The **Tactical Hub Dashboard** is the portal's command center — a single-screen operational overview designed to surface the numbers that matter, your EOS pulse, and team momentum without navigating away.

### Header
The top bar shows **"Nexus Dashboard"** with the GateGuard subtitle. An **AI Search bar** (same engine as the rest of the portal) sits inline next to a **"+ Post Update"** button for quick team communications.

### 4 KPI Cards

| Card | Primary Metric | Secondary (desktop) | Source |
|------|---------------|---------------------|--------|
| **Revenue & Pipeline** | Monthly MRR ($94.2k) | Open quote pipeline | DEMO / Live when quotes table connected |
| **Ops Health** | Cameras online (115/138) | Doors/Gates status + open WOs | DEMO / Live WOs |
| **Account Growth** | Active accounts | DTV Activations | Live (Supabase org count) |
| **Critical Alerts** | Alert count | Link to /alerts | DEMO |

On mobile, each card shows only the primary metric + a one-line sub. Secondary metrics and dividers are hidden (`hidden lg:flex`) — no overflow or wrapping.

### EOS + Team Performance (3 cards)

**Q2 2026 Rocks** — All six quarterly Rocks with color-coded status badges (On Track / At Risk / Off Track). Count badge shows X/6 on track. Links to `/eos`. Next L10 meeting time shown at bottom.

**Team Performance** — Russel F.'s XP progress bar (current XP / next level threshold), 12-day streak, level badge. June Leaderboard shows top 3 (RF / Nicole G. / Jake T.) with XP counts.

**Active Challenges + Scorecard Pulse** — Three active challenges with progress bars and XP reward callouts. Below a divider, the Scorecard Pulse shows each weekly metric (New Opps, Proposals Sent, Active Dealers, Installed Props, Portal Uptime) with a green/red dot vs. goal.

On mobile all three cards stack single-column — full width, easy to scroll.

### All Accounts Table
Shows up to 12 most recent accounts (live from Supabase when connected, static fallback if not). Columns:
- Account name (with green status dot)
- Tier pill (color-coded: Client / MSO / Sales Partner / etc.)
- Added date *(desktop only — `hidden lg:table-cell`)*
- Row actions: **"+ Add to L10"** button + Eye + Settings *(desktop only — appear on hover)*

On mobile: Account + Tier only. Taps navigate to the customer detail page.

### System & Alerts Operations Panel
Stacks three mini-cards in the right column:

1. **Alerts** — last 4 alert events with type dot (red/amber/green) and time ago
2. **Quick Actions** — 2×2 grid: New Quote · Work Order · Add Account · View SOC
3. **Platform Status** — EagleEye API, Brivo API, DirecTV ATLAS, Supabase, Vercel Edge — all with operational status dot

On mobile this panel stacks below the Accounts table, full width.

---

## 2b. CRM Dashboard

**Route:** `/crm` · Opportunities: `/crm/opportunities` · Leads: `/crm/leads`

The CRM is the Sales & Marketing hub — pipeline management, inbound leads, activity tracking, and AI-assisted deal intelligence in one view.

### Global Filter Bar
A sticky bar beneath the top navigation exposes three filters: **Date Range**, **Region**, and **Rep**. These scope the view without navigating away. A "Clear" link appears when any filter is active.

### KPI Cards
Four summary cards across the top of the dashboard:

| Card | What it shows |
|------|--------------|
| Total Pipeline | Sum of all open opportunity amounts · bar sparkline · quarter-over-quarter delta |
| Open Opportunities | Count of active (non-won/lost) opps · bar sparkline · QoQ delta |
| Closed Won (Month) | Revenue closed this calendar month vs. target · bar sparkline |
| Inbound Leads | Total lead count · line sparkline · QoQ delta |

Each card links to the relevant filtered view.

### My Pipeline — Funnel with Proportional Bars
Each active stage (Meet & Present → Survey Request → Propose → Negotiate) is displayed as a row with a horizontal bar sized proportionally to that stage's total dollar value. Clicking any row navigates to `/crm/opportunities?stage=<stage>`. The total open pipeline is shown at the bottom.

**Pipeline Forecast & Goal Tracking chart** sits below the funnel. A stacked area chart shows projected pipeline by rep/region/source over time vs. a dashed target line. Color-coded legend: Rep (`#6B7EFF`), Rep2 (violet), Survey Region (amber), Walk in on site (slate).

### Today's Activity
Upcoming and overdue activities (calls, emails, meetings, tasks) due within 24 hours. Each row shows:
- **Type icon** (phone/email/meeting/task) in a color-coded rounded square
- Subject and associated opportunity name
- Scheduled time
- **Hover quick-actions:** Reply (↩), Take Note (📋), Mark Complete (☑) — appear on row hover

Click "+ Log" to log a new activity (call, email, meeting, task, or note).

### Open Opportunities Table
Sortable table showing the top 10 open opportunities, ordered by **most recent activity** (`updated_at`, falling back to `created_at`). Columns: Name / Account, Stage (colored pill), Amount, Close Date, AI Deal Score.

**AI Deal Score** — a deterministic score (0–99) computed client-side from each opportunity's ID hash and pipeline stage. Color-coded badge: green (≥70 = high confidence), amber (50–69 = moderate), red (<50 = needs attention). No API call required. Helps reps instantly prioritize where to focus.

Links to `/crm/opportunities/[id]` for each row.

### My Leads
Live feed of inbound leads (pulsing `#6B7EFF` dot indicates real-time). Shows contact name, property/company, email, lead source tag, and assignment status.

**Assignment logic:**
- If `assigned_dealer` is set → shows the dealer name in an emerald badge
- If unassigned and user has assign permission → shows `+ Assign` button with inline dealer input
- If unassigned and user cannot assign → shows "New" amber badge

**Hover quick-actions:** Mail, Phone, Calendar buttons appear on each lead row. Clicking any of these does not navigate away from the page.

"View all →" links to `/crm/leads`.

---

## 3. Admin — Dealer Onboarding

**Route:** `/admin/dealers/new`

The Dealer Onboarding Wizard creates a new dealer organization and admin user in one flow. It has **7 steps**:

### Step 1 — Organization Info
- Organization name (legal entity name — used in contracts)
- Primary phone, primary email, physical address
- License number (low-voltage or contracting)
- Entity type (LLC, corporation, S corp, partnership, sole proprietorship, limited partnership)

### Step 2 — Dealer Tier
Select the dealer's operational role in the Gate Guard network:

| Tier | Role |
|------|------|
| **Full Dealer** | Sell, install, and service. Sets commission templates. Full margin splits. |
| **Service Dealer** | Primary ongoing service contact for assigned properties. Day-to-day work orders. |
| **Installing Contractor** | Installation and commissioning only. Paid from one-time setup fees only. |
| **Sales Partner** | Brings leads, closes sales. Lifetime recurring commission. No install/service. |
| **MSO (Master System Operator)** | Billing entity for a property portfolio. Manages affiliated dealers beneath them. |
| **Master Agent** | Recruits and oversees dealers. Earns per-unit/month override across their network. |

### Step 3 — NDA & Agreement
Preview both documents before sending. Includes:
- **Mutual Non-Disclosure Agreement** — 3-year term, Trade Secrets survive in perpetuity, Georgia/Fulton County governing law, ESIGN Act and UETA validity
- **Authorized Dealer & Reseller Agreement** — full agreement + Exhibit A (tier checkboxes, commission percentages, SLA notes)

A toggle lets you enable or disable automatic sending. If enabled, signing links are emailed to the dealer's primary email upon launch.

### Step 4 — Relationships
Assign the new dealer's parent organization (which Master Dealer or MSO they report to, if applicable).

### Step 5 — Commission (tiers with revenue splits only)
Set hardware discount %, software MRR %, and install fee %. Skipped for Sales Partner and Installing Contractor tiers. Values are populated as merge variables into Exhibit A of the Agreement.

### Step 6 — Admin User
Create the first user account for the dealer. Provide name and email — a Clerk invite is sent automatically.

### Step 7 — Review
Full summary before launch. Click **Launch** to:
1. Create the organization in Supabase
2. Create the admin user + send Clerk invite
3. Fire NDA + Agreement signing emails via Resend (if Step 3 enabled)

---

## 4. Admin — Dealer Detail & Compliance

**Route:** `/admin/dealers/[id]`

The dealer detail page has several tabs. The **Compliance** tab is the document lifecycle hub.

### Compliance Tab

Displays a card for each document type relevant to the dealer's tier:
- Mutual NDA
- Tier-appropriate Agreement (Dealer Agreement, Service Agreement, Install Partner Agreement, Sales Partner Agreement, Master Agent Agreement)

Each card shows:
- **Status badge** — Not Sent · Pending · Counterparty Signed · Fully Executed
- **Signer info** — email, name, signed date
- **Sent by** — Gate Guard team member who sent it

**Action buttons (context-aware):**

| Status | Available actions |
|--------|-----------------|
| Not sent (org has email) | "Send for Signature" |
| Not sent (no email) | "Add org email to send" |
| Pending | "Awaiting signature" badge + "Resend" link |
| Counterparty Signed | **"Countersign"** emerald button |
| Fully Executed | "Fully executed" badge |
| Any | "Manual upload" border button |

### Countersigning
When a dealer has signed (status = `counterparty_signed`), the **Countersign** button appears. Clicking it:
1. Records Russel Feldman as countersigner (CEO)
2. Sets `countersigned_at` timestamp
3. Marks `fully_executed: true` on the signature record

### E-Sign Lifecycle (under the hood)
```
onboard-dealer API
  → sendDoc('nda')           — creates document_signatures row + Resend email
  → sendDoc('agreement')     — same for tier-appropriate agreement

Dealer receives email → clicks link → /sign/[token]
  → types full name → clicks "Sign"
  → rfeldman@gateguard.co receives notification email

Admin sees "Counterparty Signed" in Compliance tab
  → clicks "Countersign" → fully_executed = true
```

---

## 5. Quotes & Proposals

**Route:** `/quotes` · New quote: `/quotes/new`

The Quotes & Proposals section uses the standard NEXUS dark top bar (same as Dashboard and CRM) with the "+ New Quote" button in the top-right action area.

### Quotes Dashboard (`/quotes`)

The Quotes list page is an enterprise pipeline view with four main sections:

**KPI Cards (top row)** — three metric cards each with an inline sparkline chart and a delta trend badge:
- **Active MRR** — total monthly recurring from accepted quotes; green bar sparkline
- **Pipeline MRR** — MRR from quotes that are sent or viewed (in-flight); blue line sparkline
- **Dealer Override MRR** — your commission from accepted deals; purple dashed sparkline with green target line

**Quotes Pipeline** — horizontal bar funnel showing Draft → Sent → Viewed → Accepted. Each stage bar is proportionally sized to that stage's MRR. Click any stage row to filter the table to that status only.

**Open Quotes table (left)** — columns: Quote #, Property, Status badge, Setup total, Monthly, Date. Row hover reveals Eye (view), Edit, Copy link, and More actions. Filter tabs above the table (All · Draft · Sent · Viewed · Accepted · Declined) each show a live count badge. Search bar accepts quote number or property name.

**Deal Velocity panel (right)** — 280px fixed panel showing:
- **Quote Conversion funnel** — proportional bars for Created → Sent → Viewed → Accepted with real counts
- **Deal Velocity metrics** — Avg. Time to Sent, Avg. Time to View, Avg. Time to Accept
- **Win Rate** — progress bar: accepted quotes ÷ total, shown as a percentage

### Scenario Gallery — Creating a Quote (`/quotes/new`)

The new quote screen is an intent-driven **Scenario Gallery** — six pre-built starting points that skip the blank canvas entirely. Clicking a card pre-populates the line item builder with a realistic bill of materials for that scenario type.

| Scenario | Best For |
|----------|----------|
| **Multi-Family Smart Core** | MDU smart locks, resident app, network — most common |
| **Premium Gate & Access** | Vehicular barrier, call box, cameras, 24/7 monitoring |
| **Custom Package Mgmt** | Luxor lockers, cloud sync, package room install |
| **Comprehensive Security** | Brivo access control, cameras, alarm, AI monitoring |
| **Device-Only Hardware** | One-time hardware/labor only — no recurring MRR |
| **AI Voice Import (Beta)** | Upload site-walk audio → AI drafts BOM automatically |

After selecting a scenario, the rep lands on the **Line Item Builder** at Step 1 (Client Info) with hardware and services pre-loaded. Items can be added, removed, or repriced before saving.

Two additional entry points are at the bottom of the gallery: **Survey Wizard** (step-by-step site config) and **Import Site Survey** (pulls BOM from a completed field survey — recommended fastest path).

### Advanced Quote Builder (`/quotes/[id]`)

The internal quote editor is a full CPQ (Configure, Price, Quote) workspace with three key engines:

**CPQ Dependency Engine** — If a line item requires another item to function (e.g., Luxor Cloud Sync requires Network Backhaul Install), an amber warning banner appears above the line items table. This prevents reps from selling physically impossible solutions. Dependencies are defined by item SKU.

**Margin Engine & Approval Gateway** — Every quote computes a blended margin estimate in real time (hardware ~47%, MRR services ~75%). The margin is shown as a donut ring in the **Internal Financial Summary** sidebar. If the blended margin drops below 25%, the "Send to Client" button locks and changes to "Request VP Approval" — preventing below-threshold deals from going out without a management review.

**Internal Financial Summary (sidebar)** — Shows:
- Blended margin % as a color-coded donut (green ≥40%, amber ≥25%, red <25%)
- Estimated setup revenue vs. cost
- MRR revenue vs. cost
- Auto-Approved or Approval Required badge

**View Mode Toggle (top bar)** — Switch between Internal View (full cost/margin data visible) and Proposal View (opens the client-facing branded proposal in a new tab — no internal costs shown).

**Top Bar Action Logic:**
- **Auto-Approved** (margin ≥ 25%) → green badge + blue "Send to Client" button active
- **Approval Required** (margin < 25%) → amber badge + amber "Request VP Approval" button (disabled)

**Line Items table** — Grouped by section (Hardware & Labor, MRR, etc.). Optional items are flagged with `is_optional` — they appear as client-selectable toggles on the proposal page.

### Customer-Facing Pages (no auth, no sidebar)

| Route | Purpose |
|-------|---------|
| `/quotes/[id]/proposal` | Branded proposal — client reads scope, toggles optional add-ons, views live investment summary |
| `/quotes/[id]/approve` | Approval + e-signature page — client signs, triggers acceptance flow |

### Quote Status Flow
`draft` → `sent` → `viewed` → `accepted` / `declined` → `expired`

### CPQ Phase 2 (coming tomorrow)
- `unit_cost` column on line items (migration 092) — enables real margin vs. estimated
- Inline margin % editing per line item
- Interactive proposal add-on toggles with live total recalculation
- Full scenario test walkthroughs: 92 W. Paces, gate-only, device-only

---

## 6. Sites

**Route:** `/sites` · Detail: `/sites/[id]`

Sites are installed properties — apartment communities, HOAs, commercial buildings. Each site record tracks:
- Physical address + Mapbox pin
- Assigned dealers: Master Dealer, Install Dealer, Service Dealer
- Installed equipment inventory
- Linked work orders, invoices, permits

Site detail tabs typically include: Overview, Equipment, Work Orders, Invoices, Permits, (upcoming: Service Analytics).

---

## 7. Work Orders

**Route:** `/work-orders`

Field service management:
- Create work orders linked to a site
- Assign to technicians
- Track status: Open → In Progress → Complete
- Technician receives notification
- (Planned) Photo evidence upload per work order
- (Planned) SMS threads via Twilio ↔ WO ID

---

## 8. Field Tech Tool (/tech)

**Route:** `/tech`

A standalone tool for technicians in the field — no Clerk login. Access via `x-tech-code` header or QR code.

Features:
- **Device selector** — choose from 27 supported Gate Guard devices
- **Wiring Diagram** — SVG renderer pulls static wiring maps + Supabase `device_suggestions`; shows terminal-to-terminal connections
- **Cable Guide** — CAT, 2-wire series, and 2-wire parallel cable guides
- **AI Diagnostic** — natural language troubleshooting powered by Claude Haiku; searches KB articles + suggests solutions
- **Site Survey** — capture device inventory per site; generates AI SOW + BOM; can create a quote directly
- **Resolution capture** — techs log what fixed the issue → feeds the learning loop

Access is intentionally design-free (mobile-first, high contrast) for outdoor/field use.

---

## 9. Site Surveys

**Route:** `/survey`

Pre-installation site assessment tool. Techs or sales reps capture:
- Site type and access control context
- Device inventory (gates, cameras, readers, intercoms, etc.)
- Site notes

After capture, one click generates:
- **AI Scope of Work (SOW)** — via Claude Haiku, formatted for the proposal
- **Bill of Materials (BOM)** — itemized equipment list

"Create Quote" converts the survey into a full quote with pre-populated line items.

---

## 10. Billing & Invoices

**Route:** `/billing`

- View all invoices across the dealer network
- Create invoices with line items (QB-style product picker — Task #234 in progress)
- Mark as Paid
- Stripe payment links — customers pay online; status updates automatically
- Commission payouts — tracked per dealer, per activated unit
- (Planned) Monthly client report auto-PDF

---

## 11. NEXUS AI Assistant

**Floating button** — available on all portal pages

NEXUS is the portal's AI command center. Current capabilities:
- **Alerts** — surface outstanding items: unsigned docs, overdue work orders, pending approvals
- **Chat** — natural language questions about portal data
- **Planned (Task #163):** Write and update To-Dos + Work Orders via chat

Powered by Claude Haiku (`claude-haiku-4-5-20251001`).

**ARIA** (Lead Intel), **FORGE** (Quote Builder), **BEACON** (Client Comms), **SAGE** (Training), and **RELAY** (Tier-1 Support) are named AI agents within NEXUS serving specific functions.

---

## 12. Map View

**Route:** `/map`

Mapbox GL JS v3.3.0-powered map showing all active sites as pins. Clicking a pin opens the site detail panel. Used in the dispatch/SOC split-view as well.

Requires: `NEXT_PUBLIC_MAPBOX_TOKEN` env var.

---

## 13. Training & Scorecards

**Routes:** `/training` · `/scorecard`

- **Training** — dealer-facing learning modules; progress tracked in `training_progress` table
- **Scorecard** — EOS-style weekly dealer performance metrics (`dealer_scorecards` table)

Migration 021 must be run before these pages persist data.

---

## 14. TRINITY Voice AI

**Route:** `/trinity`

TRINITY is Gate Guard's inbound/outbound voice AI agent. The `/trinity` page is the call log and management interface. Call records stored in `trinity_calls` table (migration 062).

> **Note:** The voice agent is named TRINITY (not ECHO). This is reflected in Sidebar.tsx.

---

## 15. Service Marketplace

**Route:** `/services`

Dealers can enroll sites in Gate Guard's managed service programs. Uses `service_catalog` and enrollment tables (migration 070).

---

## 16. Settings & Permissions

**Route:** `/settings`

- **User settings** — notification preferences, Google Calendar OAuth (requires migration 053)
- **Team** — manage portal users, assign roles
- **Integrations** — connect external services

---

## Document Templates

Gate Guard maintains active document templates in the `document_templates` Supabase table. Each template has a `document_type` and a PDF URL. The onboarding flow looks up the active PDF for each doc type when sending signing links.

| `document_type` | Document |
|----------------|----------|
| `nda` | Mutual Non-Disclosure Agreement |
| `dealer_agreement` | Authorized Dealer & Reseller Agreement (Full Dealer, MSO, Master Agent) |
| `service_agreement` | Service Dealer Agreement |
| `install_partner_agreement` | Installing Contractor Agreement |
| `sales_partner_agreement` | Sales Partner Agreement |
| `master_agent_agreement` | Master Agent Agreement |

---

## Dealer Tier → Agreement Mapping

| Tier | Agreement sent at onboarding |
|------|------------------------------|
| full_dealer | dealer_agreement |
| master_dealer / MSO | dealer_agreement |
| service_dealer | service_agreement |
| install_contractor | install_partner_agreement |
| sales_partner | sales_partner_agreement |
| master_agent | master_agent_agreement |

All tiers receive the **NDA** in addition to their tier-specific agreement.

---

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk auth (public) |
| `CLERK_SECRET_KEY` | Clerk auth (server) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server API routes) |
| `RESEND_API_KEY` | Transactional email (signing links, notifications) |
| `STRIPE_SECRET_KEY` | Invoice payment links |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe (client) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Map view + site pins + dispatch |
| `TECH_ACCESS_CODE` | /tech field tool door code |
| `ANTHROPIC_API_KEY` | Claude Haiku (KB, diagnostics, surveys, NEXUS) |
| `OPENAI_API_KEY` | text-embedding-3-small (KB PDF embeddings) |
| `TAVILY_API_KEY` | ARIA Deep Intel web search (pending) |

---

## Git & Deployment

```bash
# After every code push:
git push origin main && git push origin main:beta
```

| Branch | Environment | URL |
|--------|-------------|-----|
| `main` | Production | portal.gateguard.co |
| `beta` | Beta | beta.portal.gateguard.co |

Always test on beta first. Never push DB migrations to prod before beta is confirmed.

---

## PWA — Installing NEXUS as a Native App

NEXUS is a Progressive Web App (PWA). On both iOS and Android you can install it to your home screen for a full native-app experience — no app store required.

### Installing on iPhone / iPad
1. Open **portal.gateguard.co** in Safari
2. Tap the **Share** button (box with arrow) in the Safari toolbar
3. Scroll down and tap **"Add to Home Screen"**
4. Name it **"Nexus"** → tap **Add**

The GateGuard shield icon will appear on your home screen. Tapping it opens NEXUS in standalone mode (no Safari chrome, full screen).

### Installing on Android
1. Open **portal.gateguard.co** in Chrome
2. Tap the **⋮** menu → **"Add to Home Screen"** (or Chrome may show an install banner automatically)
3. Tap **Add**

### PWA Details
| Setting | Value |
|---------|-------|
| App name | GateGuard Nexus |
| Short name | Nexus |
| Home screen icon | GateGuard shield logo (192×192 + 512×512) |
| Start URL | `/` (Dashboard) |
| Display mode | Standalone (no browser chrome) |
| Theme color | Dark bar (`#1c1917`) matching the portal top bar |
| Orientation | Any (portrait + landscape) |

### Mobile Layout
The portal is fully responsive. On screens narrower than `lg` (1024px):
- KPI cards show 2-column compact format (primary metric only; secondary metrics hidden)
- EOS + Team + Challenges sections stack single-column
- Accounts table shows Account + Tier only (date and actions hidden)
- CRM rows collapse to single column
- Quotes KPI cards collapse to single column

Desktop layout is completely unchanged.

---

## Support

Internal: rfeldman@gateguard.co  
Portal: portal.gateguard.co  
SOC: ggsoc.com (separate app — do not confuse)
