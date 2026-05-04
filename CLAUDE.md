# GateGuard Portal — Agent Context

## APPLICATION LANDSCAPE (read this first — get it right every time)

GateGuard runs four distinct applications. Never confuse them.

| App | URL | Repo | Purpose |
|-----|-----|------|---------|
| SOC Operations | ggsoc.com | gateguard-dispatch-ui | Call center interface for SOC staff. Live production. Twilio, Brivo, Eagle Eye, Supabase. DO NOT BREAK. |
| Visitor Kiosk (legacy) | stonegate-visitor.vercel.app | (separate) | Single-property Brivo+Twilio kiosk. Fully deprecated — replaced by gatecard.co. Do not touch. |
| GateCard | gatecard.co | gatecard.co | **Property-level platform** — visitor management, resident kiosk, Brivo↔UniFi middleware, tenant self-service. Tier 2 interface deployed at every property. One codebase, N properties. All visitor/resident workflows belong here. |
| Dealer Portal | portal.gateguard.co | gateguard-portal (THIS REPO) | **Dealer-facing ops + field tech tool.** The OS for the GateGuard dealer network. Dealers, techs, sales reps, and property managers only. NOT residents, NOT visitors. |

**CRITICAL BOUNDARY — enforce every time:**
- Visitor management → gatecard.co
- Resident database sync (Brivo ↔ UniFi) → gatecard.co
- Property kiosk UI → gatecard.co
- Dealer ops, field service, quoting, billing, KB → THIS REPO (portal)
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

### Revenue & Billing
- `/billing` — Invoices + QuickBooks sync, MRR tracking
- `/renewals` — Contract renewal tracking + alerts
- `/revenue` — MRR trends, ARR, commission dashboard
- `/contracts` — Contract storage

### Field Service
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

### Platform & Tools
- `/kb` — AI diagnostic engine (vector search + Claude)
- `/tech` — Field diagnostic tool v4 (see /tech section below)
- `/portal` — Customer portal (property manager read-only)
- `/survey` — Site survey tool (DVI enhancement planned)
- `/onboarding` — Customer onboarding
- `/communications` — Internal messaging
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
- `MAPBOX_TOKEN` — (planned) for /map territory view

---

## Key Source Files

### /tech tool
| File | Purpose |
|------|---------|
| `app/tech/page.tsx` | All /tech screens. Screens: pin, home, choice, symptom, diag, wiring, cable, install, survey, survey_add. Demo modes: ?demo=install / ?demo=fault |
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
| `app/api/kb/resolve/route.ts` | Resolution capture + learning loop. Updates troubleshoot_sessions.resolved + embeds kb_article from symptom+history+fix note. Auth: x-tech-code. |

### Portal pages
| File | Purpose |
|------|---------|
| `components/layout/Sidebar.tsx` | Navigation. Add new routes here. |
| `app/quotes/[id]/approve/page.tsx` | Client-facing quote approval — no auth, no sidebar, full-screen |
| `app/reps/page.tsx` | Rep hierarchy + commission tracker (placeholder data) |
| `app/compliance/page.tsx` | Permit tracker (placeholder data) |
| `app/map/page.tsx` | Territory map (placeholder, needs Mapbox) |
| `app/scorecard/page.tsx` | Dealer scorecard (placeholder data) |
| `app/reports/page.tsx` | Roll-up reports (placeholder data) |
| `app/revenue/page.tsx` | MRR/ARR dashboard (placeholder data) |

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
- [ ] Client portal full build-out (Supabase RLS by org)
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
