# GateGuard Portal — Agent Context

---

## THE PLATFORM VISION — The Ultimate Multifamily Middleware (Read Every Session)

**Validated May 2026 — permanent strategic context:**

GateGuard is building the **central nervous system of multifamily real estate** — the middleware layer that sits between every hardware vendor, software platform, resident, property manager, and service provider. Not a point solution. Not just access control. The tollbooth for everything that moves in and out of a multifamily property.

### The Market Reality (Verified Data)
- PropTech market: $44.59B in 2026, growing to $104B by 2034. $16.7B invested in 2025 (+68% YoY)
- SmartRent (top competitor): $152M revenue, stock at **$1.12** (down from $10 SPAC), still unprofitable, hardware fragility destroying customer trust
- DOOR/Latch (formerly Latch): $70M revenue, **$53.7M net loss**, $34.6M cash left — under 8 months runway. Distressed acquisition target.
- ButterflyMX: Healthiest pure-play ($131M raised, 20K+ properties) — hardware-first model, same as GateGuard
- RealPage/STRATIS: DOJ antitrust settled Nov 2025 (7-year monitoring). Risk reduced but trust damaged.

### Why GateGuard Wins
The installer is the moat. Whoever physically bolts the hardware to the building owns that property relationship for 5-10 years. Software can be replaced in a day. A gate cannot. Every GateGuard install is the starting line for a compounding platform play.

### The Trigger-Based Delivery Model (How We Build It)
Every hardware install creates a captive base for zero-marginal-cost software delivery. Each trigger is a "surprise and delight" moment that compounds into a platform:

| Trigger | Timing | What Property Gets | GateGuard Cost | Property Perceives |
|---------|--------|-------------------|----------------|-------------------|
| Hardware Install | Day 0 | Gate, cameras, Brivo, UniFi | Hardware + labor | "We bought a gate" |
| GateCard Activation | Week 1 | Resident app, mobile access, visitor mgmt | ~$0 (software built) | "We expected a gate. We got a platform." |
| Vendor Accountability | Month 1 | QR valet trash, geo-fenced security, incident reporting | One-time API per vendor type | "Our #1 complaint source disappeared" |
| Ancillary Revenue Layer | Month 3 | Commission on insurance, furniture, move-in services | Affiliate setup | "The gate is paying us back. It's a revenue line now." |
| Community Commerce | Month 6 | Resident marketplace, vetted vendors, building rewards | Feature additions | "Our renewals are up. Nobody else in the market has this." |
| AI Intelligence Layer | Month 12+ | Predictive maintenance, lease renewal scoring, ARIA outreach | AI engine already built | "It predicted our gate failure 3 weeks early. How?" |

### The Compounding Loop
**Install → Software Over-Delivery → Property Gets Paid → PM Tells Other PMs → New Install → Repeat**

The critical insight: **Every installed property is a zero-cost beta tester AND a living marketing engine.** The marginal cost of delivering this full stack to property #100 is near zero compared to property #1. A property manager who receives a monthly commission check from their gate install will not stop talking about it at regional owners meetings. Word of mouth between PMs in a region travels faster than any ad spend.

### The Three Moats
1. **Physical moat**: Hardware is bolted in. Competitors need a truck and a signed change order to displace us
2. **Data moat**: Every gate cycle, camera event, and resident interaction trains the AI. Property #500 benefits from everything learned at #1–499
3. **Word-of-mouth moat**: PMs who get paid by their gate install are involuntary evangelists

### Build Sequencing Rule
Always prioritize features that: (a) deliver immediate visible value to already-installed properties at near-zero marginal cost, (b) create a new revenue stream for the property, or (c) strengthen the data layer for AI. Never build features that require displacing existing hardware or that only serve uninstalled prospects.

---

## 10/10 LEVEL-UP PLAN — Competitive Audit → Best-in-Class (Read Every Session)

**Established May 2026. This is the standing product roadmap until all 14 sections score 10/10.**

### The Design System Mandate (Do This Before Anything Else)
The single biggest gap between "looks like a dev built it in Tailwind" and "looks like a funded PropTech design team built this" is shared component language. Five components must be built and used everywhere:

1. **`<DataTable>`** — Every list page. Consistent column widths, hover row highlight, right-click context menu, bulk checkbox, column sort.
2. **`<SlideOver>`** — Every create/edit form. Consistent header + scrollable body + sticky Save/Cancel footer.
3. **`<EmptyState>`** — Every list that can return zero rows. Icon + heading + subtext + CTA button.
4. **`<SkeletonRow>`** — Every data-fetching component. Animated shimmer while loading.
5. **`<StatusBadge>`** — Uses color AND icon shape (never color alone). Used identically across all sections.

**The "not AI-assembled" test**: Show it to someone who didn't build it. If they say "is this Figma?" — pass. If they say "looks like a Tailwind template" — fail. Shared components close this gap.

### NEXUS Personal Assistant (PA) — LIVE ✅ May 2026
`components/layout/NexusAssistant.tsx` — floating bottom-right AI PA on all portal pages (not /tech).
- 52px sparkle bubble, brand blue. Red badge + pulse ring when alerts exist.
- Expand → 380px chat panel: alert bar, message feed, quick prompt chips, AI chat input.
- Toggle on/off: switch in panel header persists to localStorage. When off shows a tiny "NEXUS" re-enable pill.
- Proactive briefing on first open: fetches overdue To-Dos, expiring quotes, open WOs via `/api/assistant/alerts`.
- AI chat: `/api/assistant/chat` → Claude Haiku. Knows all portal routes, current page, live Supabase data for To-Dos/quotes/WOs/leads queries.
- Deep links in AI responses render as clickable `[text](href)` anchors.
- Next level: add scheduled proactive pushes (e.g. "It's Friday — time for L10 meeting prep"), user-specific memory, multi-step task execution.

### Sprint 1 — Investor-Killer Fixes (Week 1) ✅ IN PROGRESS
- [ ] Wire Dashboard KPIs to live Supabase (accounts, WOs, quotes pipeline, open leads). Kill every hardcoded number.
- [ ] EOS persistence — wire Rocks/Scorecard/Issues/To-Dos to Supabase (migration 010 already written, must run on beta first)
- [ ] Rename "Maintenance" → "Work Orders" everywhere (Sidebar, page titles, TopBar subtitles)
- [ ] Build `<EmptyState>` shared component → add to all 14 list pages
- [ ] Build `<SkeletonRow>` shared component → add to all data-fetching list components

### Sprint 2 — Demo Anchor Polish (Week 2) ✅ IN PROGRESS
- [ ] Quote PDF export: print-CSS on approval page + "Download PDF" button on quote editor (window.print())
- [ ] Tech Tool PWA manifest: manifest.json + meta tags in layout → techs can "Add to Home Screen"
- [ ] Work Order status timeline component: Created → Assigned → En Route → On Site → Completed (on WO detail page)
- [ ] Site survey photo capture per device: wire the existing photoRef to Supabase Storage upload + thumbnail display

### Sprint 3 — Design Coherence (Week 3)
- [ ] Build `<DataTable>` shared component → replace ad-hoc tables on: Customers, Work Orders, Dispatch roster, Inventory, Reps, Compliance, Sites, Products
- [ ] Build `<SlideOver>` shared component → replace ad-hoc slide-overs on: Customer edit, Site edit, WO new, Inventory item, Dealer onboarding steps
- [ ] Add skeleton loading to all 14 section list pages
- [ ] Add proper empty states to all 14 section list pages
- [ ] Add `@media print` stylesheet to quote approval page

### Sprint 4 — Operational Backbone (Month 2, Week 1–2) ✅ COMPLETE
- [x] CRM: Pipeline $ by stage on kanban header (weighted value per column)
- [x] CRM: Deal aging badge (red after 7 days no activity, amber after 3)
- [x] CRM: Lead → Opportunity conversion form (qualify button + SlideOver)
- [x] Properties: Health score on site list (formula: offline assets + overdue WOs → 🟢/🟡/🔴 chip per row)
- [x] Properties: Embedded Mapbox pin on site detail (geocoded from property address)
- [x] Inventory: Auto-deduct parts when marked Used on WO (join table: work_order_parts)
- [x] Inventory: Auto-create PO draft when on_hand < min_stock trigger + "PO Pending" badge
- [x] Dispatch: Mapbox split-view (board left, tech location pins right) + 📍 Map toggle
- [x] Dispatch: "En Route" + "On Site" columns added to job board

