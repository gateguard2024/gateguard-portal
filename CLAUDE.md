# GateGuard Portal — Claude Context (Active Reference)

> Last trimmed: May 27, 2026 (session 6). Full sprint history, /tech docs, SARA Plus intel → CLAUDE.archive.md

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

### Dashboard
| File | Purpose |
|------|---------|
| `app/page.tsx` | Tactical Hub Dashboard — 4 KPI cards, EOS + Team section, All Accounts table, System & Alerts ops panel |

**Dashboard design notes (`app/page.tsx`):**
- Server component — Supabase fetches: active account count, quote pipeline, open work orders, account rows (12 most recent)
- **4 grouped KPI cards:** Revenue & Pipeline, Ops Health, Account Growth, Critical Alerts — `grid-cols-2 lg:grid-cols-4`
  - Mobile: compact (icon + label header + one primary metric + 1-line sub). Secondary metrics hidden with `hidden lg:flex`
  - Desktop: full rich layout with dividers, secondary metrics, demo/live badges
- **EOS + Team Performance (3-col → single col mobile):** Q2 Rocks with per-rock status badges | Team XP (progress bar, streak, leaderboard) | Active Challenges + Scorecard Pulse — `grid-cols-1 lg:grid-cols-3`
- **Bottom row (2/3 + 1/3 → stacked mobile):** All Accounts table (`lg:col-span-2`) + System & Alerts ops panel — `grid-cols-1 lg:grid-cols-3`
  - Table hides "Added" date + row actions on mobile: `hidden lg:table-cell`
  - Row hover: "+ Add to L10" button + Eye + Settings
- **System & Alerts panel:** Alerts feed + Quick Actions grid (New Quote / Work Order / Add Account / View SOC) + Platform Status — all in one right column
- **Header:** TopBar with "+ Post Update" button inline next to AISearch
- Static data: `q2Rocks`, `scorecardPulse`, `teamLeaderboard`, `activeChallenges`, `notifications`
- Derived: `rocksOnTrack`, `myXP`, `xpNext`, `xpPct`
- lucide require(): `ShieldCheck, Target, Trophy`

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

### Dispatch
| File | Purpose |
|------|---------|
| `app/dispatch/page.tsx` | Dispatcher page — TopBar, KPI cards, Work Orders (list/board toggle), Tech Roster (leaderboard + per-tech codes), Schedule timeline; mobile 3-tab layout |
| `app/api/dispatch/technicians/route.ts` | GET (list, includes tech_code) + POST (add tech) |
| `app/api/dispatch/technicians/[id]/route.ts` | PATCH (update any field incl. tech_code) + DELETE |
| `lib/tech-auth.ts` | Shared `isTechAuthed(req)` — global env var OR per-tech DB code lookup |

**Dispatch design notes:**
- `boardLayout` state (`'list' | 'board'`) persisted to `localStorage` key `gg_dispatch_layout`
- `mobileTab` state (`'jobs' | 'schedule' | 'roster'`) controls mobile tab visibility
- Leaderboard: top 3 techs sorted by `techStreak(techId)` hash function (deterministic, 0–12 range)
- Per-tech codes: `GG-{INITIALS}-{4digits}` format; Generate/Regen calls `PATCH /api/dispatch/technicians/[id]` with `{ tech_code: code }`; Copy uses `navigator.clipboard.writeText()`
- `isTechAuthed()` checks global `TECH_ACCESS_CODE` env var first (fast, no DB), then queries `technicians.tech_code` — no changes needed in `/tech/page.tsx`
- Migration 093 must run before Generate Code flow works

