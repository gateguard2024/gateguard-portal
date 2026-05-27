# GateGuard Portal — Claude Context (Active Reference)

> Last trimmed: May 26, 2026. Full sprint history, /tech docs, SARA Plus intel → CLAUDE.archive.md

---

## STANDING INSTRUCTIONS — Run Every Session

1. **Update PE Investor One-Sheet** at `/Users/russelfeldman/Desktop/Claude/GateGuard_PE_Investor_OneSheet.md` — check Traction section for new CRM numbers.
2. **EOS Language** — Rocks (quarterly), Scorecard (weekly), Issues (IDS), To-Dos, L10 (Fridays 6am with Nicole Gagliardi).
3. **Git push rule** — after every push: `git push origin main` then `git push origin main:beta`

---

## SESSION PROCESS RULES (enforce every task)

1. Before touching any code, list every file to be edited — if >3 files, confirm first
2. Never touch `PortalShell.tsx`, `Sidebar.tsx`, `layout.tsx`, `globals.css` unless explicitly named
3. One task = one commit
4. If git lock appears: stop, give exact `rm -f .git/index.lock .git/HEAD.lock` commands — no workarounds
5. Never "clean up," refactor, or rename anything not in scope
6. Never change light/dark mode, spacing, or fonts unless that is the specific request

---

## THE FOUR APPS — Never Confuse These

| App | Repo | URL | Purpose |
|-----|------|-----|---------|
| **Dealer Portal** | `gateguard-portal` | portal.gateguard.co | Dealer ops: quoting, field service, KB, billing, reps. **THIS REPO.** |
| **GateCard** | `gatecard.co` | gatecard.co | Property platform: visitor mgmt, resident kiosk, Brivo↔UniFi middleware |
| **SOC** | `gateguard-dispatch-ui` | ggsoc.com | Call center / SOC agent interface. Live. DO NOT BREAK. |
| **Visitor Kiosk** | (separate) | stonegate-visitor.vercel.app | Fully deprecated. Do not touch. |

**Hard rule:** Visitor mgmt/resident sync → gatecard.co. Dealer ops/quoting/field service → portal.

---

## DEPLOYMENT ENVIRONMENTS

| Environment | URL | Branch | Supabase | Rule |
|-------------|-----|--------|----------|------|
| **Beta** | beta.portal.gateguard.co | `beta` | Beta project | New features go here first |
| **Live** | portal.gateguard.co | `main` | Prod project | Only after Russel approves from beta |

**Always run migrations on beta Supabase first, then prod.**

---

## TECH STACK

- Next.js 14.2 App Router, TypeScript
- Supabase (pgvector for embeddings, RLS everywhere)
- Clerk auth — roles: `admin`, `supervisor`, `agent`, `dealer`
- `/tech` routes: `x-tech-code` header = `TECH_ACCESS_CODE` env var (no Clerk)
- Client approval pages (`/quotes/[id]/approve`, `/quotes/[id]/proposal`): no auth, public
- Claude Haiku `claude-haiku-4-5-20251001` — all KB/diagnostic/survey calls
- OpenAI `text-embedding-3-small` (1536 dims) — PDF chunk embeddings
- Mapbox GL JS v3.3.0 — `/map`, site detail pins, dispatch split-view
- Resend — transactional email. Env: `RESEND_API_KEY`
- Stripe — invoice payment links. Env: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

---

## DESIGN SYSTEM

- **Portal:** light theme, `#F8FAFC` bg, `#6B7EFF` brand blue, dark sidebar `#0C111D`
- **Sidebar gradient (May 2026):** `radial-gradient(ellipse at 50% 68%, #0d2150 0%, #060e28 38%, #020810 68%, #000306 100%)` — applied as inline style on `<aside>` in Sidebar.tsx; replaces flat `bg-[hsl(var(--sidebar-bg))]`
- **Tech tool:** two-tone — `#0B1728` dark navy topBar + `#FFFFFF` cards on `#EEF2FF` bg
- **Fonts:** Inter (portal) + IBM Plex Mono (tech tool headers, chips)
- **Step colors:** blue=VERIFY, amber=ACTION, green=RESOLVED, red=ESCALATE, purple=MEASURE
- **Never:** use `\n` in docx-js, unicode bullets, `WidthType.PERCENTAGE` in tables

---

## KEY SOURCE FILES

