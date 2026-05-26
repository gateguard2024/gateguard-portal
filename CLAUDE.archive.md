# GateGuard Portal — Archive Context

> Historical sprint records, detailed /tech docs, migration notes, SARA Plus intel, full route list.
> Do not trim this file — it is the long-term memory. Active reference → CLAUDE.md

---

## THE PLATFORM VISION — The Ultimate Multifamily Middleware

GateGuard is building the **central nervous system of multifamily real estate** — the middleware layer between every hardware vendor, software platform, resident, property manager, and service provider. Not a point solution. The tollbooth for everything that moves in and out of a multifamily property.

### Market Reality (Verified May 2026)
- PropTech market: $44.59B in 2026, growing to $104B by 2034. $16.7B invested in 2025 (+68% YoY)
- SmartRent: $152M revenue, stock at $1.12 (down from $10 SPAC), still unprofitable
- DOOR/Latch (formerly Latch): $70M revenue, $53.7M net loss, $34.6M cash left — distressed
- ButterflyMX: Healthiest pure-play ($131M raised, 20K+ properties) — hardware-first model
- RealPage/STRATIS: DOJ antitrust settled Nov 2025 (7-year monitoring)

### Why GateGuard Wins
The installer is the moat. Whoever physically bolts the hardware owns that property relationship for 5-10 years. Every install is the starting line for a compounding platform play.

### Trigger-Based Delivery Model

| Trigger | Timing | What Property Gets | GateGuard Cost | Property Perceives |
|---------|--------|-------------------|----------------|-------------------|
| Hardware Install | Day 0 | Gate, cameras, Brivo, UniFi | Hardware + labor | "We bought a gate" |
| GateCard Activation | Week 1 | Resident app, mobile access, visitor mgmt | ~$0 | "We expected a gate. We got a platform." |
| Vendor Accountability | Month 1 | QR valet trash, geo-fenced security | One-time API | "Our #1 complaint disappeared" |
| Ancillary Revenue Layer | Month 3 | Commission on insurance, furniture, move-in | Affiliate setup | "The gate is paying us back" |
| Community Commerce | Month 6 | Resident marketplace, vetted vendors | Feature additions | "Our renewals are up" |
| AI Intelligence Layer | Month 12+ | Predictive maintenance, lease renewal scoring | AI already built | "It predicted our gate failure 3 weeks early" |

---

## SPRINT HISTORY (Sprints 1–6)

### Sprint 1 — Investor-Killer Fixes ✅
- Live Dashboard KPIs wired to Supabase
- EOS persistence wired to Supabase
- Renamed "Maintenance" → "Work Orders"
- `<EmptyState>` + `<SkeletonRow>` shared components

### Sprint 2 — Demo Anchor Polish ✅
- Quote PDF export (print-CSS + Download button)
- Work Order status timeline component
- Site survey photo capture framework

### Sprint 3 — Design Coherence ✅
- `<DataTable>` shared component
- `<SlideOver>` shared component
- Skeleton loading + empty states on all list pages

### Sprint 4 — Operational Backbone ✅ COMPLETE
- CRM: Pipeline $ by stage on kanban, deal aging badges, Lead→Opp conversion
- Properties: Health score chip, Mapbox pin on site detail
- Inventory: Auto-deduct parts on WO, auto-PO draft when below min_stock
- Dispatch: Mapbox split-view, "En Route" + "On Site" columns

### Sprint 5 — Category-Defining Polish ✅ COMPLETE
- `/billing` — Full billing engine: invoices from Supabase, Stripe payment links, commission payout tracking, QuickBooks Online sync
- `/admin/dealers/[id]` — Full dealer detail page (5 tabs: Overview, Properties, WOs, Commission, Docs)
- `/reps` — Commission approval workflow (approve/hold/mark paid, bulk actions, hierarchy tree)
- `/reps/[id]` — Rep detail: 30/60/90d pipeline, deal history, commission timeline
- `/compliance` — Permit detail SlideOver, document attachments, renewal reminders cron
- `/map` — Real Mapbox GL JS v3.3.0, live geocoded pins, health-colored markers
- `/scorecard` — Ranked leaderboard, trophy badges, sparkline trends, GateGuard Certified badge ≥ 80
- `/training` — Quiz engine (8 questions, 80% pass, 3 attempts), PDF certificate, prerequisite gating
- `/training/admin` — Admin progress dashboard, Reset Attempts, Revoke Cert

