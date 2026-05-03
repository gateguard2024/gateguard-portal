# GateGuard Portal — Agent Context

## APPLICATION LANDSCAPE (read this first — get it right every time)

GateGuard runs four distinct applications. Never confuse them.

| App | URL | Repo | Purpose |
|-----|-----|------|---------|
| SOC Operations | ggsoc.com | gateguard-dispatch-ui | Call center interface for SOC staff. Live production. Twilio, Brivo, Eagle Eye, Supabase. DO NOT BREAK. |
| Visitor Kiosk (legacy) | stonegate-visitor.vercel.app | (separate) | Single-property Brivo+Twilio kiosk. Being replaced by gatecard.co. Do not build new features here. |
| GateCard | gatecard.co | gatecard.co | Multi-tenant visitor/resident kiosk. Replaces stonegate. One deployment, N properties. |
| Dealer Portal | portal.gateguard.co | gateguard-portal (THIS REPO) | Dealer-facing ops + field tech tool. The OS for the GateGuard dealer network. |

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
- `/quotes/[token]/approve` — **CLIENT-FACING** approval page (no auth/sidebar). Property managers approve/decline via signed token link. Full-screen branded standalone page.

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
- `POST /api/kb/process` — upload PDF manual, chunk + embed, store in Supabase Storage
- `POST /api/kb/ask` — AI diagnostic (vector search + Claude). Params: symptom, product_id, error_code, history, session_id, connected_devices[]
- `POST /api/kb/analyze-image` — Claude vision analysis of tech photos
- `GET  /api/kb/products` — product list for /tech (auth: x-tech-code header)
- `GET  /api/sync/residents` — Brivo → DB → UniFi reconciliation (cron + manual)

---

## Database
- `organizations` — 5-tier hierarchy (corporate → MSO → dealer → partner → client)
- `products` — equipment library (SKU, specs, manual_url, tags, field_service bool)
- `manual_chunks` — PDF chunks with 1536-dim embeddings
- `kb_articles` — authored troubleshoot articles with embeddings
- `troubleshoot_sessions` — diagnostic session logs
- `residents` — Brivo-sourced resident roster per org (mac_address for UniFi sync)
- `sync_log` — immutable log of every Brivo/UniFi sync run

**Planned tables:** `reps` (parent_rep_id, commission_rate, tier), `commissions` (per deal, payout status), `permits` (property, expiry_date, type), `service_packages` (canned job templates)

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

## Master Asset Library (Google Drive)
https://drive.google.com/drive/folders/0AMsXu78d6wafUk9PVA

Canonical source for product PDFs, brand assets, legal docs, historical project files.

---

## Manual Upload Pipeline — LIVE ✅ (May 2026)
1. Products in Supabase `products` table with `field_service=true`
2. Supabase Storage bucket `manuals` (public) — created May 2026
3. Upload via `/products` → Edit product → Upload PDF, OR bulk via `scripts/bulk-upload-manuals.mjs`
4. Pipeline: pdf-parse → chunkText() → embedBatch() (OpenAI text-embedding-3-small) → upsert `manual_chunks`
5. Searchable via `match_knowledge()` RPC in KB engine
6. `/tech` shows 📄 p.XX manual refs on AI step cards
7. OpenAI billing required — platform.openai.com/settings/billing

---

## /tech Field Tool — Key Differentiator ✅ (v4, May 2026)

**This is GateGuard's #1 competitive advantage. Always keep it best-in-class.**

Current capabilities:
- PIN auth via TECH_ACCESS_CODE (no Clerk required for field techs)
- Device picker from live products table (field_service=true), green dot = has manual
- **Connected devices selector** — tech marks what else is wired (Photobeam, Loop Detector, Callbox, etc.)
- **System topology awareness** — Claude knows device interconnections, guides isolation testing (jumper safety terminals, disconnect callbox relay, etc.)
- Symptom screen: quick-pick fault chips per category + free text + error code field
- AI step types: question / action / measure / select / photo / resolved / escalate
- Measure steps: unit + expected range display (e.g., "115±10 VAC")
- Photo capture + Claude vision analysis via `/api/kb/analyze-image`
- Manual references: p.XX links to PDF when chunk is matched
- Session logging to `troubleshoot_sessions`
- Light theme: #F1F5F9 bg, white cards, #6B7EFF brand blue, IBM Plex Mono
- Connected devices shown in diag header subtitle

Planned:
- PWA manifest + service worker (techs "Add to Home Screen")
- Digital Site Survey mode (walk property, photo each device, pass/warn/fail, auto-generate proposal)
- Commissioning wizard (new install checklist → as-built PDF)

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

### Phase 1 — Quick Wins (weeks)
- [x] Connected devices selector on /tech symptom screen
- [x] System topology awareness in Claude system prompt
- [ ] Photo evidence on work orders (reuse /tech photo component)
- [ ] Canned service packages in /products
- [ ] Automated renewal/PM reminders (Vercel cron + Twilio)
- [ ] In-app support widget (HelpScout Beacon — one script tag)
- [ ] PWA manifest for /tech

### Phase 2 — Dealer Network (1–2 months)
- [x] /reps — Rep & commission manager (placeholder built)
- [x] /compliance — Permit tracker (placeholder built)
- [x] /map — Territory map (placeholder built)
- [x] /scorecard — Dealer scorecard (placeholder built)
- [x] /reports — Roll-up reports (placeholder built)
- [x] /quotes/[token]/approve — Client approval page (built)
- [ ] SMS thread inside work orders (Twilio ↔ WO ID)
- [ ] Digital Site Survey (DVI for gates) — enhance /survey
- [ ] Client portal full build-out (Supabase RLS by org)
- [ ] Property Intelligence Card on dashboard

### Phase 3 — Category-Defining (3–6 months)
- [ ] Predictive maintenance engine (device age + cycles + KB patterns)
- [ ] Mapbox integration for /map
- [ ] As-built documentation PDF generator
- [ ] Monthly client report auto-PDF
- [ ] Resident self-service tickets via GateCard → creates WO
- [ ] Google Reviews post-WO SMS trigger