### Quotes
| File | Purpose |
|------|---------|
| `app/quotes/page.tsx` | List page — KPI sparklines, bar funnel pipeline, 2-col layout (table + Deal Velocity), filter tabs with counts |
| `app/quotes/new/page.tsx` | Mode picker: Line Item Builder + Survey Wizard |
| `app/quotes/[id]/page.tsx` | Full editor: sections, optional items, pricing sidebar, proposal v2 panels |
| `app/quotes/[id]/proposal/page.tsx` | Customer-facing proposal (no auth, no sidebar) |
| `app/quotes/[id]/approve/page.tsx` | Client approval page (no auth, no sidebar) |
| `app/api/quotes/route.ts` | GET (list) + POST (create) |
| `app/api/quotes/[id]/route.ts` | GET/PATCH/DELETE — includes migration 091 fields |
| `app/api/quotes/[id]/items/route.ts` | GET + POST line items |
| `app/api/quotes/[id]/items/[itemId]/route.ts` | PATCH + DELETE single item |
| `app/api/quotes/[id]/public/route.ts` | No-auth: approve/decline/sign |

**Quotes list design notes:**
- KPI sparklines: Active MRR (bar/green), Pipeline MRR (line/brand blue), Dealer Override (dashed/purple with green target line) — delta trend badges below each
- Pipeline funnel: horizontal bar per stage (Draft→Sent→Viewed→Accepted), clickable to filter table, proportional width to stage MRR
- 2-col bottom: `grid-cols-[1fr_280px]` — quotes table left, DealVelocityPanel right
- DealVelocityPanel: conversion funnel bars, avg time to Sent/View/Accept metric cards, win rate progress bar
- Filter tabs: underline style with live count badges, not button-group style

**Quotes new page design notes (`/quotes/new`):**
- `SCENARIO_TEMPLATES` array (module scope) defines 6 CPQ starting scenarios with pre-built `items[]`
- `CPQ_DEPS` map (module scope) defines SKU → required item descriptions for dependency checks
- `loadTemplate(scenario)` pre-populates `liItems`, sets `liStep(1)`, switches to `line_item` mode
- AI Voice Import card routes to `survey_import` mode instead of builder
- 3-col grid on lg screens; bottom row has Survey Wizard + Import Survey fallbacks
- `Package, ShieldCheck, Mic2` added to the require() import block

**Quote builder design notes (`/quotes/[id]`):**
- `CPQ_DEPS` (module scope) maps item SKU → required descriptions; builder shows amber warning if missing
- `MARGIN_APPROVAL_THRESHOLD = 25` — below this %, Send locks → "Request VP Approval"
- Estimated blended margin: hardware `subtotal * 0.53` cost assumption (47% margin), MRR `mrrTotal * 0.25` (75% margin) — replace with real `unit_cost` once migration 092 runs
- `viewMode` state (`'internal' | 'presentation'`) — toggle in top bar; Proposal View opens `/quotes/[id]/proposal` in new tab
- Internal Financial Summary sidebar card: SVG donut ring (green ≥40%, amber ≥25%, red <25%), revenue/cost rows, approval badge
- Auto-Approved badge (emerald) or Approval Required badge (amber) in top bar breadcrumb row

### /tech Field Tool
| File | Purpose |
|------|---------|
| `app/tech/page.tsx` | All /tech screens (single large client component) |
| `lib/wiring-library.ts` | 27 devices, 19 wiring maps (static verified) |
| `components/tech/WiringDiagram.tsx` | SVG renderer + merges static + Supabase device_suggestions |
| `components/tech/CableGuide.tsx` | CAT / 2-wire series / 2-wire parallel cable guides |
| `app/api/kb/ask/route.ts` | Claude diagnostic API |
| `app/api/kb/survey-proposal/route.ts` | SOW proposal generator |
| `app/api/kb/resolve/route.ts` | Resolution capture + learning loop |

### Portal Layout
| File | Purpose |
|------|---------|
| `components/layout/Sidebar.tsx` | Navigation — add new routes here |
| `components/layout/PortalShell.tsx` | Wraps all portal pages; detects standalone (tech/proposal/approve) |
| `components/layout/NexusAssistant.tsx` | Floating AI PA — alerts + chat |

### Surveys
| File | Purpose |
|------|---------|
| `app/survey/page.tsx` | Survey list + detail, AI SOW + BOM, Create Quote flow |
| `app/api/surveys/route.ts` | GET + POST (Clerk auth OR x-tech-code) |
| `app/api/surveys/[id]/generate/route.ts` | Claude Haiku → SOW + BOM from devices |
| `app/api/surveys/[id]/create-quote/route.ts` | Creates quote + line items from survey |