### Sprint 6 — Design Section + Service Marketplace ✅ COMPLETE (May 22 2026)
- Sidebar: NEXUS primary brand mark, new **Design** section (Floor Plans, System Design, As-Builts, E-Sign)
- `/services` — Service Marketplace: 22 services across 10 categories, MRR estimator widget, enrollment toggle
- Service picker panels in `/quotes/new` and `/quotes/[id]`
- `/design/floor-plans` — Interactive canvas: Survey mode (place devices) + Design mode (connect devices, wire schedule) + Markup mode (annotations). 20-device library, BOM auto-generated.
- `/design/system` — Wire schedule + I/O block diagram
- `/design/as-builts` — As-built doc generator with print CSS
- `/design/esign` — E-sign management dashboard
- `/design/esign/sign/[token]` — Public signature page (no auth), canvas touch/mouse
- Migrations 070 + 071 added (service catalog + design tables)

### Sprint 5 Recent Session Additions (May 21 2026)
- `/trinity` — Full TRINITY voice AI dashboard, dark two-tone UI, backed by `trinity_calls` (migration 062)
- `/events`, `/incidents`, `/documents`, `/analytics`, `/alerts` — polished placeholder pages
- `lib/email-templates.ts` + `lib/email-sender.ts` — 7 HTML email templates + Resend wrapper
- `/api/admin/dealers/send-docs` — auto-fires NDA + Agreement emails on dealer creation
- CRM bug fixes: opportunity contacts persist (migration 063 RLS fix)
- Google Calendar OAuth fix (migration 053, dedicated gcal columns on user_settings)
- Master Agent visibility fix in `/api/admin/dealers`
- Survey Wizard fixes: CRM Import jumps to step 2, opportunity_id carried, correct API parsing
- Quote calculator: Gate Operator Service Plan INCLUDED in base (not optional), Physical Gate Coverage $250/gate/month optional add-on, Ramp-Up Plan section in wizard step 4

### Sprint 7 (Critical Gaps Roadmap — upcoming)
- Job Costing (actual vs quoted P&L)
- AR Aging + Collections
- Warranty/RMA
- Live Parts Pricing (ADI Global API)

### Sprint 8
- GPS Fleet Tracking (Samsara-tier)
- Route Optimization AI
- COI Tracking
- Review Management (Podium-replacement)

### Sprint 9
- PMS Integrations (Yardi/AppFolio/RealPage)
- Permit Auto-Filing (ATLAS)
- Subcontractor Portal
- Payroll Integration (Gusto/ADP)

### Sprint 10
- System I/O Designer (D-Tools SI replacement, FORGE-powered)
- Digital Twin
- CEU/License Tracking
- Energy Intelligence

---

## 10/10 LEVEL-UP TARGET STATE

| Section | Current | Target | Key Gap |
|---------|---------|--------|---------|
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
| Work Orders | 7/10 | ServiceTitan + MaintainX | Timeline + signature |
| Dispatch | 7/10 | ServiceTitan Dispatch | Map view + En Route/On Site |
| Inventory | 6/10 | ServiceTitan + Jobber | WO integration + auto-reorder |
| Site Survey | 8/10 | Category-first | Photos + health indicator + share link |

---

## ALL ROUTES

### Core Operations
- `/` — Dashboard
- `/customers` — Customer org hierarchy
- `/crm` — CRM pipeline
- `/crm/leads/[id]` — Lead detail
- `/crm/opportunities/[id]` — Opportunity detail

### Sales & Quoting
- `/quotes` — Quote list
- `/quotes/new` — Quote builder (mode picker)
- `/quotes/[id]` — Full editor
- `/quotes/[id]/proposal` — Customer-facing proposal (standalone, no auth)
- `/quotes/[id]/approve` — Client approval (standalone, no auth)

### Revenue & Billing
- `/billing` — Invoices + QB sync, MRR
- `/renewals` — Contract renewal tracking
- `/revenue` — MRR trends, ARR, commission dashboard
- `/contracts` — Contract storage

### Operations
- `/events`, `/incidents`, `/analytics`, `/documents`, `/alerts` — polished placeholder pages

### Field Service
- `/maintenance` — Work orders
- `/dispatch` — Job dispatch board, tech roster, Mapbox split-view
- `/inventory` — Warehouse stock, van stock, POs
- `/reports` — Multi-site roll-up

### Dealer Network
- `/reps` — Rep hierarchy + commission tracker
- `/compliance` — Permit tracker
- `/map` — Territory map (Mapbox GL JS v3.3.0)
- `/scorecard` — Dealer scorecard