### ARIA — Lead Intelligence
| File | Purpose |
|------|---------|
| `app/aria/page.tsx` | Full redesign: split list+detail layout, TopBar, `#F8FAFC` bg, 4 tabs (Property / Decision Maker / Intel / SCOUT), Intel DB panel, mobile 4-tab + bottom nav |
| `app/api/aria/research/deep/route.ts` | Single unified search: 12-15 Tavily + EDGAR + PUC + city permits + ISP press + Apollo + Proxycurl + PDL; Executive Truth Loop; Claude Sonnet synthesis; behavioral profile + pitch strategy + freshness score; auto-upserts to `aria_properties` after synthesis |
| `app/api/aria/searches/route.ts` | GET saved searches (scoped to org) + DELETE |
| `app/api/aria/searches/[id]/import/route.ts` | POST: stamp `assigned_to_user_id` + `assigned_to_name` + 7-day `temp_hold_expires_at` on import |
| `app/api/aria/scout/launch/route.ts` | POST: launch SCOUT outreach for imported lead IDs |
| `app/api/aria/usage/route.ts` | GET: my/org/hierarchy search counts |
| `app/api/aria/properties/route.ts` | GET (paginated + filterable intel DB) + POST (batch upsert from deep route) |
| `app/api/aria/properties/[id]/route.ts` | GET single + PATCH sales cycle fields (stage, notes, rep, contact date) |
| `supabase/migrations/094_aria_ownership.sql` | `show_leads.assigned_to_user_id`, `assigned_to_name`, `temp_hold_expires_at` |
| `supabase/migrations/098_aria_intelligence_db.sql` | `aria_properties` (persistent, never deleted) + `aria_tech_providers` (auto-growing catalog) + RPCs |

**ARIA page design notes (session 6 — single-search architecture):**
- **No more Base/Deep split** — one search type, always calls `/api/aria/research/deep` with `{ query }`
- Left panel (260px): search input + Launch ARIA button + prospect list + Re-run (↺) button on saved searches + example queries + saved searches when idle
- Right panel: `activeTab` state (`'property' | 'dm' | 'intel' | 'scout'`) — 4 tabs in detail header
- **Intel DB button** in TopBar (Globe icon + count badge) — toggles `IntelDBPanel` in right panel
- `IntelDBPanel`: search/filter bar (All / Critical / Expiring / SARA), property list with score + stage + expiry badges, detail panel with full proptech + connectivity + sales notes editor + stage selector + Re-research button
- Pipeline animation: 5-phase pipeline shown in right panel during `isRunning`; phases animate with `PHASE_DURATIONS` + `aria-fill` / `aria-shimmer` keyframes
- Mobile: `mobileTab` state (`'list' | 'property' | 'dm' | 'scout'`), bottom nav 4 tabs fixed at 56px
- `require()` needed for `LayoutList, ArrowLeft`

**ARIA deep engine (session 6 upgrade):**
- Model: `claude-sonnet-4-6`
- APIs (graceful fallback if keys absent): Apollo (`APOLLO_API_KEY`), Prospeo (`PROSPEO_API_KEY`), Proxycurl (`PROXYCURL_API_KEY`), PDL (`PDL_API_KEY`)
- Executive Truth Loop: Apollo wide net → ProxyCurl live LinkedIn validation → compare `ends_at: null` (current) vs expired
- New searches: temporal resident reviews (date-filtered, site-targeted), vendor footprint (uses live `mdu_providers` names from DB)
- Post-synthesis: non-blocking upsert to `aria_properties` + auto-catalog new tech providers into `aria_tech_providers`
- Prior contract findings from `aria_contract_findings` injected at start of synthesis
- Route accepts `{ query }` (not `{ property_name }`) — page always sends raw query string

**ARIA Intelligence Database (migration 098):**
- `aria_properties`: one row per property (upserted by every ARIA search, NEVER deleted by app). Fields: full property intel, proptech stack (gate/access/intercom/camera arrays), DM chain, behavioral_profile, pitch_strategy, `contract_expiry_year` (auto-extracted from bulk_agreements + contract_window), `sales_stage`, `sales_notes`, `assigned_rep`, `times_researched` counter
- `aria_tech_providers`: auto-growing catalog for gate/access/intercom/camera/lock/app vendors. 50+ seeded. `displacement_target` flag. `times_detected` counter increments with each ARIA search that finds them
- Future: query `?expiry_before=2027` to surface properties with agreements expiring in the next N years

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