### CRM
| File | Purpose |
|------|---------|
| `app/crm/page.tsx` | CRM dashboard — KPI sparklines, funnel bars, forecast chart, AI Deal Scores, filter bar, activity quick-actions, lead comms icons |
| `app/crm/opportunities/page.tsx` | Full opportunities list (stage filter via `?stage=` param) |
| `app/crm/opportunities/[id]/page.tsx` | Opportunity detail |
| `app/crm/leads/page.tsx` | Full leads list |
| `app/crm/leads/[id]/page.tsx` | Lead detail + assign flow |
| `app/api/crm/opportunities/route.ts` | GET (list) + POST (create) — returns `records`, `grouped`, `pipelineTotal`, `counts` |
| `app/api/crm/leads/route.ts` | GET + POST |
| `app/api/crm/activities/route.ts` | GET + POST |
| `app/api/crm/assignable-orgs/route.ts` | Returns orgs the current user can assign leads/opps to |

**CRM design notes:**
- Open Opportunities sort: `updated_at → created_at` fallback (most recent activity first)
- AI Deal Score: deterministic from `opp.id` hash + stage band — no API call needed
- `Opportunity` interface includes `updated_at?: string` for sort
- Filter bar state is local only (Date Range, Region, Rep) — not yet wired to API filters

### Dealer Onboarding
| File | Purpose |
|------|---------|
| `app/admin/dealers/new/page.tsx` | 7-step onboarding wizard (org info → tier → NDA → relationships → commission → admin user → review) |
| `app/admin/dealers/[id]/page.tsx` | Dealer detail page — includes Compliance tab with e-sign doc cards + countersign flow |
| `app/api/admin/onboard-dealer/route.ts` | Creates org + admin user + fires NDA + Agreement signing emails via Resend |

### E-Sign / Document Compliance
| File | Purpose |
|------|---------|
| `lib/nda-template.ts` | Mutual NDA template — merge vars + `buildNdaHtml()` builder |
| `lib/agreement-template.ts` | Full Dealer & Reseller Agreement + Exhibit A — merge vars, `buildAgreementText()`, `buildAgreementVarsFromOrg()` helper |
| `app/sign/[token]/page.tsx` | Public token-based signing page — typed signature + IP capture; sends notification to rfeldman@gateguard.co on sign |
| `app/api/signatures/send/route.ts` | Creates `document_signatures` record + sends signing link via Resend (supports `org_id`) |
| `app/api/signatures/[token]/sign/route.ts` | Records counterparty signature, updates status → `counterparty_signed` |
| `app/api/signatures/countersign/route.ts` | Gate Guard countersignature — sets `countersigned_at`, `fully_executed: true` |
| `app/api/signatures/by-record/route.ts` | GET all sigs for an org: `/api/signatures/by-record?org_id=X` |

---

## CRITICAL BUILD GOTCHAS

### lucide-react Vercel cache mismatch (ALWAYS use require() for non-safe icons)

**Safe named imports** (always fine): Plus, X, Check, Clock, Calendar, Search, ChevronLeft/Right/Down/Up, Users, Mail, Phone, Wrench, Shield, Building2, MapPin, User, Settings, Home, FileText, Download, Upload, Eye, EyeOff, Loader, Loader2, RefreshCw, Save, Trash2, AlertTriangle, Info, Bell, Menu, Filter, MoreVertical, MoreHorizontal, Package, Globe, Link, Send, MessageSquare, Star, Key, Copy, ExternalLink, Wifi, CheckCircle2, XCircle, Activity, WifiOff, ArrowRight, Hash, Zap, Layers, TrendingUp, ClipboardList