### Design Section
- `/design/floor-plans` — Interactive floor plan tool (Survey + Design + Markup modes)
- `/design/system` — Wire schedule + I/O block diagram
- `/design/as-builts` — As-built doc generator
- `/design/esign` — E-sign management
- `/design/esign/sign/[token]` — Public signature page

### Services
- `/services` — Service Marketplace (22 services, 10 categories)

### Security & Hardware
- `/cameras` — Eagle Eye live feeds
- `/access` — Brivo access control
- `/network` — UniFi infrastructure

### Platform & Tools
- `/kb` — AI diagnostic engine
- `/tech` — Field diagnostic tool v10 (mobile-first, no Clerk)
- `/trinity` — TRINITY voice AI dashboard
- `/survey` — Site survey
- `/portal` — Customer portal
- `/onboarding` — Customer onboarding
- `/communications`, `/visitor`, `/products`, `/energy`, `/deliveries`
- `/channel` — Channel partner program
- `/marketing`, `/marketing/social`, `/marketing/dealer-social`, `/marketing/coop`, `/marketing/website`
- `/migrate` — SARA Bridge migration wizard (SARA Plus appears ONLY here)

### Admin
- `/admin` — Organization admin
- `/admin/dealers` — Dealer list
- `/admin/dealers/new` — 7-step onboarding wizard
- `/admin/dealers/[id]` — Dealer detail (5 tabs)
- `/eos` — EOS One mirror

### Auth
- `/sign-in/[[...sign-in]]` — Clerk sign-in (dark theme)
- `/sign-up/[[...sign-up]]` — Clerk sign-up

---

## DEALER HIERARCHY & ORG TIERS

**DB enum → UI label:**
| DB Value | Display |
|---|---|
| corporate | GateGuard Corporate |
| master_agent | Master Agent |
| master_dealer | MSO — Master System Operator |
| full_dealer | Dealer |
| service_dealer | Service Partner |
| install_contractor | Installation Partner |
| sales_partner | Sales Partner |
| client | Client |

**What each tier sees:**
- Corporate: All dealers, all clients, total MRR/ARR, full KB
- MSO: Their child dealers, roll-up dashboard, cross-site WO summary, all client properties
- Dealer: Their clients only, their sub-dealers, reps + commissions, quotes + WOs, invoices
- Sub-Dealer: Their clients only, own WOs + quotes, own reps, limited billing
- Sales Rep: Their pipeline only, commissions, sub-reps, quote builder
- Client (PM): Their properties only, open tickets, approve quotes, invoices + pay

---

## GateGuard BILLING MODEL

- **Video Monitoring Fee** — flat rate per property (default $500/mo, covers up to 10 cameras)
- **Access Plan** — $5.00 per living unit per month (gate service, Brivo, PMS integration, 36-month agreement)
- **Invoice numbering:** GG-INV-NNNNNN starting at 120045 (continuing from QB sequence)
- **Payment:** Stripe payment links (ACH + cards) — customers pay via link, no portal login
- **QB sync:** portal → QB only (outbound, never reads from QB)

---

## MIGRATION NOTES (full log)

| Migration | Contents |
|-----------|----------|
| 001-006 | Initial: orgs, CRM, products, KB vectors, seed, sync tables |
| 007 | device_suggestions (AI terminal extraction) |
| 008 | opportunity_contacts, opportunity_stage_history |
| 010 | EOS tables |
| 011 | work_orders + technicians |
| 012 | sites FK enrichment (master_dealer_id, install_dealer_id, service_dealer_id) |
| 017 | org_tier enum + commission_config — MUST run on prod before dealer onboarding live |
| 020 | email tracking columns on crm_activities |
| 021 | training_progress + dealer_scorecards — MUST run before /training + /scorecard live |
| 022 | opportunity document tracking |
| 041 | surveys table |
| 042 | quotes enrichment (quote_mode, client_name, etc.) |
| 050 | invoices + invoice_line_items + commission_payouts |
| 051 | billing columns on sites |
| 052 | permit documents enrichment |
| 053 | gcal columns on user_settings |
| 062 | trinity_calls |
| 063 | RLS fix on opportunity_contacts + opportunity_stage_history |
| 070 | service_catalog + dealer_service_enrollments + site_service_subscriptions (22 services seeded) |
| 071 | floor_plans + floor_plan_devices + floor_plan_connections + floor_plan_annotations + esign_documents |
| 091 | Quote v2 columns: whats_included, payment_schedule_json, sow_text, agreement_type, agreement_html, attachments, signed_at, signer_name, signer_email, signer_ip, signature_data, accepted_by_rep, accepted_by_rep_name |

