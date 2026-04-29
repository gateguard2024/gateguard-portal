# GateGuard OS — Platform Context
> Last updated: 2026-04-28 | Always update this file at the end of each session.

---

## Vision
**GateGuard OS** — the all-in-one security operations platform for multifamily, HOA, and commercial properties. A fully white-labelable, channel-partner-ready SaaS that unifies cameras, access control, billing, quoting, CRM, and maintenance into a single scalable ecosystem.

Built for dealers. Sold to properties. Designed to replace every fragmented tool in the security stack — including Salesforce.

Design philosophy: **iOS-level polish, as powerful as a quantum computer.** Sleek and modern but not overly dark. World-class dealer tool.

---

## Brand
- **Company:** GateGuard, LLC
- **Site:** portal.gateguard.co | ggsoc (Security Operations Center)
- **Email:** rfeldman@gateguard.co
- **Tagline:** Unrivaled Security. Proactive Multi-Family Security.
- **Markets:** Multi-Family Apartments, HOA Communities, Commercial Estates

---

## Brand Colors (CURRENT — updated from original cyan)
| Token | Hex | Usage |
|-------|-----|-------|
| `brand-400` (primary) | `#2563EB` (blue) | CTAs, active states, sidebar accent |
| `--primary` CSS var | `217 91% 53%` HSL | Tailwind `text-brand-400`, `bg-brand-400` |
| `--background` | `210 20% 95%` | Very light cool grey canvas |
| `--card` | `0 0% 100%` | White tiles (light mode locked) |
| `--sidebar-bg` | `214 55% 8%` | Deep navy sidebar (dark, unchanged) |

**Important:** The portal is **light-locked** (`forcedTheme="light"` in ThemeProvider). No dark mode toggle. Sidebar stays dark navy always.

---

## Tech Stack
| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Hosting | Vercel |
| Database | Supabase (PostgreSQL + Realtime + RLS) |
| Auth | Clerk (multi-tenant, orgs) — not yet wired live |
| SMS/Comms | Twilio — pending setup |
| Email | TBD (Resend / SendGrid / Postmark candidates) |
| Styling | Tailwind CSS + shadcn/ui |
| Language | TypeScript |
| Repo | GitHub → `gateguard-portal` |
| Icons | lucide-react 0.383.0 — **IMPORTANT: missing `.d.ts`** |

### lucide-react icon caveat
All icons exist at runtime but the package is missing its TypeScript declaration file.
**Fix:** All icon names used in the project must be declared in `/types.d.ts`.
Any new icon you import must be added to that file or the Vercel build will fail.

---

## Organization Hierarchy (5 Tiers)
```
GateGuard Corporate (Tier 0)       ← org_tier: 'corporate'
│
├── Master System Operator (Tier 1) ← org_tier: 'mso'
│   Large dealer groups / regional operators
│   e.g., "Southeast Security Group"
│
├── System Operator / Dealer (Tier 2) ← org_tier: 'dealer'
│   Individual dealers, installers
│   e.g., "SecureATL", "Peach State Access"
│
├── Channel Sales Partner (Tier 3)  ← org_tier: 'partner'
│   Resellers, agents, property mgmt companies
│   e.g., "Realty Referrals LLC"
│
└── Client (Tier 4)                 ← org_tier: 'client'
    Individual properties: apartments, HOAs, commercial
    e.g., "Stonegate Townhomes", "Ashford Glen"
```

Hierarchy is enforced via `parent_id` on the `organizations` table in Supabase.
The seed corporate org ID is: `00000000-0000-0000-0000-000000000001`

---

## What's Built (as of 2026-04-28)

### Pages Live
| Route | Status | Notes |
|-------|--------|-------|
| `/` | ✅ Built | Dashboard — KPIs, camera status, recent activity |
| `/customers` | ✅ Built | Customer list with filters |
| `/crm` | ✅ Built | Pipeline board (Kanban) + list view toggle |
| `/crm/leads/[id]` | ✅ Built | Lead detail — contact, lock countdown, activity feed |
| `/crm/opportunities/[id]` | ✅ Built | Opp detail — stage bar, linked quote, activity feed |
| `/cameras` | ✅ Built | Camera grid with status indicators |
| `/access` | ✅ Built | Access control — doors, events |
| `/quotes` | ✅ Built | Quote pipeline list |
| `/quotes/new` | ✅ Built | 4-step quote wizard |
| `/quotes/[id]/proposal` | ✅ Built | Public shareable proposal page |
| `/maintenance` | ✅ Built | Work orders |
| `/billing` | ✅ Built | Billing/invoices |
| `/settings` | ✅ Built | Settings — pricing config (collapsible, inline-editable) |
| `/admin` | ✅ Built | Organizations hierarchy tree + invite drawer |

### Database (Supabase)
Both migrations have been **successfully run** in the Supabase project:
- `001_initial_schema.sql` — orgs, profiles, properties, devices, contacts, quotes, work orders, invoices, leads, activity log, RLS policies, `auth_org_id()` helper
- `002_crm_phase1.sql` — companies, opportunities, customers, activities, attachments, contact_properties, company_properties; automation triggers (auto-create customer on win, mark lead converted)

### CRM Data Model
```
leads           → type: lead_stage (new/contacted/qualifying/converted/dead...)
companies       → client orgs (Pegasus Residential, Columbia Residential, etc.)
contacts        → people; can link to multiple properties via contact_properties
opportunities   → deals; link to lead, contact, company, property, quote, rep
customers       → auto-created when opportunity.stage → 'won'
activities      → CRM timeline: call/email/meeting/note/task
attachments     → proposals, contracts, photos
```