### Sprint 5 — Category-Defining Polish (Month 2, Week 3–4) ✅ COMPLETE
- [ ] EOS: L10 meeting facilitator with section timer + agenda runner
- [ ] EOS: Live Scorecard pulled from work_orders + permits + quotes tables
- [ ] To-Dos: Wire to EOS L10 section (appear in weekly meeting review)
- [ ] KB: Structured article content view (numbered steps, callout boxes, markdown renderer)
- [ ] KB: Related articles section via pgvector similarity (one SQL query)
- [ ] Work Orders: Customer signature capture on WO completion (canvas widget)
- [ ] Work Orders: Color-code calendar by technician
- [ ] Quotes: Quote versioning (V1/V2 panel on quote editor)
- [ ] Quotes: View tracking ("opened 3 times" on quote list)
- [ ] Customers: Full chronological timeline (calls + emails + WOs + quotes + events in one feed)
- [ ] Products: Image thumbnails in product list (image_url already in schema)
- [ ] Products: Pricing tiers (Standard / Preferred / Premium sell price per product)
- [ ] Site Survey: Survey health indicator on list (draft / devices added / AI ready / quoted)
- [ ] Site Survey: Survey share link (same pattern as quote approval page)
- [x] `/billing` — Full billing engine (see What's Live)
- [x] `/admin/dealers/[id]` — Dealer detail page (see What's Live)
- [x] `/reps` — Commission approval workflow (see What's Live)
- [x] `/reps/[id]` — Rep detail page (see What's Live)
- [x] `/compliance` — Permit detail SlideOver + document attachments + renewal reminders cron
- [x] `/map` — Real Mapbox GL JS v3.3.0, live geocoded pins, health-colored markers
- [x] `/scorecard` — Ranked leaderboard table, trophy badges, sparkline trends
- [x] `/training` — End-of-course quiz engine, PDF certificate generation, prerequisite gating
- [x] `/training/admin` — Admin progress dashboard

### What 10/10 Actually Looks Like Per Section (target state)
| Section | Current | Target Benchmark | Key Gap |
|---------|---------|-----------------|---------|
| Dashboard | 6/10 | AppFolio + ServiceTitan | Live data + sparklines + drill-down |
| To-Dos | 7/10 | Linear + ClickUp | EOS L10 integration + bulk ops |
| EOS | 6/10 | Ninety.io + EOS One | Persistence + L10 timer + live Scorecard |
| CRM | 7/10 | HubSpot + Pipedrive | Pipeline analytics + enrichment + aging |
| Customers | 7/10 | ServiceTitan + Buildium | Timeline feed + health score + bulk import |
| Quotes | 8/10 | Quotient + PandaDoc | PDF + e-sign + versioning |
| Tech Tool | 9/10 | Category-first | PWA + offline + photo capture |
| KB | 7/10 | Zendesk Guide | Structured content + related articles |
| Products | 7/10 | ServiceTitan Pricebook | Images in list + pricing tiers |
| Properties | 7/10 | SmartRent + AppFolio | Health score + photos + map |
| Work Orders | 7/10 | ServiceTitan + MaintainX | Rename + timeline + signature |
| Dispatch | 7/10 | ServiceTitan Dispatch | Map view + En Route/On Site columns |
| Inventory | 6/10 | ServiceTitan + Jobber | WO integration + auto-reorder |
| Site Survey | 8/10 | Category-first | Photos + health indicator + share link |

### Non-Negotiable Visual Standards (enforce every session)
- **Never ship a page with hardcoded data** — if the query isn't built yet, show a skeleton + "coming soon" badge, not fake numbers
- **Never ship a list page with no empty state** — every page that can return 0 rows needs an `<EmptyState>` component
- **Every form field uses the same height/padding** — h-9 input, consistent focus ring color `#6B7EFF`
- **Status always uses color + icon** — never color alone (red dot only is not accessible)
- **Spacing follows 8px grid** — use p-2/p-4/p-6/p-8 (8/16/24/32px). Never p-3, p-5, p-7.
- **Cards use consistent border** — `border border-border rounded-xl` everywhere
- **Tables use `<DataTable>` shared component** — no ad-hoc `<table>` tags on any page after Sprint 3

---

## THE NORTH STAR — GateGuard AI Engine (Read Every Session)

**Russel's directive, May 2026 — permanent, compounding, non-negotiable:**

> "I want all our AI, including ARIA, to not only be the best but cost-effective and leverage other AI to build our AI engine to a level not even remotely achievable by any other. AI tools are just that — tools that will feed and be at the disposal, like employees, of our more powerful AI engine. And when we think we are the best, it is time to level up again, and then continue this process."

### What This Means in Practice

GateGuard is not building features that use AI. GateGuard is building **an AI engine** that uses features.

The distinction:
- **Wrong framing**: "We added Claude to our portal"
- **Right framing**: "We built an AI engine. It runs on Claude today. Tomorrow it will orchestrate Claude + GPT-4o + Gemini + specialized models as interchangeable compute workers under a unified GateGuard intelligence layer."

### The Architecture Vision

```
GateGuard AI Engine (the brain — our IP, our moat)
  ├── Orchestration layer — routes tasks to the right model/tool
  ├── Memory layer — cross-session context, learned patterns, dealer DNA
  ├── Signal layer — ingests real-world data (reviews, permits, hardware telemetry)
  └── Output layer — emails, quotes, diagnostics, proposals, alerts
        ↓ dispatches to:
        ├── Claude (Anthropic) — reasoning, drafting, KB
        ├── GPT-4o (OpenAI) — embeddings, vision fallback
        ├── Gemini — document processing, multimodal
        ├── Perplexity / Tavily — live web research
        ├── ElevenLabs / Whisper — voice (TRINITY)
        ├── Specialized models — LPR, predictive maintenance, churn scoring
        └── External APIs — Brivo, Eagle Eye, UniFi, DirecTV, Hunter, Apollo
```

No single model is the engine. The engine is GateGuard's orchestration, memory, and signal layer. Models are interchangeable workers hired and fired based on cost/performance.

### The Compounding Loop

1. Ship a capability (ARIA researches properties)
2. Measure what works (which signals → which reply rates)
3. Feed results back into the engine (winning patterns become training data)
4. Level up — when we're the best at X, begin X+1
5. Repeat forever

**Current level**: ARIA generates personalized outreach from AI-synthesized data
**Next level**: ARIA researches real properties via live web search (Tavily)
**Level after**: ARIA learns which email angles win per property class/manager profile and self-improves
**Level after that**: ARIA proactively surfaces targets without being asked, ranked by buy probability

### The AI Army — Current Agents

| Agent | Role | Status | Next Level |
|-------|------|--------|------------|
| ARIA | Lead Intel + Campaign Gen | Live (Claude-only, synthetic data) | Real web search, self-learning reply rates |
| TRINITY | Voice (inbound/outbound) | Active | Emotional tone matching, objection handling |
| SCOUT | Market intelligence | Active | Competitive monitoring, permit filing alerts |
| BEACON | Client communications | Inactive | Automated QBR drafts, NPS follow-up |
| FORGE | Quote builder | Active | Auto-quote from site survey, margin optimization |
| ATLAS | DirecTV channel | Active | MDU contract expiry detection, ARS prediction |
| SAGE | Training | Inactive | Adaptive learning paths per dealer scorecard |
| RELAY | Tier-1 support | Inactive | Ticket auto-resolve, escalation prediction |

### Non-Negotiable Principles

- **Cost discipline**: always benchmark model cost vs output quality. Use Haiku where Haiku is enough. Reserve Opus for tasks that genuinely need it.
- **No vendor lock-in**: the engine abstracts model providers. Swap Claude for any model without rewriting business logic.
- **Memory is the moat**: what GateGuard knows about each dealer, property, and decision maker compounds over time. That accumulated context is harder to copy than any individual model call.
- **Every output teaches the engine**: resolved diagnostic sessions → KB articles. Opened emails → campaign templates. Accepted quotes → pricing models. Nothing is throw-away.

---

## DEPLOYMENT ENVIRONMENTS — Beta vs Live (Starting Week of May 18, 2026)

GateGuard is going live. Two parallel Vercel deployments must exist from this point forward.

| Environment | URL | Vercel Project | Branch | Supabase Project | Purpose |
|-------------|-----|---------------|--------|-----------------|---------|
| **Beta** | beta.portal.gateguard.co | gateguard-portal-beta | `beta` | Supabase Beta project | Staging, dealer onboarding, safe to break |
| **Live** | portal.gateguard.co | gateguard-portal | `main` | Supabase Prod project | Real dealers, real data. NEVER break. |

### Rules for working in this repo going forward

- **All new feature work goes to `beta` branch first.** Never code directly on `main`.
- **`main` only gets merged into after Russel explicitly approves from beta.**
- **Production migrations (`main` Supabase) must be reviewed before running** — always test on beta Supabase first.
- **Env vars are separate** between beta and live Vercel projects. Never copy prod keys to beta.
- When building features, always ask: "Is this safe to ship to live, or does it go to beta first?"
- The SOC (`ggsoc.com`) has been live — treat it with the same care as the live portal.

### What's on Live now (as of May 19, 2026)
- `/tech` field tool v10 — used by real techs in the field; survey screen now has **☁ SAVE TO PORTAL** button that POSTs to `/api/surveys` with `x-tech-code` auth
- `/survey` — flagship site survey page: survey list + detail view, voice/Plaud capture, AI SOW + BOM generation via Claude Haiku, Create Quote from survey flow
- `/quotes` — quote list (all statuses)
- `/quotes/new` — **mode picker**: Line Item Builder (product catalog search, sections, optional items, package tiers, real API save → `/api/quotes`) + Survey Wizard (real API save)
- `/quotes/[id]` — **full Quotient-style editor**: section grouping, optional item toggles, package filter bar, rich pricing sidebar with discount/tax/deposit, PATCH line items
- `/quotes/[id]/approve` — **fully wired to real data** via `/api/quotes/[id]/public` (no-auth public endpoint): package tier selector, optional item checkboxes, approve/decline posts to Supabase
- Show lead capture at `/show` (Atlanta show leads, 30+ captured)
- Full CMMS (work order detail, checklist, comments, parts, request portal, email notifications)
- CRM full wiring — leads list/detail, opportunities detail, kanban with drag-drop
- CRM Log Activity form — Call/Email/Meeting/Note/Task with outcome tracking
- Dispatch — job board + tech roster + per-tech week calendar view
- `/maintenance` — work order list + **scheduling calendar view** (week grid, status-colored chips)
- `/sites` + `/sites/[id]` — property list + detail with asset tracking + PM schedules tab
- `/admin/dealers` + `/admin/dealers/new` — 7-tier dealer onboarding wizard with commission config
- `/eos` — EOS One mirror (Rocks, Scorecard, Issues, To-Dos, L10)
- `/reps` — Rep hierarchy + commission model breakdown; first_name/last_name split fixed (was single `name` field)
- `/migrate` — SARA Bridge migration wizard (Coming Soon banner)
- `/crm` — Full CRM dashboard: `+ New` dropdown (Opportunity/Customer/Dealer/Sales Rep), drillable KPI cards, "My Leads" panel with source chips, Log Activity modal (Call/Email/Meeting/Note/Task), assignable-org scope by tier
- `/crm/leads` + `/crm/leads/[id]` — Lead list + full lead detail page
- `/crm/opportunities` — Kanban board with drag-drop (dnd-kit), pipeline summary bar
- `/crm/opportunities/[id]` — Opportunity detail: stage progress, Log Activity, AI Sales Assistant, contact roles, stage history; emailForm reset bug fixed
- `/customers` — Org hierarchy viewer: **all 8 tiers** (Corporate→Master Agent→MSO→Dealer→Service/Install/Sales Partner→Client), wired to live Supabase via `/api/customers`
- `/customers/[id]` — Customer detail: live data from `/api/customers/[id]`, shows sites, child orgs, recent WOs, asset stats; Edit slide-over PATCHes API
- `/compliance` — Permit tracker wired to live Supabase via `/api/permits` + `/api/permits/[id]`; uses `permits_with_status` Supabase view for auto-computed status + days_remaining
- `/scorecard` — Dealer scorecard **fully wired**: live weighted score computed from real WO + permit data (last 90 days). Weights: Response Time 25% · FCR 25% · Compliance 20% · On-Time WOs 20% · NPS 10%. GateGuard Certified badge ≥ 80. **Sprint 5:** ranked leaderboard table (default view), trophy badges for top 3, sparkline trend lines, dealer self-view scoped for `dealer` role users
- `/training` — Training & certification progress **persisted to Supabase** via `/api/training/progress`; optimistic UI updates, per-chapter completion tracking, real progress bars + course badges. **Sprint 5:** end-of-course quiz (8 questions, 80% pass threshold, 3 attempts), PDF certificate generation (landscape, GateGuard branded, 1-year expiry), course prerequisite gating (UL 325 requires LVF), My Certificates panel, exam attempts counter
- `/training/admin` — Admin progress dashboard: enrollment stats, per-user completion DataTable, Reset Attempts + Revoke Cert actions
- TopBar — Now fully interactive: expandable search with quick-jump shortcuts, notification bell dropdown, profile dropdown with sign out
- `/api/crm/assignable-orgs` — Returns orgs a user can assign to, scoped by their org tier
- Transactional email via Resend (`resend` package added) — used by email send in opportunity detail
- **Sprint 4 additions:**
- `/dispatch` — En Route + On Site columns added to job board; Mapbox split-view (board left, tech location pins right) with 📍 Map toggle
- `/sites` list — Health score chip per row (🟢/🟡/🔴) computed from open WOs + offline assets
- `/sites/[id]` — Embedded Mapbox pin from property address geocoding
- `/crm/opportunities` — Pipeline $ by stage on kanban header (weighted value per column)
- `/crm/leads/[id]` — Deal aging badge (red >7 days / amber >3 days no activity), Qualify as Opportunity button + SlideOver
- `/inventory` — Mark as Used deducts `on_hand`; auto-PO draft + "PO Pending" badge when stock drops below `min_stock`
- **Sprint 5 additions:**
- `/billing` — Full billing engine: live invoices from Supabase, Stripe payment links (ACH + cards), commission payout tracking, QuickBooks Online outbound sync. GateGuard billing model: Video Monitoring flat fee + Access Plan $5/unit/month. Invoice numbers: GG-INV-NNNNNN continuing from QB sequence (started at 120045)
- `/admin/dealers/[id]` — Full dealer detail page: 5 tabs (Overview, Properties, Work Orders, Commission History, Documents), onboarding stepper progress, edit SlideOver
- `/admin/dealers` list — Rows now navigate to dealer detail; dealer health summary chip added per row
- `/admin/dealers/new` — Step 3 org search replaced with search-as-you-type autocomplete picker
- `/reps` — Commission approval workflow: approve/hold/mark paid per row + bulk actions; hierarchy tree view; commission MTD shows earned dollars
- `/reps/[id]` — Rep detail page: 30/60/90d pipeline breakdown, deal history, commission timeline
- `/compliance` — Permit detail SlideOver with edit mode, document attachments (Supabase Storage), renewal reminders cron (daily at 9am via Resend `/api/cron/permit-reminders`), per-site filtering
- `/map` — Real Mapbox GL JS v3.3.0 integration: live sites data, geocoded property pins, health-colored markers (green/amber/red) with popups, sidebar panel synced to live Supabase data
- **Most recent session additions (May 21 2026):**
- `/trinity` — Full TRINITY voice AI dashboard: live call feed, call history table, sentiment scores + labels, outcome tracking. Dark two-tone UI matching /tech. Backed by `trinity_calls` Supabase table (migration 062).
- `/events`, `/incidents`, `/documents`, `/analytics`, `/alerts` — polished placeholder pages with demo data, all added to Sidebar under Operations.
- `lib/email-templates.ts` + `lib/email-sender.ts` — 7 HTML transactional email templates + safe Resend wrapper. Dark navy `#0B1728` header, `#6B7EFF` CTA. Used by dealer onboarding send-docs flow.
- `/api/admin/dealers/send-docs` — auto-fires NDA + Agreement emails on new dealer creation with tier-appropriate doc selection.
- **CRM bug fixes**: opportunity contacts now persist (RLS fixed via migration 063 on `opportunity_contacts` + `opportunity_stage_history`); `saveContact()` checks `res.ok` + shows error banner; `deleteContact()` added; contact cards show email/phone with hover × delete button.
- **Google Calendar OAuth fix**: callback now writes to dedicated `gcal_refresh_token`, `gcal_connected_at`, `gcal_last_synced_at` columns on `user_settings` (migration 053) instead of broken key/value pattern.
- **Master Agent visibility fix**: `/api/admin/dealers` now uses `.in('org_tier', [all 6 partner tiers])` allowlist — previous `.not('org_tier', 'eq', 'corporate')` was silently excluding `master_agent` rows.
- **Survey Wizard fix**: CRM Import jumps to step 2 after importing a survey (not step 1), carries `opportunity_id`, shows "Survey imported — BOM pre-loaded" banner. API response parsing fixed (`d.records` not `d.opportunities`); search param fixed (`&q=` not `&search=`). CRM Import card moved to top of form.
- **Quote calculator updates**: Gate Operator Service Plan renamed from "Entry Gate Repair Plan" + amber disclaimer that physical gate structure is NOT covered. Physical Gate Coverage added as separate add-on ($250/gate/month: steel gate, tracks, hinges, rollers, structural). Ramp-Up Plan section added to quote wizard step 4 (30/60/90 day 3-phase toggle + notes field).
- **Gate Operator Service Plan fix (May 21 2026):**
  - Gate Operator Service Plan is now INCLUDED in the base plan — not optional, not billable. Removed the toggle from the wizard UI. Line item shows with `billing: 'included'`, `unitPrice: 0`. Description: "operators, wiring & control equipment (Included with base plan)". Always generated when `entryGates > 0`.
  - Physical Gate Coverage remains the OPTIONAL add-on at $250/gate/month for the iron/steel gate structure (panels, tracks, hinges, rollers). Toggle remains.
  - Default `entryGates` changed from `1` → `0` in the wizard initial state.
  - `GateMaintenanceSurvey.enabled` field kept for backwards compat but is now always `true`; no UI toggle.
  - PRICING NOTE (`types/quote.ts`): Gate Operator Service Plan is included (not a billable add-on). Physical Gate Coverage = $250/gate/month (optional add-on).

- **Session additions (May 25 2026) — Sidebar restructure + new pages:**
- **Sidebar — Business section reordered**: Operating System · Customers · Billing · **Expenses** (new) · **Vendors** · Revenue · Contracts · Renewals · Events · Analytics. Feed/Messages/Incidents removed from Business.
- **Sidebar — Field & Tech**: Incidents moved to first item (before Tech Tool).
- **Sidebar — Internal section** (corporate `isCorporate` only, hidden from all other tiers): Playbooks · Cost Tracking. Double-gated: section-level AND item-level checks.
- **Sidebar — Social panel** (bottom, replaces "Live Integrations"): collapsible section with The Feed (`/feed`), Messages (`/communications`), Email (`/email`, "Soon" badge). State: `socialExpanded`. Label: "Social" with MessageSquare icon.
- `/expenses` — Expense tracking page: summary cards (This Month · Pending · Parts & Matls · Software), category filter rail, full table with vendor/category/description/tech/amount/status columns, approve/pending status badges. Gated by `showFinancials`.
- `/email` — NEXUS Email inbox: three-panel layout (folder rail + connected accounts → thread list → thread detail/compose). Gmail OAuth connect flow. Folders: Inbox · Sent · Starred · Archived. Labels: Internal · Quote · Vendor · Compliance · Support. Compose + Reply. Gated by general access.
- **`app/api/incidents/ingest/route.ts`** — Fixed empty file (was causing `is not a module` Vercel build error). Now a proper POST endpoint for ingesting incidents from external sources (GGSOC bridge, webhooks, hardware alarms).
- **Service Marketplace** (`/services`) — Enterprise redesign: real provider logos from `/public/logos/` (`att.png`, `directv.png`, `gateguard.png`, `latch.png`, `xfinity.jpg`, `keystone.jpg`, `luxor.jpg`). `ProviderLogo` component with `LOGO_FILES` map handles mixed .png/.jpg extensions; falls back to styled initials if logo missing. Removed all emoji icons. Clean category pills, denser card grid, professional pricing strips modeled on Salesforce AppExchange.

- **Session additions (May 25 2026 — continued) — Sprint 226 + portal polish:**
- **Sprint 226 complete** — `/eos` To-Dos tab fully rebuilt as Monday.com-style data grid:
  - Rows grouped by status: Open · In Progress · Blocked · Done (each group collapsible with animated chevron)
  - Inline cell editing: click any task name / owner / due date / meeting field → input appears → blur or Enter saves via PATCH API
  - Status chips: clickable dropdown per row (Open / In Progress / Blocked / Done). Selecting "Done" fires PATCH with `done: true`; moving out of Done fires PATCH with `done: false`
  - Priority chips: High (rose) / Medium (amber) / Low (sky) / none — local state, no DB migration needed
  - Bulk checkbox select: select-all in header, per-row checkbox. Bulk action bar: "Mark Done" + "Delete"
  - Overdue highlighting: due dates < today shown in red on non-Done rows
  - "+ Add item" inline row at bottom of each group; "+ Add To-Do" header button drops into Open group
- **Reps commission model tiles** — redesigned: removed all `note` description text. Tiles now larger (`rounded-xl border-2 p-5`), rate at `text-3xl font-extrabold`, tier name `text-xs font-semibold`, "per unit / mo" label. 5-col desktop / 2-col mobile grid.
- **CRM fixes**: Pipeline Flow Bar full width; Open Opportunities sorted newest-first; My Leads "+ Assign" button removed (shows assigned dealer name badge or "Unassigned" chip instead)
- **Reps API scoping** (`GET /api/reps`): corporate → all; dealer admin tiers → all in org; `sales_partner` → self + direct reports + sub-reports (2 levels) via `clerk_user_id` lookup
- **New API routes**: `app/api/contracts/route.ts` (GET list + POST create with GG-CTR-XXXXX numbering), `app/api/renewals/route.ts` (GET 90-day expiry bucket), `app/api/training/reset-attempts/route.ts` (POST delete quiz chapters by user)

- **Session additions (May 25 2026 — continued) — EOS bug fixes + L10 meeting attendee system:**
- **`lib/eos-org.ts`** (NEW) — Centralized helper `resolveEosOrgId(user)`. Corporate admin users (e.g. rfeldman@gateguard.co) have no `org_id` in Clerk `publicMetadata` (predates the org_id requirement). The old null-fallback UUID `'00000000-0000-0000-0000-000000000001'` doesn't exist in `organizations` → FK violation on all EOS INSERTs. Fix: when `user.org_id` is null, query `organizations` by `org_tier='corporate'` and return the real corporate org ID. Applied to all 10 EOS API routes.
- **EOS Rocks fix** — Rocks were silently failing to save (FK violation). Now uses `resolveEosOrgId` in `app/api/eos/rocks/route.ts` and `app/api/eos/rocks/[id]/route.ts`. Adding a second rock now works.
- **EOS V/TO lens contamination fix** — `VTOTab` was mounted once; switching between Global/My Dealership lenses didn't remount it, so `useState(() => mergeVTO(vtoInit))` lazy initializer never re-ran — My Dealership edits were PATCHing local data over global data. Fix: `key={vtoLens}` on `<VTOTab>` in `app/eos/page.tsx` forces React to unmount/remount on lens change, re-initializing all state from the new `vtoInit` prop. Global and local are now fully isolated.
- **`resolveEosOrgId` applied to all EOS routes**: `rocks/route.ts`, `rocks/[id]/route.ts`, `todos/route.ts`, `todos/[id]/route.ts`, `issues/route.ts`, `issues/[id]/route.ts`, `scorecard/route.ts`, `scorecard/[id]/route.ts`, `meetings/route.ts`, `vto/route.ts`
- **L10 Meeting attendee system** — Full contact picker on MeetingForm:
  - Fetches `GET /api/eos/meetings/attendee-suggestions` on mount → merged list from `technicians` + `organizations` (by primary_email), max 50, sorted by name
  - Search input with client-side filtering by name/email
  - Dropdown with source badges (🔧 Technician / 🏢 Org / ✏️ Custom)
  - Click-to-add with email dedup; custom attendee entry with inline email field
  - Amber `(no email)` indicator on chips for attendees without an email address
- **L10 Meeting "Send Invites" button** — on L10Tab meeting detail view:
  - `POST /api/eos/meetings/[id]/invite` → loads attendees, filters to those with email, builds universal `.ics` VCALENDAR string, sends via Resend with base64 `.ics` attachment
  - DTSTART resolved from: `next_meeting_at` → parse `time_of_day` on today's/next occurrence → fallback to tomorrow 9am UTC
  - Duration from `duration_minutes` field on meeting
  - Stores `invited_at` timestamp on meeting record (non-blocking PATCH)
  - Returns `{ sent, failed, skipped }` counts + per-attendee result array
  - UI: `inviteLoading` state, success/failure banner, "Last invited: …" timestamp display
- **`lib/email-sender.ts` updated** — Added `EmailAttachment` interface (`{ filename: string; content: string }`) and optional `attachments?: EmailAttachment[]` to `SendEmailOptions`. Passed through to Resend payload when present. Used by meeting invite route for `.ics` files.
- **New API routes**: `app/api/eos/meetings/attendee-suggestions/route.ts` (GET — merged contacts from technicians + orgs), `app/api/eos/meetings/[id]/invite/route.ts` (POST — send .ics calendar invites via Resend)

- **Sprint 6 additions (May 22 2026) — Design Section + Service Marketplace:**
- **Sidebar** — NEXUS primary brand mark (large, blue), "by GateGuard" subtitle confirmed. New **Design** section added between Field & Tech and Security with 4 items: Floor Plans, System Design, As-Builts, E-Sign. Permission: `showDesign` = corporate | master_dealer | full_dealer | install_contractor | service_dealer.
- `/services` — **Service Marketplace** first built: 22 services across 10 categories (TV, Internet, Video Monitoring, Package Lockers, Access Control, Smart Locks, Security, Network, Energy). Migration 070 backs the DB schema (service_catalog, dealer_service_enrollments, site_service_subscriptions).
- **Browse Services in quote builder**: `ServicePickerPanel` added to `/quotes/new` (both line-item and wizard modes) + `SvcPickerPanel` in `/quotes/[id]` (POSTs directly to API). Both panels have 18-service catalog, category tabs, search, MRR/commission estimates. Services drop in as recurring line items in "Recurring Services" section.
- `/design/floor-plans` — **Bluebeam + System Surveyor + D-Tools hybrid**. Full interactive canvas tool with 3 modes: **Survey** (System Surveyor — place devices from 20-device library, set condition/action/notes), **Design** (D-Tools — click-to-connect devices, cable type/length/terminal form, SVG connection lines color-coded by cable type), **Markup** (Bluebeam — text annotations via SVG layer). Left dark navy panel: category-grouped device library (survey mode) / device list for connecting (design mode) / annotation tools (markup mode). Drag-to-reposition devices. BOM auto-generated from placed devices. Right panel: device properties form (survey) / wire schedule table (design). Connection form modal: cable type, length, from/to terminal. Export PDF + Share Link. 2 demo properties preloaded (Sunset Commons, Riverview Apts). New plan creation modal. Key data: `DEVICE_TYPES` (20 types across 7 categories), `DEMO_PLANS` with devices + connections.
- `/design/system` — Wire schedule + I/O block diagram. Wire Schedule tab: table (From Device → Terminal → Cable → Length → Terminal → To Device). I/O Diagram tab: SVG auto-layout block diagram with device boxes + annotated connection arrows. BOM table at bottom.
- `/design/as-builts` — GateGuard-branded as-built doc generator. Dark navy NEXUS header, property info table, 4 sections (Device Schedule, Wire Schedule, BOM, Site Notes), signature block. `window.print()` with `@media print` CSS.
- `/design/esign` — E-sign management dashboard. Stats bar (pending/viewed/signed/total), document table with status badges (color + icon), Send Reminder / Copy Link / View actions, New Document slide-over form.
- `/design/esign/sign/[token]` — Public signature page (no auth). Document summary card, 500×200 touch/mouse canvas, Clear + Sign & Complete buttons, legal disclaimer, signed confirmation state.
- **Migration 070** — `service_catalog`, `dealer_service_enrollments`, `site_service_subscriptions` tables. RLS + service_role_all. 22 services seeded with ON CONFLICT DO NOTHING. Run on beta Supabase before enrollment persistence works.
- **Migration 071** — `floor_plans`, `floor_plan_devices`, `floor_plan_connections`, `floor_plan_annotations`, `esign_documents` tables. RLS + service_role_all policies. Run on beta before design data persists.

- **Critical Gaps Roadmap (May 22 2026)** — 34 professional apps audited across 10 categories. Sprint 6-10 roadmap established:
  - **Sprint 6** (current): Design section (Floor Plans, E-Sign, As-Builts, System Design) ✅ built
  - **Sprint 7**: Job Costing (actual vs. quoted P&L), AR Aging + Collections, Warranty/RMA, Live Parts Pricing (ADI Global API)
  - **Sprint 8**: GPS Fleet Tracking (Samsara-tier), Route Optimization AI, COI Tracking, Review Management (Podium-replacement)
  - **Sprint 9**: PMS Integrations (Yardi/AppFolio/RealPage), Permit Auto-Filing (ATLAS), Subcontractor Portal, Payroll Integration (Gusto/ADP)
  - **Sprint 10**: System I/O Designer (D-Tools SI replacement, FORGE-powered), Digital Twin, CEU/License Tracking, Energy Intelligence

### Pending / Next Up
- [x] Lead → Opportunity conversion flow (qualify button on lead detail) ✅ Sprint 4
- [x] Territory Map (`/map`) — now live with Mapbox GL JS v3.3.0 ✅ Sprint 5
- [ ] Master Agent onboarding — invite flow + org setup
- [ ] `RESEND_API_KEY` env var must be set on Vercel beta + prod for email to work
- [ ] `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` must be set on Vercel for billing payment links
- [ ] `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REALM_ID`, `QBO_ACCESS_TOKEN` — for QuickBooks Online sync (optional)
- [ ] Migration 021 — `training_progress` + `dealer_scorecards` tables: run on beta Supabase, then prod
- [x] Migration 050 — `invoices` + `invoice_line_items` + `commission_payouts` tables: ✅ deployed on beta (May 2026)
- [x] Migration 051 — billing columns on `sites` table: ✅ deployed on beta (May 2026)
- [x] Migration 052 — `permit_documents` table enrichment: ✅ deployed on beta (May 2026)
- [ ] Client portal at `portal.gateguard.co/[site-slug]` — property manager dashboard (Brivo + Eagle Eye, no direct login to either). Clerk 'client' role. Supabase RLS by org. See `app/[site-slug]/page.tsx`.
- [ ] EOS page (`/eos`) — persistence to Supabase (currently in-memory only)
- [ ] PWA manifest for /tech (techs "Add to Home Screen")
- [ ] Photo evidence on work orders
- [ ] LPR integration (Eagle Eye LPR → Brivo credential or gate relay)
- [ ] Monthly client report auto-PDF
- [ ] `/quotes/[id]/proposal` — customer-facing proposal view (styled read-only version of quote)
- [ ] Site Survey photo capture per device (framework in place, needs UI hookup)

### Permission layer (built May 2026, pending commit)
`lib/current-user.ts` exposes `canViewWOs`, `canViewSites`, `canViewCRM`, `canViewCommissions`, `canViewNetwork`, `canViewDispatch`, `canViewSensitive`, `canViewFinancials` booleans computed from `org_tier` + `role`. `lib/org-scope.ts` `resolveOrgScope()` routes each tier to the correct Supabase filter. `components/layout/Sidebar.tsx` gates nav items by `org_tier` so each tier only sees their relevant sections.

### What's beta-only until further notice
- User Management (`/admin/users`) — needs Clerk integration testing
- Offline PWA (service worker) — needs field testing
- PM scheduling engine API + cron (`/api/pm-schedules`, `/api/cron/pm-schedules`) — tables built, migration 017 must run on prod Supabase first
- Training + Scorecard APIs (`/api/training/progress`, `/api/training/admin-progress`, `/api/scorecard`) — depend on Migration 021 (`training_progress` + `dealer_scorecards` tables)
- Email send/track (`/api/crm/email/send`, `/api/crm/email/inbound`, `/api/track/open`) — depend on Migration 020 (`crm_activities` email columns)

### Migration 017 — dealer network (MUST RUN ON PROD BEFORE DEALER ONBOARDING GOES LIVE)
`supabase/migrations/017_dealer_network.sql` adds:
- `org_tier` enum: `corporate | master_agent | master_dealer | full_dealer | service_dealer | install_contractor | sales_partner | client`
- `commission_config` table — per-org commission rates with pool validation (sales_partner + service_dealer ≤ $4.00)
- `dealer_add_ons` table — per-add-on 50/50 splits
- Columns on `organizations`: `org_tier`, `parent_org_id`, `is_active`, `onboarded_at`
Run on beta first, verify, then prod.

### Migration 020 — email tracking (run before email send/track features go live)
`supabase/migrations/020_email_tracking.sql` adds columns to `crm_activities`:
`sent_via_resend`, `resend_message_id`, `opened_at`, `open_count`, `to_email`, `from_email`, `email_status`
Run on beta first, verify `/crm/opportunities/[id]` email send, then prod.

### Migration 021 — training + scorecard (MUST RUN ON BETA BEFORE TRAINING/SCORECARD PAGES GO LIVE)
`supabase/migrations/021_training_scorecard.sql` adds:
- `training_progress` table: `user_id text` (Clerk ID), `org_id uuid`, `user_name text`, `user_email text`, `course_id text`, `chapter_id text`, `completed_at timestamptz`. Unique constraint on `(user_id, course_id, chapter_id)` for safe upserts.
- `dealer_scorecards` table: monthly snapshot cache with period `char(7)` ("YYYY-MM") — for historical trend tracking
- Both tables: RLS enabled + `service_role_all` policy
- Depends on: `organizations` table (017) and Clerk user IDs in `user_id`
Run on beta first, verify `/training` + `/scorecard` pages, then prod.

### Migration 022 — opportunity document tracking
`supabase/migrations/022_opportunity_type.sql` adds to `opportunities` table:
`documents_status` (jsonb checklist), `approved_at`, `approved_by` + indexes on `opp_type` and `approved_at`
Run on beta first, verify opportunity stage checklists, then prod.

### Migration 041 — surveys table
`supabase/migrations/041_surveys.sql` creates the `surveys` table:
- `id uuid PK`, `org_id uuid`, `survey_number text` (auto-generated), `property_name text`, `property_address text`
- `site_id uuid`, `opportunity_id uuid`, `surveyor_name text`, `surveyor_type text` (sales|tech|pm)
- `survey_date date`, `voice_transcript text`, `notes_raw text`, `devices jsonb[]`, `photos text[]`
- `status text` (draft|complete|quoted), `ai_summary text`, `quote_id uuid`
- `created_at`, `updated_at` timestamps; RLS enabled + service_role_all policy
Run on beta Supabase first, verify `/survey` page + `/api/surveys`, then prod.

### Migration 042 — quotes enrichment
`supabase/migrations/042_quotes_enrich.sql` adds to `quotes` table:
`quote_mode text` (line_item|wizard|package_mode), `client_name text`, `client_email text`, `client_phone text`,
`property_address text`, `cover_message text`, `terms_text text`, `tax_rate numeric`, `discount_percent numeric`,
`deposit_percent numeric`, `package_mode boolean`, `selected_package text`, `created_by_name text`, `expiry_date date`
Adds to `quote_line_items`: `section_name text`, `item_type text` (product|labor|material|fee), `is_optional boolean`,
`is_included boolean`, `package_tier text` (basic|standard|premium), `image_url text`, `model_number text`,
`notes text`, `sku text`
Run on beta first, verify `/quotes/new` + `/quotes/[id]` + `/quotes/[id]/approve`, then prod.

### Migration 050 — billing (MUST RUN ON BETA BEFORE /billing GOES LIVE)
`supabase/migrations/050_billing.sql` creates:
- `invoices` table: `id uuid PK`, `org_id uuid`, `site_id uuid`, `invoice_number text` (GG-INV-NNNNNN, starting at 120045), `status text` (draft|sent|paid|overdue|void), `subtotal numeric`, `tax_rate numeric`, `total numeric`, `due_date date`, `paid_at timestamptz`, `stripe_payment_link text`, `qbo_invoice_id text`, `created_at`, `updated_at`
- `invoice_line_items` table: `id uuid PK`, `invoice_id uuid FK`, `description text`, `quantity numeric`, `unit_price numeric`, `amount numeric`, `item_type text` (video_monitoring|access_plan|labor|parts|other)
- `commission_payouts` table: `id uuid PK`, `rep_id uuid FK`, `period char(7)` ("YYYY-MM"), `amount numeric`, `status text` (pending|approved|on_hold|paid), `approved_by uuid`, `approved_at timestamptz`, `paid_at timestamptz`, `notes text`
- All tables: RLS enabled + `service_role_all` policy
Run on beta first, verify `/billing` + `/api/billing`, then prod.

### Migration 051 — billing columns on sites
`supabase/migrations/051_site_billing.sql` adds columns to `sites` table:
`billing_video_fee numeric` (default 500.00), `billing_unit_rate numeric` (default 5.00), `billing_units integer`,
`contract_months integer` (default 36), `contract_start_date date`, `contract_end_date date`
Run on beta first, verify site billing tab in `/sites/[id]`, then prod.

### Migration 052 — permit documents enrichment
`supabase/migrations/052_permit_documents.sql` adds columns to `permits` table:
`documents jsonb` (array of {name, url, uploaded_at}), `inspector_name text`, `inspection_date date`,
`jurisdiction text`, `notes text`, `reminder_sent_at timestamptz`
Run on beta first, verify permit detail SlideOver + document upload in `/compliance`, then prod.

### Migration 062 — TRINITY calls table
`supabase/migrations/062_trinity.sql` creates the `trinity_calls` table:
- `id uuid PK`, `call_sid text` (Twilio SID), `direction text` (inbound|outbound), `from_number text`, `to_number text`
- `duration_sec integer`, `status text`, `transcript text`, `sentiment_score numeric`, `sentiment_label text`
- `outcome text`, `agent_name text`, `dealer_org_id uuid`, `property_name text`, `call_notes text`
- `created_at timestamptz`; RLS enabled + `service_role_all` policy
Run on beta first, verify `/trinity` page + `/api/trinity/calls`, then prod.

### Migration 063 — opportunity contacts + stage history RLS
`supabase/migrations/063_opportunity_contacts_rls.sql` enables RLS + adds `service_role_all` policy on:
- `opportunity_contacts` table (created in migration 008 without RLS policies — was causing silent insert failures)
- `opportunity_stage_history` table (same issue — created in migration 008)
Run on beta first, verify contact saves on `/crm/opportunities/[id]`, then prod.

### ⚠️ Known Build Gotchas (Vercel)

**lucide-react cached version mismatch (RESOLVED May 16 2026)**
Vercel cache key `Dop7xNgCwYZ1jorsYerLxuHLFa5B` holds an old lucide-react version that doesn't export many modern icons. The fix applied across the entire codebase: any icon not in the "definitely ancient" set is imported via:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Edit2, Timer, ArrowUpRight } = require('lucide-react') as any
```
This bypasses TypeScript module resolution entirely. Do NOT revert these to named ES imports without first verifying Vercel's cache has been busted.

**Safe named imports** (exist in all known cached versions): Plus, X, Check, Clock, Calendar, Search, ChevronLeft/Right/Down/Up, Users, Mail, Phone, Wrench, Shield, Building2, MapPin, User, Settings, Home, FileText, Download, Upload, Eye, EyeOff, Loader, Loader2, RefreshCw, Save, Trash2, AlertTriangle, Info, Bell, Menu, Filter, MoreVertical, MoreHorizontal, Package, Globe, Link, Send, MessageSquare, Star, Key, Copy, ExternalLink, Wifi, CheckCircle2, XCircle, Activity, WifiOff, ArrowRight, Hash, Zap, Layers, TrendingUp, ClipboardList

**Always require()**: Edit2, Edit3, Timer, Tag, Inbox, ArrowUpRight, ArrowLeft, Camera, DoorOpen, BookOpen, Cpu, BarChart3, DollarSign, Network, Tv, Archive, ShieldCheck, AlertCircle, Paperclip, PhoneCall, PhoneIncoming, PhoneOutgoing, Video, StickyNote, CheckSquare, Grid3X3, Truck, RotateCcw, Image, Target, Palette, Radio, GitBranch, SlidersHorizontal, Map, TrendingDown, CreditCard, Hammer, Server, and anything else not in the safe list.

**Supabase PromiseLike vs Promise**
`PostgrestFilterBuilder` returns `PromiseLike`, not `Promise`. Never use `.catch()` on it directly. Always use:
```typescript
// CORRECT fire-and-forget pattern
void (async () => {
  try { await supabase.from('table').select() }
  catch (_) { /* non-blocking */ }
})()
```

**`lib/current-user.ts` — `id` must be declared**
`getCurrentUser()` must extract `const id = user.id` from the Clerk user object before the return statement. If this line goes missing, TypeScript throws "No value exists in scope for shorthand property 'id'".

---

## APPLICATION LANDSCAPE (read this first — get it right every time)

GateGuard runs four distinct applications. Never confuse them.

| App | URL | Repo | Purpose |
|-----|-----|------|---------|
| SOC Operations | ggsoc.com | gateguard-dispatch-ui | Call center interface for SOC staff. Live production. Twilio, Brivo, Eagle Eye, Supabase. DO NOT BREAK. |
| Visitor Kiosk (legacy) | stonegate-visitor.vercel.app | (separate) | Single-property Brivo+Twilio kiosk. Fully deprecated — replaced by gatecard.co. Do not touch. |
| GateCard | gatecard.co | gatecard.co | **Property-level platform** — visitor management, resident kiosk, Brivo↔UniFi middleware, tenant self-service. Tier 2 interface deployed at every property. One codebase, N properties. All visitor/resident workflows belong here. |
| Dealer Portal | portal.gateguard.co | gateguard-portal (THIS REPO) | **Dealer-facing ops + field tech tool.** The OS for the GateGuard dealer network. Dealers, techs, sales reps, and property managers only. NOT residents, NOT visitors. |
| Client Portal | portal.gateguard.co/[site-slug] | gateguard-portal (THIS REPO) | **Property manager-facing dashboard.** Scoped to a single property. Mirrors Brivo Facility Manager UI with GateGuard branding. Pulls from dealer's Brivo + Eagle Eye credentials — property managers never log into Brivo directly. Route: `app/[site-slug]/page.tsx`. Phase 2. |

**CRITICAL BOUNDARY — enforce every time:**
- Visitor management → gatecard.co
- Resident database sync (Brivo ↔ UniFi) → gatecard.co
- Property kiosk UI → gatecard.co
- Dealer ops, field service, quoting, billing, KB → THIS REPO (portal)
- Client portal (property manager dashboard, Brivo/Eagle Eye data) → THIS REPO at `/[site-slug]`
- The portal's `/api/sync/residents` route is a LEGACY artifact — new sync work goes in gatecard.co

---

## PRODUCT VISION

**"The Operating System for Multifamily Access."**

GateGuard Portal is the single platform where dealers run their entire business: quoting, work orders, billing, field service, team management, and client reporting — all connected to live hardware (cameras, access control, networking). No competitor in multifamily access control has this.

The /tech field diagnostic tool is the #1 reason dealers choose GateGuard over competitors. It is the key differentiator and should always be kept best-in-class.

---

## DEALER HIERARCHY (5 tiers — data isolated per tier)

```
GateGuard Corporate (SO — System Operator)
  └── MSO (Multi-Site Operator) — large dealer group, multiple markets
        └── Dealer — core user, runs their day-to-day business
              └── Sub-Dealer — authorized reseller under a dealer
                    └── Sales Rep / Independent Rep — commission-based, may have sub-reps
                          └── Client (Property Manager) — end customer, read-only portal
```

**What each tier sees:**
- **GG Corporate**: All dealers, all clients, total MRR/ARR, rep network, commissions, dealer scorecards, co-op pool, full KB/product library
- **MSO**: Their child dealers, roll-up MRR dashboard, cross-site WO summary, all client properties, their rep network, bulk pricing tools
- **Dealer**: Their clients only, their sub-dealers, their reps + commissions, quotes + WOs, invoices + MRR, cameras for their accounts, tech tool access codes, KB + manuals, renewal tracker
- **Sub-Dealer**: Their clients only, their own WOs + quotes, their own reps, limited billing view, tech tool access. Cannot see parent dealer's clients.
- **Sales Rep**: Their pipeline only, commissions earned, their sub-reps, quote builder, client contact info. No billing/MRR, no camera access.
- **Client (Property Manager)**: Their properties only, open service tickets, approve quotes, view invoices + pay, camera clips, access logs, device health status.

**Key principle**: All data isolation enforced via Supabase Row-Level Security by org ID. Same database, filtered views — no custom builds per customer.

---

## GateGuard Billing Model

Two recurring line item types per property:
1. **Video Monitoring Fee** — flat rate per property (default $500/mo, covers up to 10 cameras)
2. **Access Plan** — $5.00 per living unit per month (includes gate service, Brivo, PMS integration, 36-month agreement)

**Invoice numbering:** GG-INV-NNNNNN continuing from QB sequence (started at 120045)

**Payment:** Stripe payment links (ACH + cards). Customers pay via link — no portal login required.

**QuickBooks Online:** Portal sends invoices outbound to QB. Portal never reads from QB. One-way sync only.

**Commission payouts:** Tracked in portal (`commission_payouts` table), admin approves + marks paid manually via `/reps`. No Stripe Connect — payouts are processed outside the platform.

---

## THIS REPO — portal.gateguard.co

**Who uses it:** GateGuard dealers, sub-dealers, sales reps, and field technicians. Also: client (property manager) read-only portal view. NOT residents. NOT visitors. NOT SOC agents.

**What it does:**
- Equipment library with PDF manual upload and vector search
- AI-powered troubleshooting wizard (KB) using pgvector + Claude
- Field tech tool at `/tech` — mobile-first diagnostic instrument for on-site techs
- CRM: leads, quotes, work orders, customers
- Rep & commission management (`/reps`)
- Permit & compliance tracking (`/compliance`)
- Territory map view (`/map`)
- Dealer scorecard & performance (`/scorecard`)
- Multi-site roll-up reports (`/reports`)
- Client portal (property managers log in to see their properties)

**The `/tech` route:**
- Lives at `portal.gateguard.co/tech` — NOT a separate domain
- Same codebase, same auth, mobile-optimized route
- Dealers print QR codes linking techs to `/tech?product_id=<sku>`
- PWA manifest to be added — techs can "Add to Home Screen"

**What does NOT belong here:**
- Visitor kiosk UX → gatecard.co
- Resident self-service, tenant portal → gatecard.co
- Brivo ↔ UniFi resident sync middleware → gatecard.co
- Inbound call handling (Twilio IVR) → gatecard.co
- SOC monitoring, alarms, live camera feeds → ggsoc.com (gateguard-dispatch-ui)

---

## Tech Stack
- Next.js 14.2 App Router, TypeScript
- Supabase (pgvector for KB embeddings, standard tables for everything else)
- Clerk auth — roles: `admin`, `supervisor`, `agent`, `dealer`
- OpenAI `text-embedding-3-small` (1536 dims) for PDF chunk embeddings
- Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) for AI diagnostic step generation
- Brivo API (access control)
- UniFi Network API (network/VLAN management)
- Mapbox GL JS v3.3.0 — territory map (`/map`), site detail pins, dispatch split-view. Env: `NEXT_PUBLIC_MAPBOX_TOKEN`. Get token: mapbox.com → account → Tokens. Free tier: 50K map loads/month.
- Resend — transactional email (WO notifications, CRM email send/track, dealer welcome emails, permit renewal reminders). Env: `RESEND_API_KEY`
- Plaud API — voice recording transcription for /tech site survey. Env: `PLAUD_CLIENT_ID`, `PLAUD_SECRET_KEY`. Register: platform.plaud.ai/developer
- Eagle Eye Networks API — live camera feeds, motion search, archive (`/cameras`)
- Twilio — SMS notifications (planned: renewal reminders, WO alerts) + TRINITY voice calls (inbound/outbound). Env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- ElevenLabs — TTS voice synthesis for TRINITY (optional). Env: `ELEVENLABS_API_KEY`
- Tavily — AI-optimized web search API powering ARIA Deep Intel. After ARIA returns a property, Tavily runs 4 parallel searches on the specific property name: ISP availability, bulk/included internet on listing sites, management company MDU patterns, resident forum posts. Returns live excerpts → Claude synthesizes into verified connectivity intel with source citations. Env: `TAVILY_API_KEY`. Register: app.tavily.com. Free tier: 1K searches/mo. Cost: ~$0.008/search or $30/mo for 10K.
- Stripe — invoice payment links for customer billing (ACH + cards). Env: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`
- QuickBooks Online — outbound invoice sync only (portal → QB, never QB → portal). Env: `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REALM_ID`, `QBO_ACCESS_TOKEN`

---

## All Routes

### Core Operations
- `/` — Dashboard: KPIs, accounts list, alerts, property intelligence cards (planned)
- `/customers` — Customer accounts with org hierarchy
- `/crm` — CRM pipeline: leads, opportunities, kanban
- `/crm/leads/[id]` — Lead detail
- `/crm/opportunities/[id]` — Opportunity detail
- `/admin` — Organization admin: 5-tier hierarchy, integrations

### Sales & Quoting
- `/quotes` — Quote list (draft/sent/viewed/accepted/declined/expired)
- `/quotes/new` — Quote builder
- `/quotes/[id]/proposal` — Customer-facing proposal view
- `/quotes/[id]/approve` — **CLIENT-FACING** approval page (no auth/sidebar). Property managers approve/decline via signed token link. Full-screen branded standalone page. (Route uses `[id]` segment — same level as `[id]/proposal`.)

### Business (sidebar section order: Operating System → Customers → Billing → Expenses → Vendors → Revenue → Contracts → Renewals → Events → Analytics)
- `/eos` — EOS Operating System (Rocks, Scorecard, Issues, To-Dos, L10)
- `/customers` — Customer accounts with org hierarchy
- `/billing` — Invoices + QuickBooks sync, MRR tracking
- `/expenses` — Expense tracking: summary cards, category filter rail, vendor/amount/status table. Gated: showFinancials.
- `/vendors` — Vendor management and POs
- `/revenue` — MRR trends, ARR, commission dashboard
- `/contracts` — Contract storage
- `/renewals` — Contract renewal tracking + alerts
- `/events` — Property event log (polished placeholder with demo data)
- `/analytics` — Analytics dashboard (polished placeholder with demo data)

### Field & Tech (sidebar section — Incidents is first item)
- `/incidents` — Incident tracker with Acknowledge workflow. First item in Field & Tech nav.
- `/maintenance` — Work orders: open, in-progress, scheduled, completed
- `/dispatch` — Job dispatch board, tech roster
- `/inventory` — Warehouse stock, van stock, POs
- `/reports` — Multi-site roll-up: MRR, WOs, camera uptime across all org tiers. Org tier filter. CSS bar chart.

### Dealer Network
- `/reps` — Sales rep hierarchy + commission tracker. Tier badges (Senior/Rep/Sub-Rep), parent relationships, pipeline value, commission MTD, payout history.
- `/compliance` — Permit & compliance tracker. Gate permits, fire marshal, HOA certs, expiry alerts. Status: compliant/expiring/expired. Alert banner for expired items.
- `/map` — Territory map. Property pins colored by health (green/amber/red). Requires Mapbox token (placeholder shown until connected).
- `/scorecard` — Dealer performance scorecard. Response time, FCR%, NPS, renewal rate, camera uptime. GateGuard Certified badge for 80+ scorers.

### Security & Hardware
- `/cameras` — Eagle Eye live feeds, 138 cameras, archive, motion search
- `/access` — Brivo access control, credentials
- `/network` — UniFi infrastructure, VLAN management

### Social (sidebar bottom panel — replaces "Live Integrations")
- `/feed` — The Feed: team wins, challenges, leaderboard
- `/communications` — Messages: team channels + DMs
- `/email` — NEXUS Email: three-panel inbox (folder rail + thread list + compose). Gmail/Outlook connect. Folders: Inbox · Sent · Starred · Archived. Labels: Internal · Quote · Vendor · Compliance · Support.

### Platform & Tools
- `/kb` — AI diagnostic engine (vector search + Claude)
- `/tech` — Field diagnostic tool v10 (see /tech section below)
- `/trinity` — TRINITY voice AI dashboard: live call monitoring, call history, sentiment scores, outcome tracking. Dark two-tone UI matching /tech.
- `/portal` — Customer portal (property manager read-only)
- `/survey` — Site survey tool (DVI enhancement planned)
- `/onboarding` — Customer onboarding
- `/visitor` — Visitor management
- `/products` — Equipment catalog (tags, field_service toggle, PDF manual upload)
- `/energy` — Energy monitoring
- `/deliveries` — Delivery tracking
- `/channel` — Channel partner program
- `/marketing` — Marketing hub
- `/marketing/social` — GateGuard social publishing
- `/marketing/dealer-social` — Dealer network content
- `/marketing/coop` — Co-op lead pool
- `/marketing/website` — Dealer hosted landing pages

### Internal (corporate `isCorporate` only — hidden from all other tiers)
- `/playbooks` — Step-by-step integration guides (GateGuard Corporate Admin + Tech Onboarding)
- `/admin/costs` — Cost Tracking: infra costs, unit economics, dealer P&L

### Auth
- `/sign-in/[[...sign-in]]` — Clerk sign-in (dark theme, GateGuard branded)
- `/sign-up/[[...sign-up]]` — Clerk sign-up

---

## Key API Routes
- `POST /api/kb/process` — chunk + embed a PDF already in Storage (JSON body: product_id, manual_url)
- `POST /api/kb/upload-url` — get Supabase signed upload URL for direct browser→Storage upload (bypasses Vercel size limit)
- `POST /api/kb/find-manual` — auto-find + download manufacturer manual, run full pipeline
- `POST /api/kb/extract-wiring` — Claude reads indexed chunks, extracts terminal definitions → device_suggestions table
- `POST /api/kb/ask` — AI diagnostic (vector search + Claude). Params: symptom, product_id, error_code, history, session_id, connected_devices[]
- `POST /api/kb/resolve` — Resolution capture + learning loop. Params: session_id, product_id, symptom, history, resolution_note. Updates troubleshoot_sessions.resolved + auto-embeds a kb_article so AI learns the fix. Auth: x-tech-code.
- `POST /api/kb/analyze-image` — Claude vision analysis of tech photos
- `GET  /api/kb/products` — product list for /tech (auth: x-tech-code header)
- `GET  /api/sync/residents` — LEGACY: Brivo → DB → UniFi sync. **New sync work belongs in gatecard.co, not here.**
- `POST /api/admin/dealers/send-docs` — auto-send NDA + Agreement emails on new dealer creation. Tier→doc mapping: master_agent/master_dealer → NDA-A, full_dealer/service_dealer/install_contractor → NDA-B, sales_partner → NDA-C.
- `POST /api/trinity/webhook` — Twilio call status callback + Claude sentiment analysis
- `POST /api/trinity/initiate` — initiate outbound TRINITY call
- `GET  /api/trinity/calls` — last 50 calls from `trinity_calls` table

---

## SALES & ONBOARDING ARCHITECTURE

### Org Tier Display Names (DB enum → UI label)
| DB Value | Display Label |
|---|---|
| corporate | GateGuard Corporate |
| master_agent | Master Agent |
| master_dealer | MSO — Master System Operator |
| full_dealer | Dealer |
| service_dealer | Service Partner |
| install_contractor | Installation Partner |
| sales_partner | Sales Partner |
| client | Client |

IMPORTANT: The DB enum value `master_dealer` stays as-is. Only the UI display label changes to "MSO — Master System Operator".

### Opportunity Types
CRM opportunities have an `opportunity_type` field that maps to the entity being sold to:
- `master_agent` — Prospective Master Agent
- `mso` — Prospective MSO (Master System Operator)
- `dealer` — Prospective Dealer
- `install_partner` — Prospective Installation Partner
- `service_partner` — Prospective Service Partner
- `sales_partner` — Prospective Sales Partner
- `property` — New Property (multifamily/HOA needing install/service)
- `company` — New Company (commercial business)
- `customer` — Existing customer needing new service

### Sales Cycles by Type
- Master Agent: Lead → Opp → NDA Sent → NDA Signed → Agreement Sent → Negotiation → Signed & Approved
- MSO: Lead → Opp → Agreement Sent → Negotiation → Signed & Approved
- Dealer: Lead → Opp → Agreement Sent → Signed & Approved
- Install/Service Partner: Lead → Vetting → Agreement Sent → Approved
- Sales Partner: Lead → Opp → Commission Agreement → Signed
- Property/Company: Lead → Opp → Site Survey → Quote Sent → Quote Approved → Signed → Install Scheduled
- Customer: Lead → Opp → Quote Sent → Quote Approved

### Onboarding Trigger ("Approve & Send Welcome")
Fires when opportunity = Won AND all required documents signed. Sends via Resend:
1. Welcome email with manual PDF link
2. Clerk portal invite (scoped to correct org tier)
3. Tier-specific welcome content (commission doc for MA, tech tool code for dealers, etc.)

For Property/Company wins: creates work order + site record + sends PM portal invite.

### Document Strategy
- NDA-A (Partner): Master Agent, MSO — full mutual NDA
- NDA-B (Dealer): Dealer, Install Partner, Service Partner — stronger one-way, protects dealer client lists
- NDA-C (Sales): Sales Partner — lightweight, protects leads/pricing only
- Agreements: One per tier (MA Agreement, MSO Agreement, Dealer Agreement, Install Partner Agreement, Service Partner Agreement, Sales Partner Agreement)
Install/Service Partner agreements have strongest non-solicitation clauses (they access client sites).

### Build Sequence
- Phase 1 (current): MSO display rename + opportunity_type field + type-based stage checklists
- Phase 2: Document templates in Supabase Storage + Documents section on opportunity detail
- Phase 3: "Approve & Send Welcome" trigger → org creation + Resend welcome + Clerk invite
- Phase 4: Property/Company win → auto work order + site record + PM invite

---

## Database
- `organizations` — 5-tier hierarchy (corporate → MSO → dealer → partner → client)
- `products` — equipment library (SKU, specs, manual_url, tags, field_service bool)
- `manual_chunks` — PDF chunks with 1536-dim embeddings (migration 004)
- `kb_articles` — authored troubleshoot articles with embeddings
- `troubleshoot_sessions` — diagnostic session logs
- `device_suggestions` — AI-extracted terminal definitions from manuals (migration 007). JSONB device_def + wiring_hints. status: ai_generated | verified | rejected. One row per product_id.
- `residents` — LEGACY: Brivo-sourced roster. New resident work → gatecard.co
- `sync_log` — LEGACY: Brivo/UniFi sync audit log. New sync work → gatecard.co

**Migrations:** 001 initial · 002 CRM · 003 products · 004 KB vectors · 005 DK seed · 006 sync tables · 007 device_suggestions ✅

**Planned tables (not yet migrated):** `reps`, `commissions`, `permits`, `service_packages`

Note: `/reps`, `/compliance`, `/scorecard`, `/map`, `/reports` are placeholder UI. Need DB tables + Supabase RLS to go live.

---

## Cron Jobs (vercel.json)
- `GET /api/sync/residents` — every hour

**Planned:** Renewal reminders (daily, Twilio SMS at 60/30/7 days), permit expiry alerts (daily), monthly property report PDF (1st of month)

---

## Env Vars Required
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` — PDF embedding
- `ANTHROPIC_API_KEY` — KB diagnostic Claude calls
- `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/`
- `BRIVO_API_KEY`, `BRIVO_CLIENT_ID`, `BRIVO_CLIENT_SECRET`
- `CRON_SECRET` — Vercel cron requests
- `TECH_ACCESS_CODE` — PIN for /tech without Clerk
- `NEXT_PUBLIC_MAPBOX_TOKEN` — Mapbox GL JS token for /map, site detail pins, dispatch split-view
- `PLAUD_CLIENT_ID` — Plaud developer API client ID (from platform.plaud.ai/developer)
- `PLAUD_SECRET_KEY` — Plaud developer API secret key
- `STRIPE_SECRET_KEY` — Stripe secret key for payment link creation (billing engine)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key
- `NEXT_PUBLIC_APP_URL` — e.g. https://portal.gateguard.co (used for Stripe redirect after payment)
- `QBO_CLIENT_ID` — QuickBooks Online OAuth client ID (outbound invoice sync, optional)
- `QBO_CLIENT_SECRET` — QuickBooks Online OAuth client secret
- `QBO_REALM_ID` — QuickBooks Online company ID
- `QBO_ACCESS_TOKEN` — QuickBooks Online OAuth access token
- `TWILIO_ACCOUNT_SID` — Twilio account SID for TRINITY voice calls
- `TWILIO_AUTH_TOKEN` — Twilio auth token
- `TWILIO_FROM_NUMBER` — Twilio phone number for outbound calls
- `ELEVENLABS_API_KEY` — ElevenLabs TTS for TRINITY voice (optional)
- `TAVILY_API_KEY` — Tavily web search for ARIA Deep Intel (4 parallel property-specific searches per deep research run). Get at app.tavily.com.

---

## Key Source Files

### /tech tool
| File | Purpose |
|------|---------|
| `app/tech/page.tsx` | All /tech screens. Screens: pin, home, choice, symptom, diag, wiring, cable, install, survey, survey_add. Survey screen has ☁ SAVE TO PORTAL button → POSTs to `/api/surveys` with x-tech-code. Demo modes: ?demo=install / ?demo=fault |
| `lib/wiring-library.ts` | Static verified device terminals (27 devices) + wiring maps (19 maps). Add hand-verified pairings here. AI-generated entries live in Supabase device_suggestions instead. |
| `components/tech/WiringDiagram.tsx` | SVG wiring diagram renderer + WiringGuide screen. Merges static library + Supabase device_suggestions at runtime. Terminal group separators show connector block ID badges (J2, J6, etc.). |
| `components/tech/CableGuide.tsx` | 3-tab cable testing guide: CAT / 2-wire series / 2-wire parallel |
| `app/api/kb/ask/route.ts` | Claude diagnostic API. Params: symptom, product_id, error_code, history, session_id, connected_devices[] |
| `app/api/kb/analyze-image/route.ts` | Claude vision for photo steps and multimeter readings |
| `app/api/kb/products/route.ts` | Product list for device picker (auth: x-tech-code header) |
| `app/api/kb/upload-url/route.ts` | Issues Supabase signed upload URL — auto-creates "manuals" bucket if missing — client uploads PDF direct, no Vercel size limit |
| `app/api/kb/process/route.ts` | Chunk + embed a PDF from Storage URL. Also accepts multipart (legacy). |
| `app/api/kb/find-manual/route.ts` | Auto-find + download manufacturer manual from the internet, run full pipeline |
| `app/api/kb/extract-wiring/route.ts` | Claude reads manual chunks → extracts DeviceDef terminals → stores in device_suggestions |
| `app/api/kb/survey-proposal/route.ts` | Takes site walk device inventory → Claude Haiku → returns structured proposal (summary, line items with priority, recommendations, install notes). Auth: x-tech-code. |
| `app/api/kb/parse-survey-transcript/route.ts` | Accepts a Plaud voice transcript or typed site walk notes → Claude Haiku → extracts structured SurveyDevice[] list (name, brand, model, location, condition, action, notes) + auto-detects property name. Auth: x-tech-code. |
| `app/api/plaud/transcribe/route.ts` | Native Plaud API integration. Accepts multipart audio file (m4a/mp3/wav/etc) → uploads to Supabase Storage → submits to Plaud transcription API → polls until complete → returns transcript text. Auth: x-tech-code. Env: PLAUD_CLIENT_ID, PLAUD_SECRET_KEY. |
| `app/api/kb/resolve/route.ts` | Resolution capture + learning loop. Updates troubleshoot_sessions.resolved + embeds kb_article from symptom+history+fix note. Auth: x-tech-code. |

### Survey + Quotes
| File | Purpose |
|------|---------|
| `app/survey/page.tsx` | Flagship survey page: survey list + detail, voice/Plaud capture, AI SOW + BOM, Create Quote flow |
| `app/api/surveys/route.ts` | GET (list surveys, org-scoped) + POST (create survey — accepts Clerk auth OR x-tech-code header) |
| `app/api/surveys/[id]/route.ts` | GET/PATCH/DELETE single survey |
| `app/api/surveys/[id]/generate/route.ts` | POST → Claude Haiku → AI SOW + BOM proposal from survey devices. Auth: Clerk. |
| `app/api/surveys/[id]/create-quote/route.ts` | POST → creates quote + line items from survey proposal. Auth: Clerk. |
| `app/quotes/new/page.tsx` | Mode picker: Line Item Builder (product catalog, sections, optional/package items, real API) + Survey Wizard (real API) |
| `app/quotes/[id]/page.tsx` | Full Quotient-style editor: section grouping, optional toggles, package filter bar, pricing sidebar |
| `app/quotes/[id]/approve/page.tsx` | Client-facing approval — no auth, no sidebar; fetches from public API; package tier selector, optional item checkboxes |
| `app/api/quotes/route.ts` | GET (list, org-scoped) + POST (create quote) |
| `app/api/quotes/[id]/route.ts` | GET/PATCH/DELETE quote |
| `app/api/quotes/[id]/items/route.ts` | GET (list items) + POST (add item) + DELETE (bulk delete) |
| `app/api/quotes/[id]/items/[itemId]/route.ts` | PATCH (update item incl. is_optional/is_included/package_tier) + DELETE |
| `app/api/quotes/[id]/public/route.ts` | No-auth public endpoint. GET: quote + items + org_name. POST: approve/decline with item selections. |

### Portal pages
| File | Purpose |
|------|---------|
| `components/layout/Sidebar.tsx` | Navigation. 9 sections: Dashboard · Sales · Business · Field & Tech · Design · Security · Dealer Network · Internal (corporate-only) · Settings. Bottom: Social panel (Feed/Messages/Email). `isCorporate` gate on Internal section. Business order: OS → Customers → Billing → Expenses → Vendors → Revenue → Contracts → Renewals → Events → Analytics. Incidents is first item in Field & Tech. |
| `app/reps/page.tsx` | Rep hierarchy + commission tracker (placeholder data) |
| `app/compliance/page.tsx` | Permit tracker (placeholder data) |
| `app/map/page.tsx` | Territory map (placeholder, needs Mapbox) |
| `app/scorecard/page.tsx` | Dealer scorecard (placeholder data) |
| `app/reports/page.tsx` | Roll-up reports (placeholder data) |
| `app/revenue/page.tsx` | MRR/ARR dashboard (placeholder data) |
| `app/events/page.tsx` | Polished placeholder page with demo events data |
| `app/incidents/page.tsx` | Polished placeholder page with demo incidents data |
| `app/documents/page.tsx` | Polished placeholder page with demo documents data |
| `app/analytics/page.tsx` | Polished placeholder page with demo analytics data |
| `app/alerts/page.tsx` | Polished placeholder page with demo alerts data |
| `app/trinity/page.tsx` | Full TRINITY voice AI dashboard — dark two-tone style matching /tech. Shows live calls, call history, sentiment scores, outcome tracking. |
| `app/expenses/page.tsx` | Expense tracking page — summary cards, category filter, vendor table with approve/pending status. |
| `app/email/page.tsx` | NEXUS Email inbox — three-panel (folders + thread list + compose). Gmail/Outlook connect. |
| `public/logos/` | Provider logos for Service Marketplace: `att.png`, `directv.png`, `gateguard.png`, `latch.png`, `xfinity.jpg`, `keystone.jpg`, `luxor.jpg`. Mixed .png/.jpg — always use the `LOGO_FILES` map in `app/services/page.tsx` to resolve filenames. |
| `app/api/incidents/ingest/route.ts` | POST endpoint for ingesting incidents from external sources (GGSOC bridge, hardware alarms, webhooks). Was an empty file — fixed May 25 2026. |

### Email + Dealer Onboarding
| File | Purpose |
|------|---------|
| `lib/email-templates.ts` | 7 HTML email generator functions: dealer welcome, NDA, agreement, work order, quote approval, permit renewal, invoice. Dark navy `#0B1728` header, `#6B7EFF` CTA button. |
| `lib/email-sender.ts` | `sendEmail()` utility wrapping Resend — never throws, safe fire-and-forget. |
| `app/api/admin/dealers/send-docs/route.ts` | POST → auto-sends NDA + Agreement emails when a new dealer is created. Tier→doc mapping: master_agent/master_dealer → NDA-A, full_dealer/service_dealer/install_contractor → NDA-B, sales_partner → NDA-C. |

### EOS (Entrepreneurial Operating System)
| File | Purpose |
|------|---------|
| `lib/eos-org.ts` | `resolveEosOrgId(user)` — resolves the correct org_id for EOS operations. Corporate admin users whose Clerk `publicMetadata.org_id` is null get looked up by `org_tier='corporate'`. Applied to all 10 EOS API routes to fix FK violations. |
| `app/api/eos/rocks/route.ts` | GET (list) + POST (create). Uses `resolveEosOrgId`. |
| `app/api/eos/rocks/[id]/route.ts` | PATCH + DELETE by id. Uses `resolveEosOrgId` for org scoping. |
| `app/api/eos/todos/route.ts` | GET + POST. Uses `resolveEosOrgId`. |
| `app/api/eos/todos/[id]/route.ts` | PATCH + DELETE. Uses `resolveEosOrgId`. |
| `app/api/eos/issues/route.ts` | GET + POST. Uses `resolveEosOrgId`. |
| `app/api/eos/issues/[id]/route.ts` | PATCH + DELETE. Uses `resolveEosOrgId`. |
| `app/api/eos/scorecard/route.ts` | GET + POST. Uses `resolveEosOrgId`. |
| `app/api/eos/scorecard/[id]/route.ts` | PATCH + DELETE. Uses `resolveEosOrgId`. |
| `app/api/eos/vto/route.ts` | GET (local + global scope) + PATCH. Uses `resolveEosOrgId` for local scope; global scope looks up `org_tier='corporate'` directly. |
| `app/api/eos/meetings/route.ts` | GET + POST. Uses `resolveEosOrgId`. Default L10 agenda seeded on create. |
| `app/api/eos/meetings/[id]/route.ts` | GET + PATCH + DELETE by meeting id. |
| `app/api/eos/meetings/attendee-suggestions/route.ts` | GET — returns merged contact list from `technicians` + `organizations` (by primary_email), max 50, sorted by name. Used by meeting form contact picker. |
| `app/api/eos/meetings/[id]/invite/route.ts` | POST — sends `.ics` calendar invites to all meeting attendees with email via Resend. Builds VCALENDAR string, base64-encodes, sends as attachment. Stores `invited_at` on meeting record. Returns `{ sent, failed, skipped }`. |

### TRINITY Voice AI
| File | Purpose |
|------|---------|
| `app/api/trinity/webhook/route.ts` | Twilio callback handler + Claude sentiment analysis on call transcripts. |
| `app/api/trinity/initiate/route.ts` | POST → initiates outbound call via Twilio. |
| `app/api/trinity/calls/route.ts` | GET → returns last 50 calls from `trinity_calls` table. |

---

## Master Asset Library (Google Drive)
https://drive.google.com/drive/folders/0AMsXu78d6wafUk9PVA

Canonical source for product PDFs, brand assets, legal docs, historical project files.

---

## Manual Upload Pipeline — LIVE ✅ (May 2026) — Fully Automatic

**The pipeline is now zero-friction. Three paths, all end at the same place:**

### Path A — Find Online (one click, recommended)
1. Add product to `/products` with field_service=true
2. Click **Find Online** button → `POST /api/kb/find-manual`
3. System searches known manufacturer URL patterns (DoorKing, Brivo, LiftMaster, Ubiquiti, etc.) then Claude URL lookup
4. PDF downloaded → uploaded to Supabase Storage → chunked + embedded → `products.manual_url` updated
5. Wiring extraction auto-triggers in background → terminal map in `device_suggestions`

### Path B — Upload PDF (manual file, any size)
1. Click **Upload PDF** → file picker → select PDF (up to 100 MB)
2. Step 1: browser calls `POST /api/kb/upload-url` → gets Supabase signed URL (tiny JSON, no Vercel size limit)
3. Step 2: browser PUTs file **directly to Supabase Storage** — binary never touches Vercel
4. Step 3: browser calls `POST /api/kb/process` with `{ product_id, manual_url }` → chunks + embeds
5. Wiring extraction auto-triggers in background

### Path C — Bulk script
- `scripts/bulk-upload-manuals.mjs` — batch process multiple products

**After any path:**
- `products.manual_url` is set → green dot on /tech device picker
- `manual_chunks` populated → AI diagnostic cites manual pages
- `device_suggestions` populated → wiring guide shows AI terminal map for new devices
- OpenAI billing required — platform.openai.com/settings/billing

---

## /tech Field Tool — Key Differentiator ✅ (v6, May 2026)

**This is GateGuard's #1 competitive advantage. Always keep it best-in-class.**

### Current capabilities

**Diagnostics (AI):**
- PIN auth via TECH_ACCESS_CODE (no Clerk required for field techs)
- Device picker from live products table (field_service=true), green dot = has manual
- **Connected devices selector** — tech marks what else is wired (Photobeam, Loop Detector, Callbox, etc.)
- **System topology awareness** — Claude knows device interconnections, guides isolation testing
- Symptom screen: quick-pick fault chips per category + free text + error code field
- AI step types: question / action / measure / select / photo / resolved / escalate
- **Measure steps — enhanced (v7):**
  - Unit + expected range display (e.g., "115±10 VAC")
  - ⊕ METER button: tap to expand inline meter guide panel
  - **Meter guide panel**: SVG multimeter diagram with arc dial (needle points to correct function), probe jack diagram (red V/Ω jack vs black COM), range advice, ⚠ danger + ○ warning cautions. 7 configs: VAC, VDC, Ω, A, mA, ms/Hz. Cautions include: "never use DC mode on AC circuits", "power off before measuring Ω", "use dedicated A jack not VΩ jack".
  - **Real-time pass/fail**: as tech types a value, immediately shows ✓ IN SPEC (green) or ✗ OUT OF SPEC (red) with expected range. Parses: `115±10`, `>12`, `0-24`, `≤1`, plain numbers (±10% tolerance).
- Photo capture + Claude vision analysis via `/api/kb/analyze-image`
- Manual references: p.XX links to PDF when chunk is matched
- Session logging to `troubleshoot_sessions`
- **Resolution capture + learning loop (v8):** On `resolved` step, tech sees "DID THIS FIX IT?" Y/N. If YES → "WHAT FIXED IT?" textarea + SUBMIT. POST to `/api/kb/resolve` → sets `troubleshoot_sessions.resolved=true, resolution_note` + auto-embeds a `kb_articles` row. Future sessions with similar symptoms will surface the fix via vector search. If NO → continues diagnostic with `answer('No — issue persists')`.
- Demo modes: `?demo=install` (commissioning wizard) + `?demo=fault` (fault diagnosis walkthrough)

**Wiring Guide (amber button on choice screen):**
- Select a device → pick a connection pairing → SVG split-panel terminal diagram
- Color-coded header bands, terminal dot connectors, bezier wire curves
- Wires color-coded by type: relay COM=amber, relay NO=green, +V=red, GND=dark, data=blue
- Wire legend, required settings strip, caution cards, numbered install notes
- **Connector block labels (v7)**: terminal group separators now show the physical connector ID (J2, J6, etc.) as a colored badge pill + group name text. Connected groups = blue badge. Techs can immediately see which physical block to use.
- **Static verified library** (`lib/wiring-library.ts`): 27 devices, 19 wiring maps
  - Gate operators: DK6050, DK9050, DK1600, LiftMaster SL3000, Linear SW050, Viking G5
  - Access controllers: Brivo ACS300, ACS6100, ACS100, Brivo 100 single-door
  - Entry systems: DK1835 callbox, DK2334 VoIP
  - Safety: DK9409 dual loop, DK9410 single loop, photobeam, generic loop detector
  - Intercoms: UniFi G3 Intercom, UniFi Access Hub Mini
  - Locks: Alarm Controls 1200S mag lock, AES-100 electric strike, generic mag lock/strike
  - Sensors: Securitron EEB2, Bosch DS160 PIR REX
  - Network: Ubiquiti UCG-Ultra, USW-Flex
- **AI-generated entries** (`device_suggestions` table): auto-populated after every manual upload. WiringDiagram merges both sources at runtime.
- `components/tech/WiringDiagram.tsx` — SVG renderer + `WiringGuide` screen. WiringGuide fetches Supabase device_suggestions for current product and shows AI terminal map when no static map exists.

**Site Survey (📍 button on home screen — v7):**
- Tech taps 📍 SITE SURVEY from the home screen (no device selection needed)
- **Survey screen**: property name, scrollable device inventory list, ⚡ GENERATE PROPOSAL button
- **Add Device screen**: name, brand, model, location, condition (Good/Fair/Poor), action (Keep/Service/Replace/New Install), notes. Tap existing device to edit or delete.
- **AI proposal generation**: `POST /api/kb/survey-proposal` — Claude Haiku analyzes inventory → returns: 2-3 sentence summary, line items with qty + priority (urgent/recommended/optional), recommendations, install notes
- **Native Plaud integration (v10)**: `survey_transcript` screen now has **🎙 UPLOAD PLAUD RECORDING** button. Tech selects audio file exported from Plaud → uploaded to Supabase Storage → Plaud transcription API converts to text → transcript auto-fills the textarea → tech can edit then hit ⚡ EXTRACT DEVICES. Falls back to manual paste if no Plaud credentials configured. Env vars required: PLAUD_CLIENT_ID, PLAUD_SECRET_KEY. Register at platform.plaud.ai/developer.
- Proposal renders inline with 📋 COPY PROPOSAL TEXT button for pasting into email/quote
- Framework designed to feed into portal quote builder (Phase 2)

**Cable Guide (purple button + home screen shortcut):**
- CAT Cable tab: T568B pinout, 7-step continuity/PoE test procedure
- 2-Wire Series tab: circuit diagram + bisect-the-break procedure
- 2-Wire Parallel tab: bus diagram + branch isolation procedure
- `components/tech/CableGuide.tsx`

**Install Demo (`?demo=install`):**
- Guided commissioning wizard: G3 Intercom + Hub Mini + ACS300 + DK6050 ×2
- 5 phases: Pre-Install → Mount & Power → Wire → Verify → Sign Off
- Checkbox progress tracking, wiring diagram deep-links per step, scroll-fixed phases

**Fault Demo (`?demo=fault`):**
- Auto-populates Brivo ACS300, pre-fills symptom, connected devices pre-selected
- AI leads to bad-wire diagnosis → shows wiring troubleshooting

### Planned
- PWA manifest + service worker (techs "Add to Home Screen")
- LPR integration (Eagle Eye LPR → auto-trigger Brivo credential or gate relay)
- Site Survey photo capture per device (already wired to photoRef, needs UI hookup)
- Site Survey → push directly to portal quote builder (portal auth required)
- Commissioning wizard (new install checklist → as-built PDF)
- Smart tester API integration (Fluke LINKWARE / IDEAL AnyWARE)

---

## Smart Tester API Integration (Future — /tech)

Field techs use Fluke, IDEAL, and Greenlee cable/network testers daily. Future goal: pull test results directly into the diagnostic session instead of requiring manual entry.

**Target integrations:**
- **Fluke LINKWARE Live** — Fluke's cloud platform for DSX/DTX cable analyzer results. REST API available. Test results (wiremap, insertion loss, NEXT, return loss) linkable per cable ID. → Auto-populate measure steps with actual tester readings.
- **IDEAL AnyWARE Cloud** — IDEAL Networks tester cloud. Job-based test result storage with web API. Supports Cat5e/Cat6/fiber certification results.
- **Greenlee GT-8 / DataScout** — Bluetooth LE export from handheld testers. Some models support direct data transfer via USB or mobile app.
- **Generic multimeter (short-term)** — No API needed. Let tech photograph the multimeter display → Claude vision extracts the reading and validates it against the expected range for that measure step. Same `/api/kb/analyze-image` endpoint already built.

**Implementation approach:**
1. Add `tester_brand` + `tester_job_id` optional fields to the `/tech` symptom screen
2. On measure steps, show a "Import from tester" button if credentials are configured
3. Dealer configures tester API key in `/settings` → stored per-org in Supabase
4. Results auto-fill measure step answer + flag pass/fail vs expected range
5. Store tester report URL in `troubleshoot_sessions` for audit trail

**Immediate workaround (already works today):** Techs can photograph the tester screen on any photo step — Claude vision reads the display and comments on the reading.

---

## UI Design System
- Portal: light theme, white cards, `#F8FAFC` bg, `#6B7EFF` brand blue, dark sidebar `#0C111D`
- Tech tool: `#F1F5F9` bg, white cards, IBM Plex Mono for headers/chips
- Portal font: Inter (Google Fonts, 300–800) + IBM Plex Mono (where mono needed)
- Step colors: blue=VERIFY, amber=ACTION, green=RESOLVED, red=ESCALATE, purple=MEASURE
- Sidebar brand: `brand-400` = #6B7EFF (tailwind.config)
- Tier badge colors: corporate=brand, MSO=violet, dealer=sky, partner=emerald, client=amber

---

## Roadmap (May 2026)

### Phase 1 — Quick Wins ✅ Largely Complete
- [x] Connected devices selector on /tech symptom screen
- [x] System topology awareness in Claude system prompt
- [x] Wiring Guide — SVG terminal diagrams for common install pairings
- [x] Cable Guide — CAT cable, 2-wire series, 2-wire parallel testing
- [x] Demo modes — ?demo=install commissioning wizard, ?demo=fault fault walkthrough
- [x] Expand wiring library to 27 devices / 19 maps (dealer eval hardware)
- [x] Direct-to-Supabase PDF upload (no Vercel size limit)
- [x] Auto-find manual from manufacturer sites (one-click)
- [x] Auto-extract wiring terminals via Claude after every upload
- [x] device_suggestions table — AI wiring data live in portal without code deploy
- [x] Wiring diagram connector block ID badges (J2, J6, etc.) on group separators
- [x] Measure step: ⊕ METER button → inline guide (SVG dial, probe jacks, cautions)
- [x] Measure step: real-time pass/fail validation against expected range
- [x] Site Survey module — 📍 SITE SURVEY button, device inventory, AI proposal generator
- [x] PDF chunking fix — large paragraphs sub-split by sentence; hard 8192-token cap in embedBatch
- [x] Supabase "manuals" bucket auto-created on first upload if missing
- [ ] Photo evidence on work orders (reuse /tech photo component)
- [ ] Canned service packages in /products
- [ ] Automated renewal/PM reminders (Vercel cron + Twilio)
- [ ] In-app support widget (HelpScout Beacon — one script tag)
- [ ] PWA manifest for /tech
- [ ] Smart tester API integration (Fluke LINKWARE / IDEAL AnyWARE)
- [ ] Site Survey photo capture per device
- [ ] Site Survey → push to quote builder

### Phase 2 — Dealer Network (1–2 months)
- [x] /reps — Rep & commission manager (placeholder UI)
- [x] /compliance — Permit tracker (placeholder UI)
- [x] /map — Territory map (placeholder UI, needs Mapbox)
- [x] /scorecard — Dealer scorecard (placeholder UI)
- [x] /reports — Roll-up reports (placeholder UI)
- [x] /quotes/[id]/approve — Client approval page (live)
- [ ] LPR integration — Eagle Eye LPR → auto-trigger Brivo credential or gate relay. Registered plate detected → gate opens. No fob, no app. Phase 2 priority.
- [ ] Wire dealer-network pages to live Supabase data (migrate reps/permits tables)
- [ ] SMS thread inside work orders (Twilio ↔ WO ID)
- [x] Site Survey framework — /tech survey + survey_add screens + AI proposal (live in /tech)
- [ ] Site Survey: photo per device, push to /quotes quote builder
- [ ] Client portal full build-out — `portal.gateguard.co/[site-slug]`. Property manager view: KPI cards (Brivo), camera grid (Eagle Eye), event tracker, user/device read-only. Mirrors Brivo Facility Manager layout. Auth: Clerk 'client' role, Supabase RLS scoped to org. Proxy API routes reuse lib/brivo.ts + Eagle Eye integration. No Brivo/Eagle Eye login for property managers. (Task #50)
- [ ] Property Intelligence Card on dashboard
- [ ] UI differentiation pass: Space Grotesk headings, LED-glow status dots, tighter card density

### Phase 3 — Category-Defining (3–6 months)
- [ ] Predictive maintenance engine (device age + cycles + KB patterns)
- [ ] Mapbox integration for /map
- [ ] As-built documentation PDF generator
- [ ] Monthly client report auto-PDF
- [ ] Resident self-service tickets via GateCard → creates WO in portal
- [ ] Google Reviews post-WO SMS trigger
- [ ] Commissioning wizard (new install checklist → as-built PDF)
- [ ] FAAC, BFT, Doorbird, HID, Viking callbox library entries

---

## SARA Plus Competitive Intelligence — Verified May 2026

**NEXUS BRANCH RULE:** SARA Plus appears ONLY at `/migrate` (SARA Bridge wizard). No other SARA connections, links, or branding anywhere in the codebase. The Sidebar shows "SARA Bridge" under DirecTV Channel — that is the only reference.

### Their Complete Tech Stack (scraped live from saraplus.com + apidocs.saraplus.com)

| Layer | What They Use | Notes |
|-------|--------------|-------|
| Web framework | ASP.NET Web Forms — login URL is `/e/servicepages/login.aspx` | Microsoft deprecated this in 2009 |
| CSS | Bootstrap 5.0.2 (frozen) | Not even current 5.3 |
| JavaScript | jQuery 3.7.1 | No React, no TypeScript, no components |
| API protocol | XML over HTTP POST, Basic Auth | SOAP-era. Not REST. Not JSON. |
| API endpoints | `api.saraplus.com/api/prod` and `api-qa.saraplus.com/api/qa` | Two endpoints, both XML POST |
| CDN | `files.saraplus.com` | Static assets only |
| Support | Zendesk at `support.saraplus.com` → `saraplus.zendesk.com` | 3 KB sections, ~7 total articles |
| API docs | Postman Documenter at `apidocs.saraplus.com` | Not self-hosted |
| Monitoring | New Relic (account 2665918, confirmed from NREUM JS in page source) | They know it's broken |
| Error tracking | Sentry (`o1224273.ingest.sentry.io`) | On API docs page |
| Mobile | iOS + Android, v7.69 (Mar 2026), 2.09/5 stars, ~15K downloads | Crashes, can't rotate, loses orders |

### SARA Plus API — Full Map (3 calls, all wrapping AT&T Gateway)

**PD — Product Details:** Address lookup → available AT&T/DIRECTV products
Test cases: SELF INSTALL, COMBINED INSTALL, SPLIT INSTALL, ATV+Low Speed, Gift Card

**CC — Credit Check:** Customer credit/fraud screening
40+ test cases: risk.low/medium/high/unknown/review, debt.pass/fail, ncvc.pass/fail, eSIM eligible/not/locked, fee.dtv/att/abp, wireless downpayment, gfmo (fraud bypass), fde (skip fraud review)
Test credit cards: MC 5506900140100305 / Amex 345612313521003 / Discover 6510000000000133 / Visa 4761739001010119

**Order Entry:** Submit the order to AT&T Gateway

Response codes (only 6): 0000=Success, 2002=Multiple addresses, 2003=Can't validate, 2005=No offers, 2009=Existing service, 9999=General failure
Wireless credit codes: CA/AA=Pass, AR=Analyst review, PA=Needs refresh, ER=AT&T API error

### SARA Bridge Demo Data Schema
When seeding the demo database for the SARA Bridge wizard at `/migrate`, generate:
- **Customers**: 84 records — name, address, AT&T account number, credit tier (LOW/MEDIUM/HIGH), install type (SELF/COMBINED/SPLIT), service type (DTV/IPBB/ATV/Wireless)
- **Work Orders**: 312 records — order ID, product, install date, tech name, status
- **Quotes**: 147 records — customer, products, amounts, sent/accepted/declined
- **Commission Records**: 1,840 records — pay period, dealer, tech, amount, reconciliation status
These counts already appear hardcoded in the /migrate Step 2 UI. Seed data should match.

### What SARA Plus Cannot Do (Nexus advantages to demonstrate)
No AI, no field tech tools, no MRR/ARR, no rep hierarchy, no commissions, no territory map,
no scorecard, no training, no client portal, no KB, no cameras, no access control, no network mgmt,
no real-time hardware, carrier-locked (AT&T/DIRECTV/Viasat ONLY), no independent data model.

**Structural trap:** SARA has no real database. It's a window into AT&T's systems. When AT&T changes their gateway, SARA breaks. App store reviews confirm. 70% market share was AT&T certification, not merit.

### AI Army — Agent Names (current, May 2026)
ARIA (Lead Intel), TRINITY (Voice — formerly ECHO), SCOUT (Market), BEACON (Client Comms),
FORGE (Quote Builder), ATLAS (DirecTV), SAGE (Training), RELAY (Tier-1 Support)
NOTE: Agent is named TRINITY not ECHO. Sidebar.tsx reflects this.