---

## /tech FIELD TOOL — Full Feature Docs (v10, May 2026)

**Auth:** PIN via TECH_ACCESS_CODE env var (no Clerk). Demo modes: `?demo=install` / `?demo=fault`

**Bottom nav:** DIAGNOSE · WIRING · CABLE · SURVEY

**Diagnostics:**
- Device picker from `products` table (field_service=true), green dot = has manual
- Connected devices selector — system topology awareness in Claude system prompt
- Symptom screen: quick-pick fault chips + free text + error code field
- AI step types: question / action / measure / select / photo / resolved / escalate
- Measure steps: unit + expected range, ⊕ METER button → inline SVG multimeter guide (arc dial, probe jacks, 7 configs: VAC/VDC/Ω/A/mA/ms/Hz, cautions), real-time pass/fail validation (parses `115±10`, `>12`, `0-24`, `≤1`, plain numbers ±10%)
- Photo capture + Claude vision via `/api/kb/analyze-image`
- Resolution capture: "DID THIS FIX IT?" → auto-embeds kb_article for future sessions

**Wiring Guide:**
- Static library: 27 devices, 19 maps (`lib/wiring-library.ts`)
- AI-generated: `device_suggestions` table (auto-populated after manual upload)
- SVG split-panel: color-coded terminal dots, bezier curves, connector block ID badges (J2, J6, etc.)
- Wire colors: relay COM=amber, relay NO=green, +V=red, GND=dark, data=blue

**Site Survey (📍 button):**
- Property name + scrollable device inventory
- Add Device: name, brand, model, location, condition (Good/Fair/Poor), action (Keep/Service/Replace/New Install), notes
- ⚡ GENERATE PROPOSAL → Claude Haiku → summary + prioritized line items
- 🎙 UPLOAD PLAUD RECORDING → Plaud transcription API → auto-fill transcript → ⚡ EXTRACT DEVICES
- ☁ SAVE TO PORTAL → POSTs to `/api/surveys` with x-tech-code auth

**Cable Guide:** CAT T568B pinout + 7-step continuity/PoE · 2-wire series bisect · 2-wire parallel bus

**Install Demo (`?demo=install`):** G3 Intercom + Hub Mini + ACS300 + DK6050 ×2 — 5 phases
**Fault Demo (`?demo=fault`):** Brivo ACS300, pre-fills symptom, bad-wire diagnosis

### /tech Planned Features
- PWA manifest + service worker (Add to Home Screen)
- LPR integration (Eagle Eye LPR → Brivo credential or gate relay)
- Site Survey photo capture per device (photoRef wired, needs UI hookup)
- Site Survey → push to portal quote builder (requires portal Clerk auth)
- Commissioning wizard (new install checklist → as-built PDF)
- Smart tester API: Fluke LINKWARE Live, IDEAL AnyWARE Cloud, Greenlee GT-8
  - Implementation: `tester_brand` + `tester_job_id` on symptom screen, "Import from tester" on measure steps, dealer configures API key in /settings
  - Workaround today: photograph tester screen → Claude vision reads display

---

## SALES & ONBOARDING ARCHITECTURE

### Opportunity Types → Sales Cycles
- master_agent: Lead → Opp → NDA Sent → NDA Signed → Agreement Sent → Negotiation → Signed & Approved
- mso/dealer: Lead → Opp → Agreement Sent → Signed & Approved
- install/service partner: Lead → Vetting → Agreement → Approved
- property/company: Lead → Opp → Site Survey → Quote Sent → Quote Approved → Signed → Install Scheduled
- customer: Lead → Opp → Quote Sent → Quote Approved

### Document Strategy
- NDA-A: Master Agent, MSO — full mutual NDA
- NDA-B: Dealer, Install, Service Partner — stronger one-way
- NDA-C: Sales Partner — lightweight
- One agreement per tier

### Onboarding Trigger ("Approve & Send Welcome")
On opportunity Won + all docs signed → Resend welcome email + Clerk portal invite + tier-specific content. For Property/Company wins: creates WO + site record + PM portal invite.

---

## AI ENGINE VISION

GateGuard is not building features that use AI. GateGuard is building an **AI engine** that uses features.