### Quote / Pricing Engine
- Pricing config lives in `/types/quote.ts` (PRICING constant)
- Tiers: Monthly SaaS, Tier 1 (gate/door), Tier 2 (resident gate/intercom), Network backhaul, Cameras, Add-ons
- Settings page has full inline-editable pricing UI (collapsible section)
- **TODO:** Pricing config section should be wrapped in a top-level collapsible accordion on settings page

---

## Salesforce Reference (Current CRM being migrated FROM)
From Salesforce screenshots shared 2026-04-27:
- **44 active opportunities**, $3.5M+ pipeline
- **1.5K accounts**, 23 contacts
- **SF stage names:** Meet & Present → Survey Request → Propose → Negotiate → Closed Won
- **Our stage names:** new → contacted → qualifying → inquiry → site_walk → proposal → negotiation → won
- **TODO:** Align CRM stage display labels to match SF names for clean data migration
- Opportunity naming convention: `"[Property Name] — Gate + Camera"` or `"Your Gate Guard — [Property]"`
- Deal sizes typically $5K–$175K setup; MRR $600–$4,200/mo

---

## Pending / Next Up (Priority Order)

### Immediate (next session)
1. **Align CRM stage names** — rename `site_walk` → `survey_request`, update display labels to match Salesforce workflow (Meet & Present, Survey Request, Propose, Negotiate, Won)
2. **Contacts page** (`/crm/contacts`) — list + search contacts, link to companies + properties
3. **Companies page** (`/crm/companies`) — list companies, associated contacts + properties + opportunities
4. **Seller Home / CRM Dashboard** — personal rep view with donut charts (pipeline value, accounts, leads, today's events) similar to Salesforce Seller Home

### Short-term
5. **Wire quote wizard → opportunities** — pre-fill property from opportunity, link back via `opportunity.quote_id`
6. **Convert to Opportunity flow** — from lead detail page, "Convert" button creates opportunity record
7. **Mark Won flow** — from opportunity detail, "Mark Won" auto-creates customer record (trigger exists in DB)
8. **Salesforce data migration script** — Node.js script to read SF CSV exports and batch-insert into Supabase (Accounts → companies, Contacts → contacts, Leads → leads, Opportunities → opportunities)

### Infrastructure (when ready to go live)
9. **Clerk auth wire-up** — Clerk org IDs → Supabase `profiles.clerk_user_id`, `auth_org_id()` function live
10. **Supabase replace mock data** — swap all mock arrays for real Supabase queries
11. **Email server** — pick from Resend / SendGrid / Postmark; wire to invite flow + activity emails
12. **Twilio** — SMS alerts for tech dispatch, 2FA, dealer notifications
13. **Payment routing** — Stripe Connect primary candidate; per-tier revenue split (GG cut → MSO cut → Dealer cut) configurable in admin settings; QuickBooks as accounting layer

### Future
14. **EagleEye live API** — replace mock camera data
15. **Brivo live API** — replace mock access control data
16. **SOC page** — multi-account camera monitoring grid
17. **QuickBooks sync** — invoice/payment sync
18. **White-label portals** — per-dealer branding, subdomain routing
19. **AI features** — video search, proposal generator, anomaly detection

---

## Key Files
```
gateguard-portal/
├── CONTEXT.md                      ← THIS FILE — update every session
├── types.d.ts                      ← lucide-react icon whitelist — ADD new icons here
├── types/
│   └── quote.ts                    ← PRICING constant + all quote types
├── app/
│   ├── layout.tsx                  ← Root layout, ThemeProvider (forcedTheme="light")
│   ├── globals.css                 ← All CSS vars, light mode tokens, sidebar styles
│   ├── page.tsx                    ← Dashboard
│   ├── crm/
│   │   ├── page.tsx                ← Pipeline board + list view
│   │   ├── leads/[id]/page.tsx     ← Lead detail
│   │   └── opportunities/[id]/page.tsx  ← Opportunity detail
│   ├── quotes/
│   │   ├── page.tsx                ← Quote list
│   │   ├── new/page.tsx            ← 4-step wizard
│   │   └── [id]/proposal/page.tsx  ← Public proposal
│   ├── admin/page.tsx              ← Org hierarchy tree + invite
│   └── settings/page.tsx          ← Pricing config + settings
├── components/layout/
│   ├── Sidebar.tsx                 ← Nav sections, integrations status
│   └── TopBar.tsx                  ← Header with user pill
└── supabase/migrations/
    ├── 001_initial_schema.sql      ← ✅ Run
    └── 002_crm_phase1.sql          ← ✅ Run
```

---

## Design Rules (do not break these)
- **Light mode locked** — white cards, light grey canvas, dark navy sidebar always
- **Brand blue** = `#2563EB` — use for CTAs, active nav, primary buttons
- **Sidebar** stays dark (`214 55% 8%`) even in light mode
- **Card elevation** — `.bg-card` has subtle shadow (defined in globals.css)
- **Font floor** — nothing below 10px (enforced via globals.css)
- **Sidebar active** — left border accent bar (2px blue, defined in globals.css)
- **lucide icons** — must be declared in `types.d.ts` before use

---

## Org Seed Data (already in DB)
```
id:    00000000-0000-0000-0000-000000000001
name:  GateGuard, LLC
tier:  corporate
email: rfeldman@gateguard.co
slug:  gateguard
```
