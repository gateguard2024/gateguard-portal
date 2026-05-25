-- migration 091: seed KB with 40 portal how-to articles
-- These are portal usage guides (not equipment manuals).
-- Safe to re-run: ON CONFLICT (title) DO NOTHING.

INSERT INTO kb_articles (title, description, content, category, tags, difficulty, helpful_count, author)
VALUES

-- ─────────────────────────────────────────────────────────────────────────────
-- GETTING STARTED
-- ─────────────────────────────────────────────────────────────────────────────
(
  'How to log in to GateGuard NEXUS',
  'Step-by-step guide to accessing the dealer portal at portal.gateguard.co',
  E'# How to Log In to GateGuard NEXUS\n\n'
  E'GateGuard NEXUS is the dealer portal hosted at **portal.gateguard.co**. Access requires a Clerk-managed account issued by your GateGuard administrator.\n\n'
  E'## Steps\n\n'
  E'1. Navigate to [https://portal.gateguard.co](https://portal.gateguard.co) in any modern browser.\n'
  E'2. Click **Sign In** or you will be redirected automatically.\n'
  E'3. Enter the email address registered with your dealer account and your password.\n'
  E'4. If your organization uses SSO (Google or Microsoft), click the corresponding provider button.\n'
  E'5. On first login you may be prompted to verify your email address — check your inbox for a verification link.\n\n'
  E'## Troubleshooting\n\n'
  E'- **Forgot password?** Click the *Forgot password* link on the sign-in page to receive a reset email.\n'
  E'- **Account not found?** Contact your GateGuard administrator — your org account may not yet be provisioned.\n'
  E'- **Two-factor authentication:** If your organization enforces MFA, have your authenticator app ready.\n\n'
  E'## Field Technicians\n\n'
  E'Field techs use the **/tech** tool, which requires a PIN (TECH_ACCESS_CODE) instead of a Clerk account. Navigate to `portal.gateguard.co/tech` and enter your PIN. The PIN is provided by your dealer admin.',
  'Getting Started',
  ARRAY['login', 'auth', 'access', 'sign-in'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Navigating the portal — sidebar, TopBar, and NEXUS Assistant',
  'Overview of the main navigation elements in the GateGuard NEXUS portal',
  E'# Navigating GateGuard NEXUS\n\n'
  E'The portal has three primary navigation areas: the **Sidebar**, the **TopBar**, and the **NEXUS Assistant** floating panel.\n\n'
  E'## Sidebar\n\n'
  E'The dark left sidebar organizes all portal sections into groups:\n\n'
  E'- **Core Operations** — Dashboard, To-Dos, EOS, CRM, Customers\n'
  E'- **Sales & Quoting** — Quotes, Billing, Renewals\n'
  E'- **Field Service** — Work Orders, Dispatch, Inventory, Survey, Site Survey\n'
  E'- **Field & Tech** — KB Diagnostic, /tech Tool, Products\n'
  E'- **Design** — Floor Plans, System Design, As-Builts, E-Sign\n'
  E'- **Security** — Cameras, Access Control, Network\n'
  E'- **Dealer Network** — Reps, Compliance, Map, Scorecard\n'
  E'- **Operations** — Events, Incidents, Documents, Analytics, Alerts\n\n'
  E'Items you do not have permission to view are hidden automatically based on your org tier.\n\n'
  E'## TopBar\n\n'
  E'The top bar contains a **search field** (press `/` to focus), a **notification bell** with unread alerts, and a **profile dropdown** for account settings and sign out.\n\n'
  E'## NEXUS Assistant\n\n'
  E'The blue sparkle bubble in the bottom-right corner opens the NEXUS AI assistant. Click it to expand the chat panel. NEXUS can answer questions about any portal feature, fetch live data (open work orders, expiring quotes, overdue To-Dos), and create work orders or To-Dos directly from chat.\n\n'
  E'Toggle NEXUS off with the switch in the panel header — a small pill will remain so you can re-enable it.',
  'Getting Started',
  ARRAY['navigation', 'sidebar', 'topbar', 'nexus', 'assistant', 'layout'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Setting up your dealer account for the first time',
  'What to do after receiving your GateGuard NEXUS invitation',
  E'# Setting Up Your Dealer Account\n\n'
  E'When GateGuard provisions a new dealer account, you will receive a welcome email with a Clerk invitation link. Follow these steps to get fully set up.\n\n'
  E'## 1. Accept the Invitation\n\n'
  E'Click the invitation link in the welcome email. You will be taken to the sign-up screen to set your password. If your org uses Google SSO, click *Continue with Google* instead.\n\n'
  E'## 2. Complete Your Profile\n\n'
  E'After signing in, open your profile from the top-right dropdown and verify your name, phone number, and time zone are correct.\n\n'
  E'## 3. Add Your Team\n\n'
  E'Navigate to **Admin → Users** to invite technicians and sales reps. Each person receives their own Clerk invitation. Field techs can use the `/tech` tool with a shared PIN instead of individual logins.\n\n'
  E'## 4. Connect Integrations\n\n'
  E'Go to **Admin → Integrations** to connect Brivo (access control), Eagle Eye (cameras), and Mapbox (territory map). You will need API credentials from each provider.\n\n'
  E'## 5. Add Your First Property\n\n'
  E'Navigate to **Properties** and click **+ New Site** to add your first installed property. Fill in the property name, address, and unit count — these drive billing calculations.\n\n'
  E'## 6. Import Equipment\n\n'
  E'Visit **Products** to verify your equipment library is populated. GateGuard pre-loads common devices (DoorKing, Brivo, LiftMaster, UniFi). Use **Find Online** or **Upload PDF** to attach manuals to any device your techs service.',
  'Getting Started',
  ARRAY['setup', 'onboarding', 'account', 'first-time', 'invitation'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Understanding the GateGuard org hierarchy',
  'How the 6-tier organization structure works — from Corporate down to Client',
  E'# Understanding the GateGuard Org Hierarchy\n\n'
  E'GateGuard uses a 6-tier organizational hierarchy to isolate data and permissions across the dealer network.\n\n'
  E'## The Six Tiers\n\n'
  E'| Tier | Display Name | Description |\n'
  E'|------|-------------|-------------|\n'
  E'| 1 | GateGuard Corporate | Root — sees everything |\n'
  E'| 2 | Master Agent | Regional channel partner |\n'
  E'| 3 | MSO (Master System Operator) | Multi-site dealer group |\n'
  E'| 4 | Dealer / Install Partner / Service Partner / Sales Partner | Core operational tier |\n'
  E'| 5 | Sub-Dealer | Authorized reseller |\n'
  E'| 6 | Client | Property manager — read-only |\n\n'
  E'## What Each Tier Sees\n\n'
  E'- **Corporate:** All organizations, all revenue, full admin controls.\n'
  E'- **Master Agent:** Their child MSOs and dealers, roll-up MRR, rep network.\n'
  E'- **MSO:** Their child dealers, cross-site work order summary, all client properties.\n'
  E'- **Dealer:** Their clients only, quotes, work orders, invoices, tech tool codes.\n'
  E'- **Client:** Their properties only, service tickets, invoices, camera clips.\n\n'
  E'## Data Isolation\n\n'
  E'All isolation is enforced at the database level via Supabase Row-Level Security (RLS). Every query automatically filters to the authenticated org — there is no application-level workaround.\n\n'
  E'## Commission Flow\n\n'
  E'Commission percentages are configured per org in **Admin → Dealers**. The system enforces pool limits: Sales Partner + Service Dealer combined cannot exceed $4.00/unit.',
  'Getting Started',
  ARRAY['hierarchy', 'org', 'tiers', 'permissions', 'rls', 'structure'],
  'Intermediate',
  0,
  'GateGuard Support'
),

-- ─────────────────────────────────────────────────────────────────────────────
-- DASHBOARD
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Reading the dashboard — KPIs, alerts, and EOS snapshot',
  'How to interpret the main dashboard at portal.gateguard.co',
  E'# Reading the Dashboard\n\n'
  E'The dashboard at `/` (root of the portal) is your daily command center. It surfaces the most important numbers across your operation at a glance.\n\n'
  E'## KPI Cards\n\n'
  E'The top row of cards shows:\n\n'
  E'- **Total Accounts** — number of active client organizations under your org\n'
  E'- **Open Work Orders** — WOs with status `open` or `in_progress`\n'
  E'- **Pipeline Value** — total dollar value of opportunities in your CRM\n'
  E'- **Open Leads** — leads not yet converted to opportunities\n\n'
  E'Each card links to the corresponding section when clicked.\n\n'
  E'## Alert Banner\n\n'
  E'If any permits are expiring within 30 days, invoices are overdue, or work orders are past their due date, an amber alert banner appears below the KPI cards.\n\n'
  E'## EOS Snapshot\n\n'
  E'The right column shows a summary of your current EOS state: open Issues count, this week''s Scorecard vs target, and any Rocks due this quarter. Click **View EOS** to go to the full `/eos` page.\n\n'
  E'## NEXUS Property Intelligence\n\n'
  E'Below the KPIs, property intelligence cards surface anomalies detected across your installed base — devices that went offline, properties with no recent work order activity, and contracts approaching renewal.',
  'Dashboard',
  ARRAY['dashboard', 'kpi', 'alerts', 'eos', 'overview'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'What each dashboard metric means',
  'Definitions and calculation methods for every number shown on the portal dashboard',
  E'# Dashboard Metric Definitions\n\n'
  E'Understanding what each number on the dashboard actually measures helps you act on the data rather than just read it.\n\n'
  E'## Active Accounts\n\n'
  E'Count of `organizations` rows with `is_active = true` that are children of your org. This includes all tiers beneath you (dealers, clients, etc.).\n\n'
  E'## Open Work Orders\n\n'
  E'Count of `work_orders` rows where `status IN (''open'', ''in_progress'', ''assigned'')` scoped to your org hierarchy. Does NOT include completed or cancelled WOs.\n\n'
  E'## Pipeline Value\n\n'
  E'Sum of `estimated_value` across all CRM opportunities with `status NOT IN (''won'', ''lost'')`.\n\n'
  E'## MRR (Monthly Recurring Revenue)\n\n'
  E'Sum of all active invoice line items with `item_type IN (''video_monitoring'', ''access_plan'')` for the current billing month. Calculated from the `invoices` table — only `paid` and `sent` invoices count.\n\n'
  E'## Open Leads\n\n'
  E'Count of `crm_leads` rows with `status = ''new''` or `status = ''contacted''` that have not been converted to an opportunity.\n\n'
  E'## Overdue Permits\n\n'
  E'Count of permits from the `permits_with_status` Supabase view where `status = ''expired''`. This view auto-computes status from `expiry_date` vs today.\n\n'
  E'## Scorecard Average\n\n'
  E'Weighted average across the five scorecard pillars: Response Time (25%), First Call Resolution (25%), Compliance (20%), On-Time Work Orders (20%), NPS (10%). Computed from the last 90 days of activity.',
  'Dashboard',
  ARRAY['dashboard', 'metrics', 'mrr', 'kpi', 'definitions', 'calculations'],
  'Basic',
  0,
  'GateGuard Support'
),

-- ─────────────────────────────────────────────────────────────────────────────
-- CRM
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Creating and managing leads',
  'How to add leads and track them through the early CRM stages',
  E'# Creating and Managing Leads\n\n'
  E'Leads are the earliest stage in the GateGuard CRM pipeline. They represent potential properties, companies, or dealer partners that have expressed interest or that you are proactively targeting.\n\n'
  E'## Creating a Lead\n\n'
  E'1. Navigate to **CRM → Leads** (`/crm/leads`).\n'
  E'2. Click the **+ New Lead** button in the top right.\n'
  E'3. Fill in the lead details: name, company, email, phone, source (cold outreach, referral, show, etc.), and any notes.\n'
  E'4. Click **Save**.\n\n'
  E'You can also create leads from the main CRM dashboard (`/crm`) using the **+ New** dropdown and selecting *Lead*.\n\n'
  E'## Lead Detail Page\n\n'
  E'Click any lead in the list to open its detail page at `/crm/leads/[id]`. From here you can:\n\n'
  E'- Log activities (calls, emails, meetings)\n'
  E'- Set a follow-up date\n'
  E'- Attach notes\n'
  E'- View the deal aging badge (amber after 3 days, red after 7 days with no activity)\n'
  E'- Qualify the lead into an Opportunity\n\n'
  E'## Lead Statuses\n\n'
  E'| Status | Meaning |\n'
  E'|--------|--------|\n'
  E'| New | Just created, no contact made |\n'
  E'| Contacted | At least one activity logged |\n'
  E'| Qualified | Meets criteria; ready to convert |\n'
  E'| Disqualified | Not a fit — removed from active pipeline |',
  'CRM',
  ARRAY['crm', 'leads', 'pipeline', 'prospecting'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Converting a lead to an opportunity',
  'How to qualify a lead and promote it to an opportunity in the CRM',
  E'# Converting a Lead to an Opportunity\n\n'
  E'When a lead is ready to move forward — you have confirmed interest, budget, and a next step — convert it to an Opportunity.\n\n'
  E'## Steps\n\n'
  E'1. Open the lead detail page at `/crm/leads/[id]`.\n'
  E'2. Click the **Qualify as Opportunity** button near the top of the page.\n'
  E'3. A SlideOver panel opens. Fill in:\n'
  E'   - **Opportunity name** (defaults to the lead''s company name)\n'
  E'   - **Opportunity type** (Property, Company, Dealer, MSO, etc.)\n'
  E'   - **Estimated value**\n'
  E'   - **Close date**\n'
  E'   - **Assigned to** (sales rep)\n'
  E'4. Click **Create Opportunity**.\n\n'
  E'The lead status changes to *Qualified* and a new Opportunity record is created, pre-linked to the originating lead. You are redirected to the Opportunity detail page.\n\n'
  E'## Opportunity Types and Stage Sequences\n\n'
  E'Different opportunity types have different sales stage sequences:\n\n'
  E'- **Property / Company:** Lead → Opportunity → Site Survey → Quote Sent → Quote Approved → Signed → Install Scheduled\n'
  E'- **Dealer:** Lead → Opportunity → Agreement Sent → Signed & Approved\n'
  E'- **MSO:** Lead → Opportunity → Agreement Sent → Negotiation → Signed & Approved\n\n'
  E'## Kanban View\n\n'
  E'All active opportunities appear on the kanban board at `/crm/opportunities`. Each column represents a stage. Drag cards between columns to update stage. The weighted pipeline value is shown at the top of each column.',
  'CRM',
  ARRAY['crm', 'leads', 'opportunities', 'pipeline', 'qualify', 'conversion'],
  'Intermediate',
  0,
  'GateGuard Support'
),

(
  'Using the CRM kanban board',
  'How to work with opportunities on the kanban board at /crm/opportunities',
  E'# Using the CRM Kanban Board\n\n'
  E'The kanban board at `/crm/opportunities` gives you a visual overview of your entire sales pipeline organized by stage.\n\n'
  E'## Reading the Board\n\n'
  E'Each column represents a sales stage. The header of each column shows:\n\n'
  E'- The stage name\n'
  E'- Number of deals in that stage\n'
  E'- Weighted total value (deal value × close probability for that stage)\n\n'
  E'## Moving Deals\n\n'
  E'Drag any opportunity card to a different column to update its stage. The change saves immediately to Supabase. Stage history is recorded automatically.\n\n'
  E'## Opportunity Cards\n\n'
  E'Each card shows: company name, estimated value, assigned rep, and days in current stage. A red badge appears if the deal has been inactive for more than 7 days.\n\n'
  E'## Filtering\n\n'
  E'Use the filter controls at the top of the board to narrow by:\n\n'
  E'- Opportunity type (Property, Dealer, MSO, etc.)\n'
  E'- Assigned rep\n'
  E'- Date range\n\n'
  E'## Opening a Deal\n\n'
  E'Click any card to open the opportunity detail page at `/crm/opportunities/[id]`. From there you can log activities, add contacts, send emails, run the AI Sales Assistant, and view stage history.',
  'CRM',
  ARRAY['crm', 'kanban', 'opportunities', 'pipeline', 'drag-drop', 'stages'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Logging activities — calls, emails, meetings',
  'How to record CRM activities against a lead or opportunity',
  E'# Logging CRM Activities\n\n'
  E'Every interaction with a prospect or customer should be logged in the CRM to maintain a complete timeline and trigger the deal aging clock.\n\n'
  E'## How to Log an Activity\n\n'
  E'1. Open a lead (`/crm/leads/[id]`) or opportunity (`/crm/opportunities/[id]`).\n'
  E'2. Click **Log Activity** in the activity section.\n'
  E'3. Select the activity type: **Call**, **Email**, **Meeting**, **Note**, or **Task**.\n'
  E'4. Fill in the details:\n'
  E'   - **Outcome** (for calls/meetings): Connected, Left Voicemail, No Answer, Meeting Booked, etc.\n'
  E'   - **Subject / Notes**\n'
  E'   - **Date and time** (defaults to now)\n'
  E'5. Click **Save**.\n\n'
  E'## Activity Feed\n\n'
  E'All activities appear in chronological order on the detail page. Each entry shows the type icon, user who logged it, timestamp, and notes.\n\n'
  E'## Deal Aging\n\n'
  E'Logging an activity resets the deal aging clock. If no activity is logged for 3+ days, an amber badge appears on the kanban card. After 7+ days, it turns red. These badges are visual reminders to follow up.\n\n'
  E'## Email Activities\n\n'
  E'When you log an *Email* activity from the opportunity detail page, you can optionally send the email directly through the portal (powered by Resend). The email is tracked — opens are recorded and shown on the activity card.',
  'CRM',
  ARRAY['crm', 'activities', 'log', 'calls', 'emails', 'meetings', 'notes'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Using ARIA AI for lead research and outreach',
  'How to use the ARIA AI agent to research prospects and generate personalized outreach',
  E'# Using ARIA AI for Lead Research and Outreach\n\n'
  E'ARIA (Automated Research and Intelligence Agent) is GateGuard''s AI-powered lead intelligence engine. It researches properties and contacts, then generates personalized outreach campaigns.\n\n'
  E'## Accessing ARIA\n\n'
  E'ARIA is accessible from the CRM section. Look for the **ARIA Deep Intel** button on the CRM dashboard or on individual lead/opportunity detail pages.\n\n'
  E'## What ARIA Does\n\n'
  E'1. **Property Research** — Given a property name or address, ARIA searches public sources (listing sites, management company profiles, resident forums) for intelligence about internet service, management company, property class, and pain points.\n'
  E'2. **Contact Enrichment** — ARIA identifies the property manager or decision-maker contact using available public data.\n'
  E'3. **Outreach Generation** — ARIA drafts a personalized first-touch email using the research findings. The message references specific, verified details about the property (not generic templates).\n\n'
  E'## Running a Deep Intel Query\n\n'
  E'1. Enter the property name and/or address.\n'
  E'2. Click **Research**. ARIA runs 4 parallel web searches via Tavily, then synthesizes results with Claude.\n'
  E'3. Review the intelligence summary — each data point is cited with its source.\n'
  E'4. Click **Generate Outreach** to produce a tailored email draft.\n'
  E'5. Edit the draft as needed, then send directly or copy to your email client.\n\n'
  E'## Tips\n\n'
  E'- The more specific the property name, the better the research quality.\n'
  E'- ARIA performs best on properties with an active online presence (Google listing, apartments.com, etc.).\n'
  E'- Always review AI-generated content before sending — ARIA synthesizes public data and occasionally makes inferences.',
  'CRM',
  ARRAY['crm', 'aria', 'ai', 'lead-research', 'outreach', 'prospecting', 'intelligence'],
  'Advanced',
  0,
  'GateGuard Support'
),

-- ─────────────────────────────────────────────────────────────────────────────
-- QUOTES
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Creating a quote from scratch',
  'Step-by-step guide to building a new quote in GateGuard NEXUS',
  E'# Creating a Quote from Scratch\n\n'
  E'Quotes in NEXUS are built from the `/quotes/new` page. You can use the **Line Item Builder** (manual product search) or the **Survey Wizard** (imported from a site survey).\n\n'
  E'## Using the Line Item Builder\n\n'
  E'1. Navigate to **Quotes** and click **+ New Quote**.\n'
  E'2. Select **Line Item Builder**.\n'
  E'3. Fill in client info: name, email, phone, property address.\n'
  E'4. Search the product catalog and click **Add** to insert line items.\n'
  E'5. Organize items into sections (e.g., "Equipment", "Labor", "Recurring Services").\n'
  E'6. Set quantities and unit prices for each item.\n'
  E'7. Mark items as **Optional** or assign them to **Package Tiers** (Basic / Standard / Premium) if applicable.\n'
  E'8. Add a cover message and set expiry date, tax rate, and deposit percentage in the sidebar.\n'
  E'9. Click **Save Quote**.\n\n'
  E'## Sending the Quote\n\n'
  E'From the quote editor (`/quotes/[id]`), click **Send to Client**. The client receives an email with a secure approval link. No login is required on their end.\n\n'
  E'## Quote Statuses\n\n'
  E'Draft → Sent → Viewed → Accepted → Declined → Expired\n\n'
  E'The status updates automatically: *Viewed* when the client opens the approval link, *Accepted* or *Declined* based on their action.',
  'Quotes',
  ARRAY['quotes', 'line-items', 'builder', 'create', 'pricing'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Using the Survey Wizard quote builder',
  'How to build a quote from an existing site survey using the Survey Wizard',
  E'# Using the Survey Wizard Quote Builder\n\n'
  E'The Survey Wizard lets you import a completed site survey and auto-populate a quote from the AI-generated BOM (Bill of Materials).\n\n'
  E'## Prerequisites\n\n'
  E'You need a completed site survey in the system. Surveys can be created at `/survey` or captured in the field using the `/tech` tool''s Site Survey screen.\n\n'
  E'## Steps\n\n'
  E'1. Go to `/quotes/new` and select **Survey Wizard**.\n'
  E'2. Click **CRM Import** to search for an existing survey by property name or opportunity. This is pre-loaded if you clicked *Create Quote* from a survey record.\n'
  E'3. The wizard imports the survey''s device inventory and AI-generated BOM as pre-filled line items.\n'
  E'4. Progress through the wizard steps:\n'
  E'   - **Step 1:** Property details and survey confirmation\n'
  E'   - **Step 2:** Equipment — review and adjust BOM line items\n'
  E'   - **Step 3:** Labor — set labor hours and rates\n'
  E'   - **Step 4:** Services — add recurring service plan (Gate Operator Service Plan is included automatically when entry gates > 0)\n'
  E'   - **Step 5:** Review — final pricing summary\n'
  E'5. Click **Save & Continue** on each step, then **Create Quote** on the final step.\n\n'
  E'## Ramp-Up Plan\n\n'
  E'Step 4 includes a **Ramp-Up Plan** toggle (30/60/90 day phases). Enable this if the property needs a phased rollout with staged deliverables.',
  'Quotes',
  ARRAY['quotes', 'survey', 'wizard', 'bom', 'survey-wizard'],
  'Intermediate',
  0,
  'GateGuard Support'
),

(
  'Setting optional items and package tiers',
  'How to configure optional line items and Basic/Standard/Premium package tiers on a quote',
  E'# Optional Items and Package Tiers\n\n'
  E'NEXUS quotes support two advanced pricing features: **Optional Items** and **Package Tiers**.\n\n'
  E'## Optional Items\n\n'
  E'An optional item is shown to the client on the approval page but is NOT included in the base price. The client can check or uncheck it before approving.\n\n'
  E'To mark an item as optional:\n'
  E'1. Open the quote editor at `/quotes/[id]`.\n'
  E'2. Hover over a line item and click the **ellipsis (⋯)** menu.\n'
  E'3. Toggle **Optional Item** on.\n'
  E'The item now shows with a dashed border and "(Optional)" label on the approval page.\n\n'
  E'## Package Tiers\n\n'
  E'Package tiers let you present three versions of the same quote — Basic, Standard, and Premium — on a single approval page. The client selects one tier.\n\n'
  E'To assign items to tiers:\n'
  E'1. On the quote editor, toggle **Package Mode** on in the top-right settings.\n'
  E'2. For each line item, set its **Package Tier** (Basic, Standard, or Premium) using the dropdown on the item row.\n'
  E'3. Items without a tier assigned appear in all packages.\n\n'
  E'The approval page shows a three-column package comparison table. The client selects their preferred package, which locks in the corresponding item set.\n\n'
  E'## Combining Both Features\n\n'
  E'You can use optional items within a specific tier (e.g., an optional camera upgrade only available in the Premium tier).',
  'Quotes',
  ARRAY['quotes', 'optional', 'package-tiers', 'pricing', 'basic', 'standard', 'premium'],
  'Intermediate',
  0,
  'GateGuard Support'
),

(
  'Sending a quote to a client for approval',
  'How to deliver a quote and get client approval through the portal',
  E'# Sending a Quote for Client Approval\n\n'
  E'Once a quote is ready, send it to the client using the portal''s built-in delivery system. The client receives a branded approval link — no portal account required.\n\n'
  E'## Send Flow\n\n'
  E'1. Open the quote at `/quotes/[id]`.\n'
  E'2. Verify the quote status is **Draft** or **Sent** (not Expired).\n'
  E'3. Click **Send to Client** in the top-right toolbar.\n'
  E'4. Confirm the client email address in the dialog.\n'
  E'5. Optionally edit the cover message.\n'
  E'6. Click **Send**.\n\n'
  E'The system sends an email via Resend with a link to `/quotes/[id]/approve`. The quote status changes to **Sent**.\n\n'
  E'## Approval Page\n\n'
  E'The client sees a clean, branded approval page with:\n\n'
  E'- Quote summary and line items\n'
  E'- Package tier selector (if package mode is on)\n'
  E'- Optional item checkboxes\n'
  E'- Total price updated in real time\n'
  E'- **Approve** and **Decline** buttons\n\n'
  E'## Tracking\n\n'
  E'When the client opens the link, the quote status updates to **Viewed** automatically. You can see the view count on the quote list page.',
  'Quotes',
  ARRAY['quotes', 'approval', 'send', 'client', 'delivery'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'What happens when a client approves a quote',
  'The downstream effects of a client clicking Approve on a quote',
  E'# What Happens When a Client Approves a Quote\n\n'
  E'When a client clicks **Approve** on the quote approval page, a series of automated actions occur.\n\n'
  E'## Immediate Effects\n\n'
  E'1. The quote `status` field updates to **accepted** in Supabase.\n'
  E'2. The selected package tier and optional item choices are saved.\n'
  E'3. A notification appears in your portal notification bell.\n'
  E'4. If the quote was linked to a CRM opportunity, the opportunity stage advances automatically.\n\n'
  E'## Downstream Actions (Manual — to be triggered by the dealer)\n\n'
  E'After an approval, your typical next steps are:\n\n'
  E'1. **Create a Work Order** — go to `/maintenance` and create a WO linked to this quote for the installation job.\n'
  E'2. **Generate an Invoice** — go to `/billing` and create an invoice referencing the approved quote.\n'
  E'3. **Add the Property** — if this is a new installation, add the property at `/sites`.\n\n'
  E'## When a Client Declines\n\n'
  E'The quote status updates to **declined**. A notification is sent. The quote can be revised (clone and re-edit) and re-sent.',
  'Quotes',
  ARRAY['quotes', 'approval', 'accept', 'decline', 'workflow'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Creating a proposal from a quote',
  'How to generate a customer-facing proposal view from a NEXUS quote',
  E'# Creating a Proposal from a Quote\n\n'
  E'A proposal is a polished, customer-facing read-only version of a quote, typically used for presentation before the formal approval step.\n\n'
  E'## Proposal vs Approval Page\n\n'
  E'| | Proposal (`/quotes/[id]/proposal`) | Approval page (`/quotes/[id]/approve`) |\n'
  E'|--|--|--|\n'
  E'| Purpose | Present the scope | Capture the signature / approval |\n'
  E'| Interaction | Read-only | Approve / Decline buttons |\n'
  E'| Sent when | During the sales meeting | After verbal agreement |\n\n'
  E'## Generating the Proposal Link\n\n'
  E'1. Open the quote at `/quotes/[id]`.\n'
  E'2. Click **View Proposal** (or navigate directly to `/quotes/[id]/proposal`).\n'
  E'3. Copy the URL to share with the client.\n\n'
  E'## What the Proposal Shows\n\n'
  E'- Cover page with GateGuard and dealer branding\n'
  E'- Property details and scope summary\n'
  E'- Equipment list with photos and descriptions\n'
  E'- Pricing breakdown (no approve/decline buttons)\n'
  E'- Terms and conditions\n\n'
  E'## Printing\n\n'
  E'Use your browser''s print function on the proposal page. The page has a `@media print` stylesheet that suppresses the sidebar and navigation, producing a clean PDF.',
  'Quotes',
  ARRAY['quotes', 'proposal', 'presentation', 'print', 'pdf'],
  'Intermediate',
  0,
  'GateGuard Support'
),

-- ─────────────────────────────────────────────────────────────────────────────
-- WORK ORDERS
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Creating a new work order',
  'How to create a work order in NEXUS for service, repair, or installation jobs',
  E'# Creating a New Work Order\n\n'
  E'Work orders (also called maintenance tickets) track every service job from creation through completion.\n\n'
  E'## Steps\n\n'
  E'1. Navigate to **Work Orders** (`/maintenance`).\n'
  E'2. Click **+ New Work Order**.\n'
  E'3. Fill in the required fields:\n'
  E'   - **Title** — short description (e.g., "Gate operator not responding")\n'
  E'   - **Site** — the property where the work will be performed\n'
  E'   - **Priority** — Low, Medium, High, or Emergency\n'
  E'   - **Type** — Repair, Preventive Maintenance, New Install, or Inspection\n'
  E'   - **Scheduled date**\n'
  E'4. Optionally:\n'
  E'   - Assign a technician\n'
  E'   - Link to a quote (if this WO fulfills an approved quote)\n'
  E'   - Add a checklist of tasks\n'
  E'5. Click **Create Work Order**.\n\n'
  E'## Work Order Statuses\n\n'
  E'Open → Assigned → En Route → On Site → Completed / Cancelled\n\n'
  E'Status updates can be made from the WO detail page or from the Dispatch board (`/dispatch`).\n\n'
  E'## From the Request Portal\n\n'
  E'Property managers can submit service requests at the public request portal URL. These arrive in NEXUS as work orders with `status = open` and `source = client_request`.',
  'Work Orders',
  ARRAY['work-orders', 'maintenance', 'create', 'jobs', 'service'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Assigning a work order to a technician',
  'How to assign and dispatch a work order to a field technician',
  E'# Assigning a Work Order to a Technician\n\n'
  E'Assigning a WO links it to a specific technician and makes it appear on their calendar in the Dispatch board.\n\n'
  E'## From the WO Detail Page\n\n'
  E'1. Open the work order.\n'
  E'2. In the **Assigned To** field, type the technician''s name or select from the dropdown.\n'
  E'3. Confirm the scheduled date and time window.\n'
  E'4. Click **Save**. The WO status changes to **Assigned**.\n\n'
  E'## From the Dispatch Board\n\n'
  E'The Dispatch board at `/dispatch` shows all open WOs on the left and tech schedules on the right (with a Mapbox map view). You can:\n\n'
  E'- Drag an unassigned WO card onto a tech''s column to assign it\n'
  E'- Use the **📍 Map** toggle to see tech location pins and job site pins simultaneously\n'
  E'- View En Route and On Site columns to track active jobs in real time\n\n'
  E'## Technician Notification\n\n'
  E'When a WO is assigned, the technician receives an email notification (via Resend) with the job details, site address, and a link to the WO detail page.',
  'Work Orders',
  ARRAY['work-orders', 'dispatch', 'assign', 'technician', 'scheduling'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Work order status lifecycle',
  'The stages a work order moves through from creation to completion',
  E'# Work Order Status Lifecycle\n\n'
  E'Every work order in NEXUS follows a defined status progression from creation through closeout.\n\n'
  E'## Status Flow\n\n'
  E'```\n'
  E'Open → Assigned → En Route → On Site → Completed\n'
  E'                                    ↘ Cancelled\n'
  E'```\n\n'
  E'## Status Definitions\n\n'
  E'| Status | Who Sets It | What It Means |\n'
  E'|--------|------------|---------------|\n'
  E'| Open | System / dispatcher | New WO, not yet assigned |\n'
  E'| Assigned | Dispatcher | Tech has been assigned and notified |\n'
  E'| En Route | Tech via /tech or Dispatch board | Tech is traveling to the site |\n'
  E'| On Site | Tech via /tech or Dispatch board | Tech has arrived |\n'
  E'| Completed | Tech or office | Work is done, WO closed |\n'
  E'| Cancelled | Office | WO voided (reason required) |\n\n'
  E'## Completing a Work Order\n\n'
  E'To close a WO:\n'
  E'1. Open the WO detail page.\n'
  E'2. Add completion notes.\n'
  E'3. Attach any parts used (they will be deducted from inventory).\n'
  E'4. Click **Mark Complete**.\n\n'
  E'## Scorecard Impact\n\n'
  E'On-time completion rate (WOs completed by scheduled date) counts for 20% of the dealer scorecard. Cancellations do not count against on-time rate.',
  'Work Orders',
  ARRAY['work-orders', 'status', 'lifecycle', 'workflow', 'complete'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Adding parts and materials to a work order',
  'How to track parts used on a job and link them to inventory',
  E'# Adding Parts and Materials to a Work Order\n\n'
  E'Every part used on a job should be recorded on the work order. This keeps inventory accurate and creates a parts record for the job cost report.\n\n'
  E'## Adding a Part\n\n'
  E'1. Open the WO detail page at `/maintenance/[id]`.\n'
  E'2. Scroll to the **Parts & Materials** section.\n'
  E'3. Click **+ Add Part**.\n'
  E'4. Search for the part in the inventory catalog (SKU or name).\n'
  E'5. Enter the quantity used.\n'
  E'6. Click **Add**.\n\n'
  E'## Inventory Deduction\n\n'
  E'When you mark a part as **Used** on a work order, the `on_hand` count in the inventory table (`/inventory`) decrements automatically. If the new `on_hand` falls below the item''s `min_stock` threshold, a **PO Pending** badge appears and a draft PO is automatically created.\n\n'
  E'## Free-Text Parts\n\n'
  E'If a part is not in the inventory catalog (e.g., a locally sourced item), you can add it as a free-text line item with a description and cost. This records the expense but does not affect inventory.\n\n'
  E'## Job Costing\n\n'
  E'The parts added here feed into job costing reports, showing actual materials cost vs. the quoted price.',
  'Work Orders',
  ARRAY['work-orders', 'parts', 'inventory', 'materials', 'job-cost'],
  'Intermediate',
  0,
  'GateGuard Support'
),

(
  'Capturing a client signature on completion',
  'How to get a digital sign-off from the client when closing a work order',
  E'# Capturing a Client Signature on WO Completion\n\n'
  E'NEXUS supports digital client sign-off on work order completion using a touch/mouse canvas.\n\n'
  E'## How It Works\n\n'
  E'1. When the tech is ready to close the job, open the WO detail page (on mobile or tablet).\n'
  E'2. Scroll to the **Completion & Sign-Off** section.\n'
  E'3. Have the client (or property manager on site) sign in the signature canvas using their finger or a stylus.\n'
  E'4. Click **Sign & Complete**.\n\n'
  E'The signature is captured as an image and stored with the work order record. The WO status updates to **Completed**.\n\n'
  E'## Signature on the E-Sign Dashboard\n\n'
  E'For formal contract sign-off (not field WO closeout), use the dedicated E-Sign module at `/design/esign`. This creates a legally tracked document with a token-based signing URL that you can send to any contact.\n\n'
  E'## No Client On Site?\n\n'
  E'If no authorized contact is on site to sign, the tech can mark the WO complete without a signature and note the reason. Office staff can request a remote signature via the E-Sign module afterward.',
  'Work Orders',
  ARRAY['work-orders', 'signature', 'sign-off', 'completion', 'esign'],
  'Basic',
  0,
  'GateGuard Support'
),

-- ─────────────────────────────────────────────────────────────────────────────
-- SITE SURVEY
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Running a site survey from the portal',
  'How to create and manage site surveys from the /survey page',
  E'# Running a Site Survey from the Portal\n\n'
  E'The site survey module at `/survey` is the hub for all pre-installation assessments. Surveys capture what''s installed, what''s needed, and generate AI-powered proposals.\n\n'
  E'## Creating a Survey\n\n'
  E'1. Navigate to **Site Survey** (`/survey`).\n'
  E'2. Click **+ New Survey**.\n'
  E'3. Enter the property name and address.\n'
  E'4. Optionally link to an existing opportunity or site record.\n\n'
  E'## Adding Devices\n\n'
  E'In the survey detail view, use the device inventory section to add what''s on site:\n\n'
  E'- Device name (e.g., "Entry Gate Operator")\n'
  E'- Brand and model\n'
  E'- Location on property\n'
  E'- Condition: Good / Fair / Poor\n'
  E'- Recommended action: Keep / Service / Replace / New Install\n\n'
  E'## Voice Capture\n\n'
  E'Click the microphone button to upload a Plaud recording or dictate device details. The system transcribes the audio and auto-extracts a structured device list using Claude AI.\n\n'
  E'## Generating the AI Proposal\n\n'
  E'Once devices are added, click **Generate AI Proposal**. Claude Haiku analyzes the inventory and returns:\n\n'
  E'- Executive summary (2-3 sentences)\n'
  E'- Prioritized line items (Urgent / Recommended / Optional)\n'
  E'- Installation recommendations\n'
  E'- Site-specific notes\n\n'
  E'## Converting to a Quote\n\n'
  E'Click **Create Quote from Survey** to open the Survey Wizard in the quote builder with the BOM pre-loaded.',
  'Site Survey',
  ARRAY['survey', 'site-survey', 'proposal', 'bom', 'assessment'],
  'Intermediate',
  0,
  'GateGuard Support'
),

(
  'Using the /tech field tool for site surveys',
  'How field technicians run site surveys from the mobile /tech tool',
  E'# Site Survey in the /tech Field Tool\n\n'
  E'Field technicians can run a complete site survey from their phone without needing portal access. The survey is saved to the portal via the tech tool''s cloud save feature.\n\n'
  E'## Accessing Site Survey\n\n'
  E'1. Log in to the `/tech` tool with your PIN.\n'
  E'2. From the home screen, tap the **📍 SITE SURVEY** button.\n\n'
  E'## Adding Devices\n\n'
  E'On the Survey screen:\n'
  E'1. Tap **+ Add Device**.\n'
  E'2. Fill in: device name, brand, model, location, condition (Good/Fair/Poor), and action (Keep/Service/Replace/New Install).\n'
  E'3. Add any notes about the specific device.\n'
  E'4. Tap **Save Device**.\n\n'
  E'Repeat for each piece of equipment on the property.\n\n'
  E'## Generating the Proposal\n\n'
  E'Once all devices are entered, tap **⚡ GENERATE PROPOSAL**. The tool sends the device list to Claude Haiku, which returns a structured SOW proposal in seconds.\n\n'
  E'## Saving to the Portal\n\n'
  E'Tap **☁ SAVE TO PORTAL** to upload the completed survey. It will appear in the portal at `/survey` where office staff can generate a quote from it.\n\n'
  E'## Voice Capture (Plaud Integration)\n\n'
  E'If your dealer has configured Plaud API credentials, tap **🎙 UPLOAD PLAUD RECORDING** to upload an audio file. The system transcribes it and auto-extracts the device list.',
  'Site Survey',
  ARRAY['survey', 'tech-tool', 'field', 'plaud', 'voice', 'mobile'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Uploading a Plaud voice recording to extract device inventory',
  'How to use Plaud voice recordings to auto-populate site survey device lists',
  E'# Uploading a Plaud Recording for Site Survey\n\n'
  E'Plaud is a voice recording device popular with field professionals. GateGuard integrates directly with the Plaud API to transcribe recordings and auto-extract device lists.\n\n'
  E'## Prerequisites\n\n'
  E'- `PLAUD_CLIENT_ID` and `PLAUD_SECRET_KEY` must be set in Vercel environment variables.\n'
  E'- Register at `platform.plaud.ai/developer` to get credentials.\n\n'
  E'## From the /tech Tool\n\n'
  E'1. On the Survey screen, tap **🎙 UPLOAD PLAUD RECORDING**.\n'
  E'2. Select the audio file exported from your Plaud device (m4a, mp3, wav, etc.).\n'
  E'3. The file uploads to Supabase Storage, then the Plaud transcription API processes it.\n'
  E'4. The transcript appears in the text area automatically.\n'
  E'5. Tap **⚡ EXTRACT DEVICES** to run Claude Haiku extraction.\n\n'
  E'## From the Portal /survey Page\n\n'
  E'1. Open or create a survey.\n'
  E'2. Click the microphone icon in the voice capture section.\n'
  E'3. Select your audio file and click **Transcribe**.\n'
  E'4. Review the transcript (you can edit it), then click **Extract Devices**.\n\n'
  E'## What Gets Extracted\n\n'
  E'Claude reads the transcript and identifies: device names, brands, models, locations mentioned, conditions described, and recommended actions — returning a structured `SurveyDevice[]` array that populates the inventory list.',
  'Site Survey',
  ARRAY['survey', 'plaud', 'voice', 'transcription', 'ai', 'extraction'],
  'Intermediate',
  0,
  'GateGuard Support'
),

(
  'Generating an AI proposal from survey data',
  'How the AI proposal generation works in NEXUS site surveys',
  E'# Generating an AI Proposal from Survey Data\n\n'
  E'Once a site survey''s device inventory is complete, NEXUS can generate a full scope-of-work proposal in seconds using Claude Haiku.\n\n'
  E'## How to Generate\n\n'
  E'1. Open a survey with at least one device added.\n'
  E'2. Click **⚡ Generate AI Proposal** (portal) or tap **⚡ GENERATE PROPOSAL** (tech tool).\n'
  E'3. Wait 5-15 seconds for Claude to process the inventory.\n\n'
  E'## What the Proposal Contains\n\n'
  E'- **Executive Summary** — 2-3 sentence overview of the property''s access control state\n'
  E'- **Line Items** — each item has a name, quantity, unit, priority (Urgent/Recommended/Optional), and install notes\n'
  E'- **Recommendations** — strategic notes on the best approach (e.g., "Replace loop detectors before gate season begins")\n'
  E'- **Install Notes** — site-specific logistical notes (e.g., "Conduit run to Unit B requires trenching")\n\n'
  E'## Priority Levels\n\n'
  E'- **Urgent** — safety or operational issue; must address immediately\n'
  E'- **Recommended** — will fail or degrade within 12 months without intervention\n'
  E'- **Optional** — enhancement or upgrade; nice-to-have\n\n'
  E'## Converting to a Quote\n\n'
  E'After reviewing, click **Create Quote** to open the Survey Wizard with all line items pre-loaded. You can adjust prices, add labor, and set package tiers before sending.',
  'Site Survey',
  ARRAY['survey', 'ai', 'proposal', 'sow', 'bom', 'claude'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Converting a survey to a quote',
  'Step-by-step process for turning a completed site survey into a sendable quote',
  E'# Converting a Survey to a Quote\n\n'
  E'A completed survey with an AI proposal can be turned into a formal quote in a few clicks.\n\n'
  E'## From the Survey Detail Page\n\n'
  E'1. Open the survey at `/survey` and select the relevant survey record.\n'
  E'2. Make sure the AI proposal has been generated (status should show "AI Ready" or "Proposal Generated").\n'
  E'3. Click **Create Quote from Survey**.\n'
  E'4. You are redirected to the Survey Wizard in `/quotes/new` with the BOM pre-loaded.\n'
  E'5. Review and adjust line items, add labor, set pricing.\n'
  E'6. Click **Create Quote** on the final step.\n\n'
  E'## The Survey Wizard auto-populates:\n\n'
  E'- Property name and address (from the survey)\n'
  E'- All BOM line items with quantities and suggested prices\n'
  E'- The opportunity link (if the survey was tied to a CRM opportunity)\n\n'
  E'## Survey Status After Conversion\n\n'
  E'Once a quote is created, the survey status updates to **Quoted** and a link to the quote appears on the survey record.',
  'Site Survey',
  ARRAY['survey', 'quote', 'convert', 'bom', 'wizard'],
  'Basic',
  0,
  'GateGuard Support'
),

-- ─────────────────────────────────────────────────────────────────────────────
-- PROPERTIES
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Adding a new property to the portal',
  'How to create a new site record in GateGuard NEXUS',
  E'# Adding a New Property\n\n'
  E'Each physical property (multifamily community, HOA, commercial building) you service gets a Site record in NEXUS.\n\n'
  E'## Steps\n\n'
  E'1. Navigate to **Properties** (`/sites`).\n'
  E'2. Click **+ New Site**.\n'
  E'3. Fill in:\n'
  E'   - **Property name** (e.g., "Sunset Commons")\n'
  E'   - **Address** (used for map geocoding and billing)\n'
  E'   - **Unit count** (drives Access Plan billing at $5/unit/month)\n'
  E'   - **Client organization** — which Client org owns this property\n'
  E'4. Optionally set:\n'
  E'   - Install Dealer, Service Dealer\n'
  E'   - Brivo Site ID and Eagle Eye Location ID (for hardware integration)\n'
  E'   - Contract start/end dates and billing rates\n'
  E'5. Click **Save Site**.\n\n'
  E'## After Creation\n\n'
  E'- The property appears on the `/map` territory map (pin colored by health score)\n'
  E'- You can add Assets (individual devices) under the site\n'
  E'- Work orders can be created against this site\n'
  E'- The billing engine calculates MRR from the unit count and rates\n\n'
  E'## Health Score\n\n'
  E'The property list shows a health chip (🟢/🟡/🔴) computed from open WOs + offline assets. Green = healthy, Amber = attention needed, Red = critical issues.',
  'Properties',
  ARRAY['properties', 'sites', 'add', 'create', 'new-property'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Managing site equipment (assets)',
  'How to track individual devices installed at a property using site assets',
  E'# Managing Site Equipment (Assets)\n\n'
  E'Every device installed at a property is tracked as a **Site Asset** — one row per physical device.\n\n'
  E'## Adding an Asset\n\n'
  E'1. Open a site at `/sites/[id]`.\n'
  E'2. Click the **Assets** tab.\n'
  E'3. Click **+ Add Asset**.\n'
  E'4. Fill in:\n'
  E'   - **Product** — select from the equipment catalog\n'
  E'   - **Serial number** (optional but recommended)\n'
  E'   - **Location** on property (e.g., "East Gate", "Building B Entry")\n'
  E'   - **Install date**\n'
  E'   - **Status**: Online / Offline / Maintenance\n'
  E'5. Click **Save**.\n\n'
  E'## Asset Terminals\n\n'
  E'For each asset, you can record the terminal-level as-built wiring map under the **Terminals** sub-tab. This documents exactly how the device is wired as installed.\n\n'
  E'## Health Impact\n\n'
  E'Assets with `status = offline` count against the property health score. Mark assets as **Maintenance** (not Offline) when they are intentionally taken down for service.\n\n'
  E'## Site Events\n\n'
  E'Significant asset changes (installs, replacements, offline alerts) are automatically logged to the Site Event Timeline, visible on the Events tab of the site detail page.',
  'Properties',
  ARRAY['properties', 'assets', 'equipment', 'devices', 'site-assets'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Viewing site health score',
  'How the health score is calculated and what the colors mean',
  E'# Site Health Score\n\n'
  E'Every property in NEXUS has a health score displayed as a colored chip on the site list and in the territory map.\n\n'
  E'## Health Score Colors\n\n'
  E'| Color | Meaning |\n'
  E'|-------|---------|\n'
  E'| 🟢 Green | Healthy — no issues |\n'
  E'| 🟡 Amber | Attention needed — minor issues present |\n'
  E'| 🔴 Red | Critical — requires immediate action |\n\n'
  E'## Calculation\n\n'
  E'The health score is computed from two factors:\n\n'
  E'1. **Offline assets** — any device with `status = offline` degrades the score. Multiple offline devices push to Red.\n'
  E'2. **Overdue work orders** — open WOs past their scheduled date degrade the score. Critical-priority overdue WOs go directly to Red.\n\n'
  E'## Improving a Score\n\n'
  E'- Resolve offline assets by updating status to **Online** or **Maintenance** once service is confirmed.\n'
  E'- Complete or reschedule overdue work orders.\n\n'
  E'## Territory Map\n\n'
  E'The health score drives the pin color on the territory map at `/map`. This gives dealers a geographic view of which properties need attention.',
  'Properties',
  ARRAY['properties', 'health-score', 'status', 'monitoring'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Setting up integration IDs for Eagle Eye and Brivo',
  'How to link a NEXUS site to Eagle Eye cameras and Brivo access control',
  E'# Setting Up Eagle Eye and Brivo Integration\n\n'
  E'Each property can be linked to your Eagle Eye camera account and Brivo access control system. This enables live camera feeds and access logs to surface directly in the portal.\n\n'
  E'## Eagle Eye Location ID\n\n'
  E'1. Log in to Eagle Eye Networks and navigate to the location for this property.\n'
  E'2. The Location ID appears in the URL (e.g., `...locationId=XXXXX`).\n'
  E'3. In NEXUS, open the site at `/sites/[id]` and click **Edit Site**.\n'
  E'4. Paste the Eagle Eye Location ID into the **Eagle Eye Location ID** field.\n'
  E'5. Click **Save**.\n\n'
  E'## Brivo Site ID\n\n'
  E'1. Log in to Brivo and navigate to the account for this property.\n'
  E'2. The Site ID is visible in Brivo under Account → Properties.\n'
  E'3. In NEXUS, paste it into the **Brivo Site ID** field on the site record.\n\n'
  E'## After Linking\n\n'
  E'- The **Cameras** tab on the site detail page will show live feeds from Eagle Eye.\n'
  E'- The **Access** tab will show recent access events from Brivo.\n'
  E'- Property managers (Client tier) can view these integrations via the client portal without logging into Eagle Eye or Brivo directly.',
  'Properties',
  ARRAY['properties', 'eagle-eye', 'brivo', 'integration', 'cameras', 'access-control'],
  'Intermediate',
  0,
  'GateGuard Support'
),

-- ─────────────────────────────────────────────────────────────────────────────
-- FIELD TECH TOOL
-- ─────────────────────────────────────────────────────────────────────────────
(
  'How to access the /tech field tool (PIN auth)',
  'How field technicians log in to the /tech tool using a PIN code',
  E'# Accessing the /tech Field Tool\n\n'
  E'The `/tech` field tool does NOT require a Clerk account. It uses a PIN code (TECH_ACCESS_CODE) for authentication — any tech who knows the PIN can access it.\n\n'
  E'## Accessing on Mobile\n\n'
  E'1. Open your phone''s browser and navigate to `portal.gateguard.co/tech`.\n'
  E'2. Enter the 4-8 digit PIN provided by your dealer admin.\n'
  E'3. Tap **Enter**.\n'
  E'4. You will be taken to the Identity screen to select your name from the tech roster.\n\n'
  E'## Add to Home Screen (Recommended)\n\n'
  E'For quick access in the field:\n'
  E'- **iPhone:** Tap the Share icon → Add to Home Screen\n'
  E'- **Android:** Tap ⋮ → Add to Home Screen\n\n'
  E'This creates an app icon that launches the tech tool fullscreen.\n\n'
  E'## PIN Not Working?\n\n'
  E'- Make sure you are entering the correct PIN (not your Clerk password)\n'
  E'- Contact your dealer admin — the PIN is set via the `TECH_ACCESS_CODE` environment variable in Vercel\n'
  E'- If you see a 500 error, the PIN has not been configured in your dealer''s Vercel environment\n\n'
  E'## Staying Logged In\n\n'
  E'Once authenticated, the PIN is saved to session storage. You remain logged in until you clear browser data or close the session.',
  'Field Tech Tool',
  ARRAY['tech-tool', 'pin', 'auth', 'access', 'mobile', 'field'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Running an AI diagnostic on a device',
  'Step-by-step guide to diagnosing equipment issues using the /tech AI diagnostic engine',
  E'# Running an AI Diagnostic\n\n'
  E'The AI diagnostic engine is the core feature of the `/tech` tool. It guides techs through troubleshooting using Claude AI backed by your product manual library.\n\n'
  E'## Steps\n\n'
  E'1. **Log in** to `/tech` with your PIN and select your name.\n'
  E'2. **Select a device** from the product list (green dot = has indexed manual).\n'
  E'3. **Select connected devices** — mark everything wired to the unit (photobeam, loop detector, callbox, etc.). This gives the AI full system topology.\n'
  E'4. **Select a fault category** (e.g., "Gate won''t open", "No power").\n'
  E'5. **Describe the symptom** — use the quick-pick chips or type a custom description.\n'
  E'6. **Add an error code** if the device is displaying one.\n'
  E'7. Tap **Start Diagnostic**.\n\n'
  E'## During the Diagnostic\n\n'
  E'The AI presents steps one at a time:\n\n'
  E'- **VERIFY** (blue) — check a reading or condition\n'
  E'- **ACTION** (amber) — do something physical\n'
  E'- **MEASURE** (purple) — take a meter reading (inline guide available)\n'
  E'- **PHOTO** — take a photo for Claude to analyze\n'
  E'- **RESOLVED** (green) — issue found and fixed\n'
  E'- **ESCALATE** (red) — issue requires further support\n\n'
  E'## After Resolution\n\n'
  E'When the AI reaches a resolved step, confirm "Did this fix it?" and describe what fixed the issue. This teaches the AI for future sessions.',
  'Field Tech Tool',
  ARRAY['tech-tool', 'diagnostic', 'ai', 'troubleshooting', 'claude'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Using the wiring guide',
  'How to use the /tech wiring guide to look up terminal diagrams',
  E'# Using the Wiring Guide\n\n'
  E'The Wiring Guide in the `/tech` tool provides SVG terminal diagrams for common device-to-device wiring pairings. It covers 27 devices and 19 wiring maps from the verified static library, plus AI-generated entries from your product manual library.\n\n'
  E'## Accessing the Wiring Guide\n\n'
  E'From the `/tech` home screen, tap **WIRING** in the bottom navigation bar.\n\n'
  E'## Finding a Wiring Map\n\n'
  E'1. Select the **primary device** (the device you are wiring to).\n'
  E'2. Select the **connected device** (e.g., gate operator, photobeam, loop detector).\n'
  E'3. The SVG terminal diagram loads instantly.\n\n'
  E'## Reading the Diagram\n\n'
  E'- **Terminal dots** represent physical screw terminals or connector pins\n'
  E'- **Connector block labels** (e.g., J2, J6) match the physical connector ID on the device\n'
  E'- **Wire colors**: Relay COM = amber, Relay NO = green, +V = red, GND = dark, data = blue\n'
  E'- **Install notes** appear below the diagram with numbered steps\n'
  E'- **Required settings** are listed (e.g., DIP switches, jumper positions)\n'
  E'- **Caution cards** appear in red for safety-critical connections\n\n'
  E'## AI-Generated Entries\n\n'
  E'Devices without a static wiring map may have an AI-generated terminal map (extracted from the product manual by Claude). These are marked with an AI badge. Always cross-reference with the physical manual for safety-critical work.',
  'Field Tech Tool',
  ARRAY['tech-tool', 'wiring', 'terminals', 'diagrams', 'guide'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Using the cable testing guide',
  'How to use the /tech cable guide for CAT cable and 2-wire testing',
  E'# Using the Cable Testing Guide\n\n'
  E'The Cable Guide in the `/tech` tool provides step-by-step procedures for three common low-voltage cable tests.\n\n'
  E'## Accessing the Cable Guide\n\n'
  E'Tap **CABLE** in the bottom navigation bar of the `/tech` tool.\n\n'
  E'## Three Test Procedures\n\n'
  E'### Tab 1: CAT Cable (T568B)\n\n'
  E'- Shows the T568B color-coded pinout for RJ45 connectors\n'
  E'- 7-step continuity and PoE validation procedure\n'
  E'- Use with a cable tester or multimeter on Ω mode\n\n'
  E'### Tab 2: 2-Wire Series\n\n'
  E'- Circuit diagram for series-wired 2-conductor runs (common in gate loops and sensors)\n'
  E'- Bisect-the-break procedure: divide the run in half, test each segment to isolate the fault\n\n'
  E'### Tab 3: 2-Wire Parallel\n\n'
  E'- Bus diagram for parallel-wired branches\n'
  E'- Branch isolation procedure: disconnect branches one at a time to find the faulted branch\n\n'
  E'## Measure Step Integration\n\n'
  E'During an AI diagnostic, if a MEASURE step asks for a cable resistance reading, tap the **⊕ METER** button to expand the inline multimeter guide. This shows the correct meter setting (Ω), probe positions, and the expected resistance range for pass/fail.',
  'Field Tech Tool',
  ARRAY['tech-tool', 'cable', 'testing', 'cat', '2-wire', 'continuity', 'guide'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Reporting resolution and teaching the AI',
  'How to submit resolution notes after a diagnostic to improve future AI accuracy',
  E'# Reporting Resolution and Teaching the AI\n\n'
  E'One of GateGuard''s most powerful features is the **resolution learning loop** — every time a tech successfully resolves an issue and reports what fixed it, the AI learns from that session.\n\n'
  E'## How to Report Resolution\n\n'
  E'1. When the AI diagnostic reaches a **RESOLVED** step, the screen asks: **"DID THIS FIX IT?"**\n'
  E'2. Tap **YES** if the issue is resolved.\n'
  E'3. A text area appears: **"WHAT FIXED IT?"**\n'
  E'4. Describe the root cause and fix (e.g., "Bad wire at terminal J2 pin 4 — replaced 6'' of 2-conductor wire").\n'
  E'5. Tap **SUBMIT**.\n\n'
  E'## What Happens\n\n'
  E'The resolution note is sent to `/api/kb/resolve`, which:\n\n'
  E'1. Marks the troubleshoot session as `resolved = true`\n'
  E'2. Auto-embeds a new `kb_articles` row combining the symptom, diagnostic history, and resolution\n'
  E'3. Makes this knowledge instantly available for future sessions on the same or similar devices via vector search\n\n'
  E'## Tap "NO — Issue Persists"\n\n'
  E'If the step did not fix the issue, tap **NO**. The AI continues with the next diagnostic hypothesis.\n\n'
  E'## Long-Term Impact\n\n'
  E'Over time, the KB accumulates field-validated fixes specific to your device library and install patterns. The AI becomes more accurate on every session. This is the compounding data moat that makes NEXUS impossible to replicate quickly.',
  'Field Tech Tool',
  ARRAY['tech-tool', 'resolution', 'learning', 'ai', 'kb', 'knowledge-base'],
  'Intermediate',
  0,
  'GateGuard Support'
),

-- ─────────────────────────────────────────────────────────────────────────────
-- BILLING
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Creating an invoice',
  'How to generate an invoice for a property in GateGuard NEXUS billing',
  E'# Creating an Invoice\n\n'
  E'The billing engine at `/billing` generates invoices for your installed properties based on the GateGuard billing model: Video Monitoring flat fee + Access Plan per-unit rate.\n\n'
  E'## Steps\n\n'
  E'1. Navigate to **Billing** (`/billing`).\n'
  E'2. Click **+ New Invoice**.\n'
  E'3. Select the **client organization** and the **site** for this invoice.\n'
  E'4. The system auto-calculates the base line items from the site''s billing configuration:\n'
  E'   - Video Monitoring Fee (default $500/month, configurable per site)\n'
  E'   - Access Plan ($5.00 × unit count per month)\n'
  E'5. Add any additional one-time or recurring line items (labor, parts, special services).\n'
  E'6. Set the **due date** and optionally add a **tax rate**.\n'
  E'7. Click **Save as Draft** or **Save & Send**.\n\n'
  E'## Invoice Numbering\n\n'
  E'Invoice numbers follow the format `GG-INV-NNNNNN`, continuing from the QuickBooks sequence (starting at 120045). Numbers are assigned automatically and cannot be manually set.\n\n'
  E'## Invoice Statuses\n\n'
  E'Draft → Sent → Paid / Overdue / Void',
  'Billing',
  ARRAY['billing', 'invoice', 'create', 'revenue', 'mrr'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Sending a Stripe payment link to a client',
  'How to generate and deliver a Stripe payment link for invoice collection',
  E'# Sending a Stripe Payment Link\n\n'
  E'NEXUS integrates with Stripe to generate instant payment links for each invoice. Clients pay via link — no portal login required.\n\n'
  E'## Prerequisites\n\n'
  E'- `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` must be set in your Vercel environment.\n'
  E'- `NEXT_PUBLIC_APP_URL` must be set to your portal URL (e.g., `https://portal.gateguard.co`).\n\n'
  E'## Generating a Payment Link\n\n'
  E'1. Open the invoice at `/billing`.\n'
  E'2. Click **Generate Payment Link**.\n'
  E'3. The system calls the Stripe API to create a Payment Link and stores the URL on the invoice record.\n'
  E'4. Click **Copy Link** to copy the Stripe URL.\n'
  E'5. Paste the link into your email to the client or click **Send Invoice Email** to deliver it via Resend.\n\n'
  E'## Client Experience\n\n'
  E'The client clicks the link and sees a Stripe-hosted checkout page. They can pay via:\n'
  E'- **ACH Direct Debit** (preferred for recurring billing — lower fees)\n'
  E'- **Credit or debit card** (Visa, Mastercard, Amex)\n\n'
  E'## After Payment\n\n'
  E'Stripe sends a webhook to NEXUS, which updates the invoice `status` to `paid` and records the `paid_at` timestamp.',
  'Billing',
  ARRAY['billing', 'stripe', 'payment', 'invoice', 'link', 'ach'],
  'Basic',
  0,
  'GateGuard Support'
),

-- ─────────────────────────────────────────────────────────────────────────────
-- TRAINING
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Enrolling in a training course',
  'How to access and start a training course in the GateGuard NEXUS training module',
  E'# Enrolling in a Training Course\n\n'
  E'The Training module at `/training` provides structured courses for GateGuard dealers, techs, and sales reps. Completed courses earn certificates that are valid for one year.\n\n'
  E'## Available Courses\n\n'
  E'- **Low Voltage Fundamentals (LVF)** — required prerequisite for most advanced courses\n'
  E'- **UL 325 Compliance** — requires LVF completion first\n'
  E'- **Brivo Access Control Basics**\n'
  E'- **Eagle Eye Camera Setup**\n'
  E'- **GateGuard Portal for Sales Reps**\n\n'
  E'## Starting a Course\n\n'
  E'1. Navigate to **Training** (`/training`).\n'
  E'2. Browse the course catalog.\n'
  E'3. Click on a course card to open it.\n'
  E'4. If you have not completed the prerequisite course(s), you will see a locked badge.\n'
  E'5. Click **Start Course** to begin the first chapter.\n\n'
  E'## Progress Tracking\n\n'
  E'Your progress is saved to Supabase automatically as you complete each chapter. Progress is tied to your Clerk user ID and persists across devices.\n\n'
  E'## Course Format\n\n'
  E'Courses are divided into chapters. Each chapter has a reading section followed by a short knowledge check. The final chapter contains the end-of-course exam.',
  'Training',
  ARRAY['training', 'courses', 'enroll', 'learning', 'certification'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Completing a course and earning a certificate',
  'How the end-of-course exam and certificate generation works in NEXUS training',
  E'# Completing a Course and Earning a Certificate\n\n'
  E'After completing all chapters in a training course, you take a final exam. Passing the exam generates a GateGuard-branded PDF certificate.\n\n'
  E'## The End-of-Course Exam\n\n'
  E'- **Format:** 8 multiple-choice questions covering all course material\n'
  E'- **Pass threshold:** 80% (6 out of 8 correct)\n'
  E'- **Attempts:** 3 maximum attempts before the course is locked\n'
  E'- **Time limit:** No time limit — take your time\n\n'
  E'## Taking the Exam\n\n'
  E'1. Complete all chapters in the course.\n'
  E'2. The **Take Exam** button appears on the course page.\n'
  E'3. Answer all 8 questions and click **Submit**.\n'
  E'4. Your score appears immediately. Pass → certificate generated. Fail → attempt counter decrements.\n\n'
  E'## Your Certificate\n\n'
  E'On passing, a PDF certificate is auto-generated with:\n'
  E'- Your full name\n'
  E'- Course name\n'
  E'- Date of completion\n'
  E'- Expiry date (1 year from completion)\n'
  E'- GateGuard branding and unique certificate ID\n\n'
  E'Download it from the **My Certificates** panel on the training page. You can also share a LinkedIn-ready image of the certificate directly from the portal.\n\n'
  E'## Certificate Expiry\n\n'
  E'Certificates expire after 1 year. You will receive an email reminder 30 days before expiry. Re-take the course to renew.',
  'Training',
  ARRAY['training', 'exam', 'certificate', 'certification', 'completion'],
  'Basic',
  0,
  'GateGuard Support'
),

-- ─────────────────────────────────────────────────────────────────────────────
-- EOS
-- ─────────────────────────────────────────────────────────────────────────────
(
  'Using the /eos page — Rocks, Scorecard, Issues, To-Dos',
  'How to use the EOS (Entrepreneurial Operating System) module in GateGuard NEXUS',
  E'# Using the EOS Page\n\n'
  E'The EOS page at `/eos` mirrors the core EOS One app experience inside NEXUS. If your business runs on EOS, this is your operating center.\n\n'
  E'## EOS Terminology\n\n'
  E'| Term | Meaning |\n'
  E'|------|---------|\n'
  E'| Rock | A 90-day priority (quarterly goal) |\n'
  E'| Scorecard | Weekly measurables with targets |\n'
  E'| Issue | A problem to be IDS''d (Identify, Discuss, Solve) |\n'
  E'| To-Do | A 7-day action item |\n'
  E'| L10 | Weekly Leadership Team Meeting |\n\n'
  E'## Rocks (Quarterly)\n\n'
  E'Click the **Rocks** tab to view this quarter''s Rocks. Each Rock has an owner, due date, and status (On Track / Off Track / Done). Update Rock status weekly.\n\n'
  E'## Scorecard (Weekly)\n\n'
  E'The Scorecard tab shows your weekly measurables. Each row has a metric name, owner, weekly target, and the last 13 weeks of actuals. Green = on/above target. Red = below target.\n\n'
  E'## Issues (IDS)\n\n'
  E'Add issues to the Issues list throughout the week. During your L10 meeting, bring them to the issues segment and IDS each one. Mark issues as **Solved** when the discussion produces a clear next step or To-Do.\n\n'
  E'## To-Dos (7-Day)\n\n'
  E'To-Dos are short-cycle action items with a 7-day deadline. Add them from the To-Dos tab or directly from NEXUS Assistant chat. Each To-Do has an owner and due date.',
  'EOS',
  ARRAY['eos', 'rocks', 'scorecard', 'issues', 'to-dos', 'l10', 'entrepreneurial-operating-system'],
  'Basic',
  0,
  'GateGuard Support'
),

(
  'Running an L10 meeting in NEXUS',
  'How to facilitate your weekly EOS L10 meeting using the NEXUS portal',
  E'# Running an L10 Meeting in NEXUS\n\n'
  E'The L10 (Level 10 Meeting) is the weekly 90-minute meeting at the core of EOS. NEXUS provides a built-in L10 facilitator to keep the meeting on track.\n\n'
  E'## Standard L10 Agenda (90 minutes)\n\n'
  E'| Segment | Time |\n'
  E'|---------|------|\n'
  E'| Segue (good news) | 5 min |\n'
  E'| Scorecard review | 5 min |\n'
  E'| Rock review | 5 min |\n'
  E'| Customer/Employee headlines | 5 min |\n'
  E'| To-Do review | 5 min |\n'
  E'| IDS (Issues) | 60 min |\n'
  E'| Conclude (To-Dos, rating) | 5 min |\n\n'
  E'## Using the L10 Facilitator\n\n'
  E'1. Navigate to `/eos` and click **Start L10**.\n'
  E'2. The facilitator steps through each agenda segment with a countdown timer.\n'
  E'3. During Scorecard review: each metric flashes red if below target.\n'
  E'4. During Rock review: mark Rocks On Track, Off Track, or Done.\n'
  E'5. During IDS: prioritize the Issues list, run each item through Identify → Discuss → Solve.\n'
  E'6. At conclude: capture new To-Dos, rate the meeting 1-10.\n\n'
  E'## After the Meeting\n\n'
  E'All To-Dos created during the meeting appear in the To-Dos section and are visible in the NEXUS Assistant. Solved issues are archived. New To-Dos carry a 7-day deadline from the meeting date.\n\n'
  E'## GateGuard L10 Schedule\n\n'
  E'Weekly L10 for the GateGuard leadership team is every Friday at 6am with Nicole Gagliardi.',
  'EOS',
  ARRAY['eos', 'l10', 'meeting', 'ids', 'scorecard', 'rocks', 'to-dos', 'facilitation'],
  'Intermediate',
  0,
  'GateGuard Support'
)

ON CONFLICT (title) DO NOTHING;