```
GateGuard AI Engine (our IP, our moat)
  ├── Orchestration — routes tasks to right model/tool
  ├── Memory — cross-session context, dealer DNA
  ├── Signal — real-world data (reviews, permits, hardware telemetry)
  └── Output — emails, quotes, diagnostics, proposals, alerts
        ↓ dispatches to:
        ├── Claude — reasoning, drafting, KB
        ├── GPT-4o — embeddings, vision fallback
        ├── Gemini — document processing
        ├── Perplexity/Tavily — live web research
        └── External APIs — Brivo, Eagle Eye, UniFi, DirecTV, Hunter, Apollo
```

No single model is the engine. Models are interchangeable workers.

### Compounding Loop
Ship capability → Measure what works → Feed results back → Level up → Repeat

ARIA current: Claude-only, synthetic data. Next: real Tavily web search. After: self-learns reply rates.

---

## SARA PLUS COMPETITIVE INTELLIGENCE (full archive)

**Rule:** SARA Plus appears ONLY at `/migrate`. Zero other references anywhere.

### Tech Stack (scraped live May 2026)
| Layer | Technology |
|-------|-----------|
| Web framework | ASP.NET Web Forms (deprecated 2009) |
| CSS | Bootstrap 5.0.2 (frozen) |
| JS | jQuery 3.7.1 |
| API | XML over HTTP POST, Basic Auth (SOAP-era) |
| API endpoints | api.saraplus.com/api/prod + api-qa.saraplus.com/api/qa |
| Support | Zendesk (3 KB categories, ~7 articles) |
| Monitoring | New Relic (account 2665918) |
| Error tracking | Sentry (o1224273.ingest.sentry.io) |
| Mobile | iOS + Android v7.69, 2.09/5 stars, ~15K downloads |
| Merch | saraplus.myspreadshop.com (yes, they have merch) |

### API Map (3 calls, all wrapping AT&T Gateway)
**PD (Product Details):** Address lookup → available products. Tests: SELF/COMBINED/SPLIT INSTALL, ATV+Low Speed, Gift Card

**CC (Credit Check):** 40+ test cases: risk.low/medium/high/unknown/review, debt.pass/fail, eSIM eligible/locked, fee.dtv/att/abp, gfmo (fraud bypass), fde (skip fraud review)
Test cards: MC 5506900140100305 / Amex 345612313521003 / Discover 6510000000000133 / Visa 4761739001010119

**Order Entry:** Submit to AT&T Gateway

Response codes (6): 0000=Success, 2002=Multiple addresses, 2003=Can't validate, 2005=No offers, 2009=Existing service, 9999=General failure
Credit codes: CA/AA=Pass, AR=Analyst review, PA=Needs refresh, ER=AT&T API error

### SARA Bridge Demo Data Schema (for /migrate seeding)
- Customers: 84 records — name, address, AT&T account, credit tier (LOW/MEDIUM/HIGH), install type, service type
- Work Orders: 312 records — order ID, product, install date, tech name, status
- Quotes: 147 records — customer, products, amounts, status
- Commission Records: 1,840 records — pay period, dealer, tech, amount, reconciliation status
(These counts are hardcoded in /migrate Step 2 UI — seed data must match)

### What SARA Plus Cannot Do
No AI, no field tech tools, no MRR/ARR, no KB, no cameras, no access control, no network mgmt, no territory map, no scorecard, no training, no real-time hardware, carrier-locked (AT&T/DIRECTV/Viasat only), no independent database (all data lives in AT&T's systems).

**Structural trap:** SARA is a presentation layer on AT&T's backend. When AT&T changes gateway, SARA breaks. 70% market share was AT&T certification, not merit.

---

## FULL ENV VARS

```
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
OPENAI_API_KEY                    # PDF embedding
ANTHROPIC_API_KEY                 # KB + diagnostic Claude calls
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
BRIVO_API_KEY, BRIVO_CLIENT_ID, BRIVO_CLIENT_SECRET
CRON_SECRET
TECH_ACCESS_CODE                  # PIN for /tech field techs
NEXT_PUBLIC_MAPBOX_TOKEN          # Mapbox GL JS (map, dispatch, sites)
PLAUD_CLIENT_ID                   # Plaud API (platform.plaud.ai/developer)
PLAUD_SECRET_KEY
RESEND_API_KEY                    # Transactional email
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL               # e.g. https://portal.gateguard.co
QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REALM_ID, QBO_ACCESS_TOKEN  # optional
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
ELEVENLABS_API_KEY                # TTS for TRINITY (optional)
TAVILY_API_KEY                    # ARIA web search (app.tavily.com)
```
