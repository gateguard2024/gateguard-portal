# GateGuard Portal — Claude Context (Active Reference)

> Last trimmed: May 2026. Full sprint history, /tech docs, SARA Plus intel → CLAUDE.archive.md

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
- **Tech tool:** two-tone — `#0B1728` dark navy topBar + `#FFFFFF` cards on `#EEF2FF` bg
- **Fonts:** Inter (portal) + IBM Plex Mono (tech tool headers, chips)
- **Step colors:** blue=VERIFY, amber=ACTION, green=RESOLVED, red=ESCALATE, purple=MEASURE
- **Never:** use `\n` in docx-js, unicode bullets, `WidthType.PERCENTAGE` in tables

---

## KEY SOURCE FILES

### Quotes
| File | Purpose |
|------|---------|
| `app/quotes/new/page.tsx` | Mode picker: Line Item Builder + Survey Wizard |
| `app/quotes/[id]/page.tsx` | Full editor: sections, optional items, pricing sidebar, proposal v2 panels |
| `app/quotes/[id]/proposal/page.tsx` | Customer-facing proposal (no auth, no sidebar) |
| `app/quotes/[id]/approve/page.tsx` | Client approval page (no auth, no sidebar) |
| `app/api/quotes/route.ts` | GET (list) + POST (create) |
| `app/api/quotes/[id]/route.ts` | GET/PATCH/DELETE — includes migration 091 fields |
| `app/api/quotes/[id]/items/route.ts` | GET + POST line items |
| `app/api/quotes/[id]/items/[itemId]/route.ts` | PATCH + DELETE single item |
| `app/api/quotes/[id]/public/route.ts` | No-auth: approve/decline/sign |

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

### Active (in progress)
- Task #207 — Upgrade floor plans to Mapbox satellite backdrop
- Task #234 — Upgrade invoice modal: QB-style product picker + Mark as Paid
- Task #240 — Update NEXUS User Manual v10 with per-tech login system
- Task #253 — CLAUDE.md trim ✅ (this file)

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