### Calendar
| File | Purpose |
|------|---------|
| `app/calendar/page.tsx` | Full calendar — month/week/day grid, event detail popover, right sidebar (today's schedule + open To-Dos), GCal sync status |
| `app/api/calendar/events/route.ts` | GET all events: todos, work_orders, work_order_phases, pm_schedules, gcal_events, crm_activities |
| `app/api/calendar/google/status/route.ts` | GET GCal connection status — reads `gcal_refresh_token` + `gcal_last_synced_at` from `user_settings` |
| `app/api/calendar/google/sync/route.ts` | POST: pull GCal events → `gcal_events`; push portal todos/WOs → GCal; returns `diagnostics[]` |
| `app/api/calendar/google/connect/route.ts` | OAuth redirect to Google Calendar |
| `app/api/calendar/google/callback/route.ts` | OAuth callback — stores refresh token in `user_settings.gcal_refresh_token` |

**Calendar event types + colors:**
- `todo` — brand blue `#6B7EFF`
- `work_order` — emerald `#059669`
- `work_order_phase` — orange `#C2410C`
- `pm_schedule` — teal `#0B7285`
- `gcal` — purple `#7C3AED`
- `crm_activity` — varies by activity type (call=teal, email=blue, meeting=purple, task=amber, note=slate)

**gcal_events schema (migration 053):** `start_time timestamptz`, `end_time timestamptz`, `is_all_day boolean` — NOT `start_date`/`end_date` strings. Always write timestamptz columns when upserting.

**user_settings schema (migration 053):** One row per user (`user_id` PK). GCal columns: `gcal_refresh_token TEXT`, `gcal_last_synced_at TIMESTAMPTZ`. NOT a key-value table — never query with `.eq('key', '...')`.

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
| `app/api/crm/activities/[id]/route.ts` | PATCH (subject, body, type, due_at, outcome, duration_mins, completed_at / completed bool) + DELETE |
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

**Always use require()**: Edit2, Edit3, Timer, Tag, Inbox, ArrowUpRight, ArrowLeft, Camera, DoorOpen, BookOpen, Cpu, BarChart3, DollarSign, Network, Tv, Archive, ShieldCheck, AlertCircle, Paperclip, PhoneCall, PhoneIncoming, PhoneOutgoing, Video, StickyNote, CheckSquare, Grid3X3, Truck, RotateCcw, Image, Target, Palette, Radio, GitBranch, SlidersHorizontal, Map, TrendingDown, CreditCard, Hammer, Server, Pen, Upload, ListChecks, UserCheck, Shield (when used as require), LayoutList, LayoutGrid, Flame, Copy (when used as require)

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

## MIGRATION RULES — ALWAYS FOLLOW

### Supabase Data API grant requirement (enforced October 30, 2026)

Every migration that runs `CREATE TABLE` **must** include an explicit GRANT block immediately after the table definition. Without it, the table won't be accessible via PostgREST, GraphQL, or `supabase-js` after October 30, 2026.

**Standard pattern — copy into every new CREATE TABLE migration:**

```sql
-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.new_table_name TO postgres, anon, authenticated, service_role;
```

If the table has a sequence (serial / bigserial / identity columns), also add:

```sql
GRANT ALL ON SEQUENCE public.new_table_name_id_seq TO postgres, anon, authenticated, service_role;
```

Rules:
- `ALTER TABLE` migrations do **not** need a GRANT (existing table permissions are unchanged)
- `CREATE INDEX` migrations do **not** need a GRANT
- Only `CREATE TABLE` requires it
- Always add the GRANT immediately after the CREATE TABLE statement in the same migration file

**Example — correct migration structure:**

```sql
-- Migration 095: example new table
CREATE TABLE IF NOT EXISTS public.example_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Grant Data API access (required — Supabase enforces this Oct 30 2026)
GRANT ALL ON TABLE public.example_table TO postgres, anon, authenticated, service_role;
```

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
- `aria_properties` — persistent property intel DB (migration 098). Never deleted by app. Upserted by every ARIA deep search. Unique on `(lower(property_name), lower(address))`. Fields: full proptech stack, DM chain, behavioral_profile, pitch_strategy, `contract_expiry_year`, `sales_stage`, `sales_notes`, `times_researched`
- `aria_tech_providers` — auto-growing gate/access/intercom/camera/lock/app vendor catalog (migration 098). 50+ seeded. `displacement_target` flag. `times_detected` counter
- `mdu_providers` — ISP + video provider reference table (migration 071). 40+ seeded national/specialist/regional providers
- `mdu_provider_detections` — confirmed/suspected ISP/video provider at a specific property (migration 071)

---

## MIGRATION STATUS (as of May 2026)

| Migration | What | Status |
|-----------|------|--------|
| 098 | `aria_properties` (persistent intel DB) + `aria_tech_providers` (auto-growing catalog) + RPCs | ✅ beta + prod |
| 097 | document_signatures.document_html TEXT column | ✅ beta + prod |
| 096 | organizations.entity_type TEXT column | ✅ beta + prod |
| 095b | AI agent features + dealer.feature_settings in feature_catalog (ON CONFLICT UPDATE) | ✅ beta + prod |
| 095 | feature_catalog, org_feature_flags, user_feature_access | ✅ beta + prod |
| 094 | show_leads: assigned_to_user_id, assigned_to_name, temp_hold_expires_at | ✅ beta + prod |
| 093 | technicians.tech_code column + unique index (per-tech /tech login) | ✅ beta + prod |
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

### Completed — May 26, 2026
- ✅ NDA template (`lib/nda-template.ts`) — Mutual NDA with 4 merge vars, 3-year term, Trade Secrets survive in perpetuity
- ✅ Agreement template (`lib/agreement-template.ts`) — Full Dealer & Reseller Agreement + Exhibit A; no hardcoded prices; `buildAgreementVarsFromOrg()` auto-fills from org tier + commission config
- ✅ Dealer onboarding wizard expanded to 7 steps — added Step 3 (NDA + Agreement preview + send toggle), `entity_type` field in Step 2
- ✅ `onboard-dealer` API route upgraded — fires NDA + Agreement signing emails via Resend on dealer creation
- ✅ Compliance tab on dealer detail page — live e-sign status cards + Send / Resend / Countersign / Manual upload actions
- ✅ Sidebar gradient — Gemini-style deep radial navy-to-black glow in Sidebar.tsx
- ✅ CRM dashboard enterprise redesign — global filter bar, KPI sparklines, pipeline funnel, forecast area chart, AI Deal Scores, activity quick-actions, lead comms icons
- ✅ Quotes page enterprise redesign — KPI sparklines, bar funnel, 2-col layout (table + Deal Velocity panel), filter tabs with live counts
- ✅ Scenario Gallery (`/quotes/new`) — 6-card intent-driven gallery replacing 3-card picker; `loadTemplate()` pre-populates line item builder; `SCENARIO_TEMPLATES` + `CPQ_DEPS` at module scope
- ✅ CPQ Quote Builder (`/quotes/[id]`) — dependency engine (amber warnings for missing required items), margin engine (hardware ~47% / MRR ~75%), Internal Financial Summary sidebar (donut ring), approval gateway (Send locked below 25% margin → "Request VP Approval"), Internal/Proposal View toggle

### Completed — May 27, 2026 (session 2)
- ✅ Tactical Hub Dashboard (`app/page.tsx`) — full rewrite: 4 grouped KPI cards (Revenue & Pipeline, Ops Health, Account Growth, Critical Alerts), 3-col EOS + Team Performance section (Q2 Rocks / XP leaderboard / Active Challenges + Scorecard), All Accounts table with "+ Add to L10" row action, System & Alerts ops panel (alerts feed + quick actions + platform status), "+ Post Update" button in header
- ✅ TopBar on Quotes & Proposals page — added `<TopBar>` import + replaced inline `<h1>` header; "+ New Quote" passed via `actions` prop; `flex flex-col min-h-full` wrapper added to match site pattern
- ✅ PWA upgrade — `logo.png` resized → new `icon-192.png` + `icon-512.png`; `manifest.json` updated (name: "GateGuard Nexus", short_name: "Nexus", start_url: "/", theme_color: `#1c1917`, bg: `#F8FAFC`); `layout.tsx` updated (apple icon, appleWebApp title "Nexus", `viewportFit: 'cover'`, `maximumScale: 1`, theme color matches manifest)
- ✅ Responsive grid fixes (desktop unchanged, all via `lg:`/`sm:` prefixes) — `app/page.tsx`, `app/crm/page.tsx`, `app/quotes/page.tsx`, `app/quotes/new/page.tsx`
- ✅ Mobile dashboard fix — compact KPI card format on mobile (icon + label + primary metric + 1-line sub); secondary metrics/dividers hidden with `hidden lg:flex`; accounts table "Added" + actions columns hidden with `hidden lg:table-cell`; EOS/Team stacks single col on mobile
- ✅ Dispatch page enterprise redesign (`app/dispatch/page.tsx`) — TopBar header, `#F8FAFC` bg, portal card style, `#6B7EFF` throughout; Work Orders panel with list/board toggle (localStorage persisted); Tech Roster with leaderboard (top 3 by streak), per-tech `/tech` access codes (Generate/Regen/Copy); mobile 3-tab layout (Jobs / Schedule / Roster)
- ✅ `lib/tech-auth.ts` — shared `isTechAuthed()` helper: checks global `TECH_ACCESS_CODE` env var first, then `technicians.tech_code` in DB; all 7 `/api/kb/*` routes migrated to use it
- ✅ Migration 093 (`supabase/migrations/093_tech_code.sql`) — `technicians.tech_code TEXT` column + unique partial index; run on beta then prod
- ✅ ARIA page full redesign (`app/aria/page.tsx`) — split list+detail layout, TopBar, `#F8FAFC` bg, 4-tab detail panel (Property / Decision Maker / Intel / SCOUT), pipeline animation in right panel, mobile 4-tab + fixed bottom nav
- ✅ ARIA deep engine upgrade (`app/api/aria/research/deep/route.ts`) — Claude Sonnet synthesis, Apollo contact search, behavioral_profile + pitch_strategy + freshness_score + buying_trends output fields, graceful API fallback for all 4 new APIs
- ✅ Migration 094 (`supabase/migrations/094_aria_ownership.sql`) — `show_leads.assigned_to_user_id`, `assigned_to_name`, `temp_hold_expires_at` + indexes
- ✅ ARIA import route (`app/api/aria/searches/[id]/import/route.ts`) — stamps ownership + 7-day temp hold on every imported lead

### Completed — May 27, 2026 (session 5) — Google Calendar, Todos, Dealer Resume Flow, Email Fix
- ✅ Fixed build error: `Eye, EyeOff` moved from named imports to `require()` block in `dealers/new/page.tsx`
- ✅ Fixed build error: `auth()` → `getCurrentUser()` in `app/api/admin/users/route.ts` POST handler (auth import removed in earlier session, POST still referenced it)
- ✅ Google Calendar status route (`app/api/calendar/google/status/route.ts`) — fixed: was using KV-style `.eq('key', 'google_calendar_refresh_token')` on `user_settings`; rewrote to `.select('gcal_refresh_token, gcal_last_synced_at').eq('user_id', user.id).maybeSingle()` matching actual migration 053 schema
- ✅ Google Calendar sync route (`app/api/calendar/google/sync/route.ts`) — full rewrite fixing 3 bugs: (1) token read was KV lookup, (2) gcal_events upsert wrote `start_date`/`end_date` (columns don't exist) → now `start_time`/`end_time` timestamptz + `is_all_day`, (3) push tracking used fake KV rows → now uses `gcal_events.source_type`/`source_id`; added `diagnostics: string[]` array in response; all upserts now `await`ed with error checking; `getAccessToken()` returns descriptive `{ token, error }` object
- ✅ Calendar events route (`app/api/calendar/events/route.ts`) — fixed gcal token check (KV → column), fixed gcal_events query (`start_date` → `start_time`), added CRM activities (`crm_activities` by `due_at` range), work order phases (`work_order_phases` by `scheduled_date`), PM schedules (`pm_schedules` by `next_due_at`)
- ✅ Calendar page (`app/calendar/page.tsx`) — updated `CalendarEvent` type + `colorForType()` / `bgForType()` / `badgeLabel` / `typeLabel` for 3 new event types: `work_order_phase` (orange), `pm_schedule` (teal), `crm_activity` (violet); legend updated; "View opportunity" action button in CRM event popover
- ✅ Todos API (`app/api/todos/route.ts`) — added `unscheduled=true` param (filters `due_date IS NULL`), `limit` param; changed return to include both `{ todos: data, records: data }` keys — calendar sidebar reads `d.records`, was always empty before
- ✅ Dealer onboarding resume flow — `dealers/new/page.tsx` reads `?resume=ORG_ID` param via `useSearchParams`; `useEffect` fetches existing org + signatures and pre-fills all `WizardState` fields; auto-advances to correct incomplete step (no NDA → step 3; no parent_org_id → step 4; no commission → step 5; no agreement → step 6; no contact_email → step 7; else → step 8); loading spinner while fetching
- ✅ Dealer list page (`app/admin/dealers/page.tsx`) — last column: incomplete dealers (onboarding_complete = false) show amber "Resume →" link to `/admin/dealers/new?resume=${org.id}` instead of plain ChevronRight
- ✅ Dealer detail page (`app/admin/dealers/[id]/page.tsx`) — amber "Onboarding incomplete" banner below breadcrumb with "Resume Onboarding →" link when `!org.onboarding_complete`
- ✅ NDA template (`lib/nda-template.ts`) — full rewrite to v2: added §3 Legally Compelled Disclosure, §5 IT Backup Exception, §6 Mutual Non-Solicitation (12 months); bulleted obligations; "AS IS" disclaimer; "without the necessity of posting a bond"; state + federal venue in Fulton County; sections renumbered 1–9; merge vars unchanged
- ✅ Signatures send route (`app/api/signatures/send/route.ts`) — fixed silent email failure: (1) added RESEND_API_KEY existence check returning 503 before send attempt, (2) destructure + check `const { error: emailError } = await resend.emails.send(...)` and return 502 with descriptive message if delivery fails, (3) fixed from address `mail.gateguard.co` → `gateguard.co` (verified domain); success response now includes `email_sent: true`

### Completed — May 27, 2026 (session 4) — Dealer Onboarding Fixes + Security + Document Flow
- ✅ Feature Settings page UX redesign — replaced 3-button toggle groups with compact color-coded `<select>` dropdowns; Stripe ID / Paid / Beta collapsed into expandable ⚙ row per feature; sections now collapsible with unsaved-change count badge
- ✅ Migration 095b (`supabase/migrations/095b_ai_agent_features.sql`) — 8 AI Army agents added to `feature_catalog` (ai.aria, ai.trinity, ai.scout, ai.beacon, ai.forge, ai.atlas, ai.sage, ai.relay) + missing `dealer.feature_settings` key; uses `ON CONFLICT DO UPDATE`
- ✅ Sidebar Access Control quick-link strip — "Access Control" section with Features / Dealers / Users icon buttons, visible to corporate users only, above main nav; AI Army agents now feature-gated via `featureFlags` map; all 8 agent hrefs wired; `HREF_TO_FEATURE` updated for AI agent keys
- ✅ Migration 096 (`supabase/migrations/096_org_entity_type.sql`) — `ALTER TABLE organizations ADD COLUMN entity_type TEXT` to fix "Could not find 'entity_type' column" error in onboarding
- ✅ API security: org hierarchy scoping across 3 routes:
  - `onboard-dealer GET`: fixed `parent_id` → `parent_org_id` bug; extended auth to `master_dealer`; `TIER_RANK` map ensures callers can only see tiers strictly below their own
  - `admin/users GET`: added `getCurrentUser()` auth gate (was open to any logged-in user); non-corporate users see only users in their org + direct child orgs; pending invitations corporate-only
  - `dealers/[id] GET+PATCH`: subtree check — non-corporate blocked if requested org is not own, direct child, or grandchild
- ✅ Migration 097 (`supabase/migrations/097_sig_document_html.sql`) — `ALTER TABLE document_signatures ADD COLUMN document_html TEXT`
- ✅ NDA + Agreement editable preview in wizard (Step 3 + Step 6):
  - Effective Date field (defaults to today, editable)
  - "Preview & Edit" toggle opens full rendered document in an editable `<textarea>`; merge vars pre-filled from form data
  - Edited text passed to `/api/signatures/send` as `document_html`
  - Send route stores `document_html` in `document_signatures`
  - Sign page (`/sign/[token]`) displays `document_html` inline when no PDF URL; signer sees the exact reviewed text
- ✅ Agreement preview (Step 6) — same pattern as NDA; 28-row textarea with full Agreement + Exhibit A text

### Completed — May 27, 2026 (session 3) — Feature Flag System
- ✅ Migration 095 (`supabase/migrations/095_feature_flags.sql`) — 3 new tables: `feature_catalog` (41 seeded features), `org_feature_flags`, `user_feature_access`; all with GRANT blocks
- ✅ API: `GET/PATCH /api/admin/features` — corporate-only global catalog management (tier_defaults, paid/beta flags, Stripe ID)
- ✅ API: `GET/PATCH /api/admin/org-features/[orgId]` — per-org feature overrides with hierarchy enforcement (caller can't grant > own level)
- ✅ API: `GET/PATCH /api/admin/user-features/[userId]` — per-user feature overrides, org-capped; requires `org_id` query param
- ✅ API: `GET /api/user-features/me` — lightweight endpoint returning current user's effective `Record<featureKey, 'none'|'view'|'edit'>` for sidebar filtering; corporate users get `edit` on everything; others: tier_defaults → org_feature_flags (expires_at filtered) → user_feature_access
- ✅ Global Feature Settings (`app/admin/settings/features/page.tsx`) — GateGuard admin page; features grouped by section; per-tier access selectors (None/View/Edit); paid/beta toggles; Stripe product ID field; dirty tracking with amber dot indicators; save button with change count
- ✅ Features tab on dealer detail page (`app/admin/dealers/[id]/page.tsx`) — new `FeaturesTab` component + `'features'` tab key; calls `GET/PATCH /api/admin/org-features/[orgId]`; shows tier-inherited default, access level selector, promo toggle, expiry date, notes; dirty tracking + save
- ✅ Platform Users page upgraded (`app/admin/users/page.tsx`) — "Role & Modules" + "Feature Access" tab switcher in right panel; `FeatureAccessSelector` component caps options at org level (greyed out above cap); feature save calls `PATCH /api/admin/user-features/[userId]`
- ✅ Sidebar feature gating (`components/layout/Sidebar.tsx`) — fetches `/api/user-features/me` on mount; `isFeatureVisible()` hides items with `none` access; `HREF_TO_FEATURE` map covers all 41 features; "Feature Settings" nav item added to Dealer Network section (corporate/admin only)

**Feature hierarchy:** GateGuard sets tier_defaults in feature_catalog → org override in org_feature_flags → user override in user_feature_access. User ≤ org ≤ tier_default. MSO/Full Dealer can set ≤ their own effective level. None = hidden from sidebar entirely.

### Completed — May 27, 2026 (session 6) — ARIA Intelligence DB + Single Search Mode
- ✅ ARIA page (`app/aria/page.tsx`) — removed Base/Deep toggle; all searches always use deep route with `{ query }`; added ↺ Re-run button on SavedSearchRow; added Intel DB panel (Globe button, count badge) with search/filter + property list + sales notes editor + stage selector + Re-research button
- ✅ Migration 098 (`supabase/migrations/098_aria_intelligence_db.sql`) — `aria_properties` persistent intelligence table (never deleted, upserted on every search); `aria_tech_providers` auto-growing vendor catalog (50+ seeded); `increment_*` RPCs for atomic counters; GRANT blocks; deployed beta + prod
- ✅ `app/api/aria/properties/route.ts` — GET (paginated, filterable by stage/urgency/sara/expiry/search) + POST (batch upsert from deep route, extracts `contract_expiry_year`, auto-catalogs tech providers)
- ✅ `app/api/aria/properties/[id]/route.ts` — GET single + PATCH sales cycle fields only
- ✅ `app/api/aria/research/deep/route.ts` — post-synthesis non-blocking upsert to `aria_properties`; Executive Truth Loop (Apollo → ProxyCurl validation); temporal resident review searches; vendor footprint using live DB provider names; Haiku sentiment pre-pass; accepts `{ query }` not `{ property_name }`
- ✅ `app/api/crm/activities/[id]/route.ts` — PATCH (edit subject/body/type/due_at/outcome/duration_mins/completed) + DELETE; inline edit UI on opportunity detail with complete/edit/delete icon buttons
- ✅ GCal push fix (`app/api/calendar/google/sync/route.ts`) — todos scoped to current user, per-item error capture + diagnostics, WO end time = start + 1hr (was zero-duration, rejected by Google)

### Pending — Migrations to Run
- All migrations 093–098 are now deployed on beta + prod ✅

### Pending — CPQ Phase 2
- Add `unit_cost` column to `quote_line_items` (migration 092) — enables real margin vs. estimated
- Make margin % column editable inline per line item
- Wire up `isOptionalForClient` toggle column in builder table (`is_optional` already in DB)
- Test full scenario walkthroughs: 92 W. Paces (Multi-Family), gate-only property, device-only deal
- Interactive Public Proposal (`/quotes/[id]/proposal`) — client toggle add-ons + dynamic total recalc

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
- `TAVILY_API_KEY` — ARIA Base + Deep Intel web search
- `APOLLO_API_KEY` — ARIA Deep: contact enrichment at management company
- `PROSPEO_API_KEY` — ARIA Deep: LinkedIn email format finder
- `PROXYCURL_API_KEY` — ARIA Deep: LinkedIn profile scraper
- `PDL_API_KEY` — ARIA Deep: behavioral/psychographic enrichment

### Feature backlog
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