**Always use require()**: Edit2, Edit3, Timer, Tag, Inbox, ArrowUpRight, ArrowLeft, Camera, DoorOpen, BookOpen, Cpu, BarChart3, DollarSign, Network, Tv, Archive, ShieldCheck, AlertCircle, Paperclip, PhoneCall, PhoneIncoming, PhoneOutgoing, Video, StickyNote, CheckSquare, Grid3X3, Truck, RotateCcw, Image, Target, Palette, Radio, GitBranch, SlidersHorizontal, Map, TrendingDown, CreditCard, Hammer, Server, Pen, Upload, ListChecks, UserCheck, Shield (when used as require)

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Edit2, Pen, RotateCcw, ListChecks } = require('lucide-react') as any
```

### Supabase PromiseLike vs Promise
Never use `.catch()` directly on Supabase queries. Use:
```typescript
void (async () => { try { await supabase.from('table').select() } catch (_) {} })()
```

### lib/current-user.ts
`getCurrentUser()` must extract `const id = user.id` before the return statement.

### Backtick template literals — `${{VAR}}` pitfall
When embedding `{{MERGE_VAR}}` placeholders inside a TypeScript backtick string, the sequence `${{` is parsed as a template interpolation start. TypeScript sees `${` and tries to evaluate `{VAR_NAME}` as an object shorthand — causing a build error.
**Fix:** escape the dollar sign: `` \${{MASTER_AGENT_OVERRIDE_AMOUNT}} `` → produces literal `${{MASTER_AGENT_OVERRIDE_AMOUNT}}` in the output string.

---

## DATABASE — KEY TABLES

- `organizations` — 6-tier hierarchy: corporate → master_agent → master_dealer → (sales/install_dealer/service_dealer) → client
- `sites` — installed properties. FKs: master_dealer_id, install_dealer_id, service_dealer_id
- `quotes` + `quote_line_items` — full quote system (migration 091 adds proposal v2 fields)
- `work_orders` + `technicians` — field service
- `products` + `manual_chunks` — equipment library with vector embeddings
- `kb_articles` + `troubleshoot_sessions` + `device_suggestions` — AI diagnostic system
- `surveys` — site survey records (migration 041)
- `trinity_calls` — TRINITY voice AI call log (migration 062)
- `invoices` + `invoice_line_items` + `commission_payouts` — billing (migration 050)
- `permits` — compliance tracker (migration 052)
- `training_progress` + `dealer_scorecards` — training/scorecard (migration 021)
- `floor_plans` + `floor_plan_devices` + esign tables — Design section (migration 071)
- `service_catalog` + enrollment tables — Service Marketplace (migration 070)

---

## MIGRATION STATUS (as of May 2026)

| Migration | What | Status |
|-----------|------|--------|
| 091 | Quote v2 columns (whats_included, agreement_html, attachments, signed_at, accepted_by_rep, etc.) | ✅ beta + prod |
| 071 | Floor plans + e-sign tables | Run on beta before design pages persist |
| 070 | Service catalog + enrollments | Run on beta before /services enrollment persists |
| 062 | trinity_calls | Run before /trinity data persists |
| 053 | gcal columns on user_settings | Run before Google Calendar OAuth works |
| 050-052 | Billing, site billing columns, permit documents | Run before /billing persists |
| 041-042 | Surveys + quotes enrichment | ✅ deployed |
| 021 | training_progress + dealer_scorecards | Run before /training + /scorecard live |
| 017 | org_tier enum + commission_config | MUST run on prod before dealer onboarding live |

---

## PENDING TASKS (prioritized)

### Completed this sprint (May 26, 2026 — continued)
- ✅ NDA template (`lib/nda-template.ts`) — Mutual NDA with 4 merge vars, 3-year term, Trade Secrets survive in perpetuity
- ✅ Agreement template (`lib/agreement-template.ts`) — Full Dealer & Reseller Agreement + Exhibit A; no hardcoded prices; references "then-current Price List"; `buildAgreementVarsFromOrg()` auto-fills from org tier + commission config
- ✅ Dealer onboarding wizard expanded to 7 steps — added Step 3 (NDA + Agreement preview + send toggle), `entity_type` field in Step 2, step numbering updated throughout
- ✅ `onboard-dealer` API route upgraded — fires real NDA + tier-appropriate Agreement signing emails on dealer creation; `sendDoc()` helper creates `document_signatures` record + Resend email
- ✅ Compliance tab on dealer detail page — live e-sign status cards for NDA + Agreement; "Send for Signature," "Resend," "Countersign," "Manual upload" actions; countersign flow POSTs to `/api/signatures/countersign`
- ✅ Sidebar gradient — Gemini-style deep radial navy-to-black glow applied to `<aside>` in Sidebar.tsx
- ✅ CLAUDE.md updated (this file) + NEXUS_USER_MANUAL.md created
- ✅ CRM dashboard enterprise redesign — `app/crm/page.tsx`: global filter bar (Date Range / Region / Rep), KPI sparklines (line + bar SVG), horizontal proportional funnel bars on pipeline, Pipeline Forecast & Goal Tracking stacked area chart, AI Deal Score column on Open Opportunities (deterministic hash of opp ID + stage → green/amber/red), activity quick-actions (Reply/Note/Complete on hover), lead communication icons (Mail/Phone/Calendar on hover), Open Opportunities sorted by `updated_at → created_at`, My Leads checks `assigned_dealer` before showing `+ Assign`, all accents `#6B7EFF`
- ✅ Quotes page enterprise redesign — `app/quotes/page.tsx`: KPI sparkline cards (Active MRR bar, Pipeline MRR line, Dealer Override target/dashed) with delta trend badges, horizontal bar funnel replacing 4-box chevron pipeline, 2-column bottom layout (quotes table left + Deal Velocity panel right), filter tabs with live counts per status, row hover actions (Eye/Edit/Copy/More), Deal Velocity panel shows quote conversion funnel bars + avg time metrics + win rate progress bar; all accents `#6B7EFF`, white card design system
- ✅ Scenario Gallery (`app/quotes/new/page.tsx`) — replaced 3-card picker with 6-card intent-driven gallery: Multi-Family Smart Core, Premium Gate & Access, Custom Package Mgmt, Comprehensive Security, Device-Only Hardware, AI Voice Import (Beta). Each card pre-populates line item builder with CPQ-correct starter items via `loadTemplate()`. Bottom row preserves Survey Wizard + Import Survey entry points. `CPQ_DEPS` map and `SCENARIO_TEMPLATES` array defined at module scope.
- ✅ CPQ Quote Builder (`app/quotes/[id]/page.tsx`) — added: CPQ dependency engine (checks item SKUs against `CPQ_DEPS`, surfaces amber warning banner for missing required items), margin estimation engine (hardware ~47% / MRR ~75% blended estimate), Internal Financial Summary sidebar card (margin donut ring, revenue/cost breakdown, approval badge), approval gateway (Send to Client locked → "Request VP Approval" when margin < 25%), Internal View / Proposal View toggle in top bar

### Pending for tomorrow (CPQ Phase 2)
- Add `unit_cost` column to `quote_line_items` table (migration) — enables real margin vs. estimated
- Make margin % column editable inline on line item table
- Wire up `isOptionalForClient` toggle column in builder table (already exists as `is_optional` in DB)
- Test full scenario walkthroughs: 92 W. Paces (Multi-Family), gate-only property, device-only deal
- Interactive Public Proposal (`/quotes/[id]/proposal`) — add client toggle add-ons + dynamic total recalc

### Active (in progress)
- Task #207 — Upgrade floor plans to Mapbox satellite backdrop
- Task #234 — Upgrade invoice modal: QB-style product picker + Mark as Paid

### High priority next
- Task #50 — Client portal at portal.gateguard.co/[site-slug] (property manager dashboard)
- Task #132 — Site Service Analytics tab on /sites/[id]
- Task #163 — NEXUS action tools — write/update To-Dos + WOs via chat
- Task #117 — Portal Help Center

### Pending env vars / infra
- `RESEND_API_KEY` — must be set on Vercel beta + prod for email
- `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — billing payment links
- `NEXT_PUBLIC_MAPBOX_TOKEN` — map/dispatch/site pins
- `TAVILY_API_KEY` — ARIA Deep Intel web search

### Feature backlog
- PWA manifest for /tech (Add to Home Screen)
- Photo evidence on work orders
- EOS persistence (Rocks/Scorecard/Issues/To-Dos → Supabase)
- LPR integration (Eagle Eye LPR → Brivo credential or gate relay)
- Site Survey photo capture per device
- Site Survey → push to quote builder
- SMS threads inside work orders (Twilio ↔ WO ID)
- Monthly client report auto-PDF
- Google Reviews post-WO SMS trigger
- Smart tester API (Fluke LINKWARE / IDEAL AnyWARE)

---

## SARA PLUS — ONE RULE

SARA Plus appears ONLY at `/migrate` (SARA Bridge wizard). **Zero other references anywhere in codebase.**
Full competitive intel (tech stack, API map, demo data schema) → CLAUDE.archive.md.

---

## AI ARMY — AGENT NAMES

ARIA (Lead Intel) · TRINITY (Voice) · SCOUT (Market) · BEACON (Client Comms) · FORGE (Quote Builder) · ATLAS (DirecTV) · SAGE (Training) · RELAY (Tier-1 Support)

Note: Voice agent is TRINITY (not ECHO). Sidebar.tsx reflects this.
