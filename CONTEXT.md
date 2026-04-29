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

### Payment & Accounting Architecture (DECIDED)
- **Stripe Connect** — primary payment processor; handles revenue split at transaction time
  - GateGuard takes platform fee, remainder routes to dealer
  - MSO and Channel Partner cuts configured per-org in admin settings
  - Connected accounts per dealer — they get paid directly
- **QuickBooks — Native API only** (no Make/Zapier — too fragile, recurring cost, no control)
  - GateGuard OS is system of record for WHAT is billed
  - QuickBooks is accounting layer only — receives invoices, customers, payments
  - Sync: new customer won → QB customer; invoice generated → QB invoice; payment received → QB payment posted
  - Do NOT push journal entries only — loses AR aging, customer balances, overdue tracking
  - Payroll, 1099s, bank reconciliation stay in QB directly (not touched by GateGuard OS)
  - Each dealer org can optionally connect their own QB account
- **Phase:** Stripe Connect first, then QB native API after Stripe is live

### Maintenance Module — MaintainX-Inspired Gaps to Build
MaintainX is the gold standard for field service. Our maintenance module needs:
- **Procedure templates / checklists** — step-by-step job cards per job type (camera install, gate install, PM visit). Tech must check off each step. Attached to work orders.
- **Parts & inventory** — track stock at warehouse + per-tech van. WO completion auto-decrements. Low-stock alerts.
- **Photo attachments on WOs** — techs attach before/after photos from mobile
- **Cost tracking per WO** — labor hours (auto from time-in/time-out) + parts cost = job profitability
- **Dispatcher board** — real-time view of all open jobs, which tech is assigned, ETA, status. Like a Kanban but for field ops.
- **Tech mobile view** — mobile-optimized work order interface; turn-by-turn nav to job site; signature capture on completion
- **Automated customer notifications** — "Tech is on the way" SMS; "Your job is complete" with summary

### Customer-Facing Billing Portal (NEEDED — "/billing/customer" or subdomain)
End customers need their own billing section to:
- View their active subscription — what cameras, doors, services they're paying for
- See and pay invoices online (ACH / card via Stripe)
- Download invoice history / statements
- Update payment method on file
- View contract terms and renewal date
- Submit a support/service request
- This should be white-labeled per dealer (dealer's logo, not GateGuard's)

### "Your GateGuard" Subscription Management (dealer-facing)
Dealers need to manage the GateGuard platform subscription they pay to us:
- View their own GateGuard OS subscription tier and what's included
- See their monthly platform fee (based on # of active customers/properties)
- Upgrade/downgrade plan
- Billing history for what they pay GateGuard

### Holy Grail — What's Missing for Dealers (Full Gap List)
Things a dealer needs that are currently fragmented across multiple tools:
1. **Dispatcher board** — real-time map/board of techs + jobs in flight (replaces phone calls)
2. **Tech mobile app** — native-feeling WO experience in the field (replaces paper/texts)
3. **Install checklists** — standardized procedure per job type (replaces tribal knowledge)
4. **Parts inventory** — van stock + warehouse (replaces spreadsheets)
5. **Contract e-sign** — generate service agreement on deal close, send for signature (replaces DocuSign separate tool)
6. **Customer onboarding checklist** — "Contract signed → Equipment ordered → Install scheduled → EagleEye provisioned → Brivo provisioned → Customer portal live → Welcome email sent" (replaces manual tracking)
7. **Customer billing portal** — end customer self-serve (replaces emailed PDFs)
8. **Renewal tracking** — which customers renew when; auto-alert 60/30/14 days out (replaces spreadsheet)
9. **Property health score** — cameras online %, WO backlog, days since PM, access events — single number per property
10. **Revenue dashboard** — MRR trend, new ARR, churn, projected vs actual for the dealer's book
11. **Commission tracking** — rep and channel partner commissions calculated automatically on close
12. **SLA tracker** — response time and resolution time per customer vs their contracted SLA
13. **Two-way SMS/email** — inbound customer message → auto-creates work order or CRM activity
14. **Equipment procurement** — quote accepted → auto-generate equipment list → one-click PO to distributor
15. **Knowledge base** — install manuals, troubleshooting guides, accessible in field on mobile

### Equipment Procurement + Fulfillment Loop (DESIGN READY — not yet built)
When a dealer wins a deal, the quote already contains a structured BOM (bill of materials). The flow:
1. **Dealer** — "Order Equipment" button on won opportunity → auto-generates PO from quote line items → submitted to GateGuard
2. **GateGuard fulfillment** — internal order queue shows incoming POs; staff marks each unit as:
   - Programmed (serial numbers logged, device config applied — seeds the asset register for that property)
   - Tested (QA checklist signed off)
   - Shipped (tracking number pushed back to dealer portal)
3. **Dealer** sees live order status (Received → Programming → QA → Shipped → Delivered)
4. **Asset register** auto-populated from serial numbers logged at programming — no re-entry on install
- Key insight: BOM is already structured data from the quote; serial numbers at programming time = automatic asset seeding
- Future: One-click PO to distributor (equipment procurement from GG to supplier)

### Field Tech Knowledge Base + Guided Troubleshooting (DESIGN READY — not yet built)
A symptom-driven, AI-assisted troubleshooting assistant for field technicians. Goal: replace tribal knowledge and phone calls back to the office.
**Architecture:**
- **Vector repository** — all product manuals, install guides, wiring diagrams, config docs ingested as embeddings (Supabase pgvector or Pinecone)
- **Guided Q&A flow** (mobile-optimized):
  1. "What's the symptom?" — free text + common symptom quick-picks
  2. "What's the model/product?" — dropdown seeded from the property's asset register
  3. Guided yes/no questions (power present? error code showing? last known good state?)
  4. Returns: ranked likely causes + exact step-by-step resolution with test points (expected voltage/resistance readings), photos, and wiring diagrams pulled from the manual
- **Resolution feedback loop** — tech marks resolution as solved/unsolved; novel solutions can be flagged and added to the KB
- **Over time**: self-improving from real field resolution data
- **Pages needed**: `/kb` (search + symptom entry), `/kb/[article]` (step-by-step guide with visuals), `/kb/admin` (document ingestion + management)
- **Tech stack**: Supabase pgvector for embeddings, GPT-4o or Claude for Q&A reasoning, PDF-to-chunk pipeline for ingesting manuals

### Native Site Survey + System Design Tool (replaces System Surveyor)
System Surveyor is the current standard — dealers take an aerial/floor plan view and mark camera placements, door positions, gate locations, panel locations, and cable runs. The goal is a native version that is tightly integrated with the rest of the platform.
**Why native beats System Surveyor:**
- Site survey drawing is directly tied to the work order (tech opens drawing from WO, not a separate app)
- Marked devices auto-populate the BOM on the quote — select "4MP Dome Camera" on the drawing, it appears as a line item
- Completed drawing becomes an attachment on the proposal (customer sees a professional site plan)
- Installed devices on the drawing seed the asset register at that property (camera placed at "NW corner" = asset created with location tag)
- Future: AI suggests camera placement based on property type + square footage
**Tech approach:** Canvas-based drawing tool (Konva.js or Fabric.js), aerial tiles via Google Maps API or Mapbox, device library with drag-and-drop icons per product category
**Pages needed:** `/survey` (new survey from work order), `/survey/[id]` (drawing canvas), device library, proposal export with embedded plan

### Marketing & Lead Generation Platform (DESIGN READY — not yet built)
A full in-platform marketing arm. Three distinct capabilities:

**1. GateGuard Social Scheduler (HootSuite-style)**
- Schedule and publish posts across GateGuard's own social channels (Facebook, Instagram, LinkedIn, X/Twitter)
- Content calendar view, post composer with image/video upload, AI-generated caption suggestions
- Analytics: reach, engagement, follower growth per channel
- Route: `/marketing/social`

**2. Dealer Social Media Management**
- GateGuard creates branded content (posts, graphics, videos) and pushes it to connected dealer social accounts
- Dealers authorize GateGuard to post on their behalf (OAuth to their FB/IG/LinkedIn)
- Dealers can approve/reject or auto-approve scheduled posts from GateGuard
- Each piece of content is customized with the dealer's logo/name/phone before publishing
- Creates consistent brand presence across the entire dealer network automatically
- Route: `/marketing/dealer-social`

**3. Co-Op Marketing Pool + Lead Generation (ORIGINAL — no competitor has this)**
This is the flagship differentiator. How it works:
- Each dealer opts in and contributes a monthly amount to the co-op fund (e.g., $200–$2,000/mo based on territory size)
- GateGuard runs centralized Google Ads, Meta Ads, and SEO campaigns targeting property managers, HOA boards, and commercial property owners
- Leads come in through GateGuard-owned landing pages (geo-targeted, property-type-targeted)
- Leads are routed to the nearest/best-fit dealer automatically based on: geography, dealer tier, co-op contribution level, capacity
- Dealer receives the lead in their GateGuard CRM instantly — no manual hand-off
- Dashboard shows: co-op balance, leads received, cost-per-lead, conversion rate, ROI
- GateGuard takes a platform management fee (10–15%) off the top; the rest goes directly to campaigns
- Dealers who contribute more get territory exclusivity and priority routing
- Route: `/marketing/coop`
**Why this wins:** This is the franchise co-op advertising model (like how McDonald's pools ad spend) applied to the security dealer channel. No competitor offers this. It makes GateGuard OS a revenue driver for dealers, not just a cost center. A dealer who gets 3 qualified leads/month from the pool and converts 1 at $50K easily justifies $500/mo contribution.

### Dealer Website Hosting (included in platform)
Dealers currently pay separately for website hosting. GateGuard OS should include:
- Hosted dealer landing page / microsite at `[dealer-slug].gateguard.co` or custom domain
- Template-based builder: hero, services, testimonials, contact form, "Get a Free Quote" CTA
- Quote requests from the dealer website feed directly into the GateGuard CRM as leads
- White-labeled — dealer's branding, not GateGuard's (unless dealer opts for "Powered by GateGuard" badge)
- Route: `/marketing/website`

### HouseCall Pro Feature Gaps to Absorb
Previously used HouseCall Pro modules that need native equivalents in GateGuard OS:
- **Online booking** — customers/property managers can book a site survey or service call from the dealer website, slots pulled from dispatch availability
- **Customer notifications** — automated job status texts ("tech is on the way", "job complete", "invoice ready")
- **Instant invoicing** — tech completes job → invoice generated on mobile → customer pays on the spot via card reader or payment link
- **Review requests** — auto-send Google Review / Yelp request after job completion
- **Recurring service agreements** — schedule recurring PM visits, auto-invoice monthly

### Future
- **EagleEye live API** — replace mock camera data
- **Brivo live API** — replace mock access control data
- **SOC page** — full GGSOC.com integration (currently opens ggsoc.com in new tab)
- **White-label portals** — per-dealer branding, subdomain routing (dealers.gateguard.co/[slug])
- **AI features** — video search, proposal generator from property type, anomaly detection, churn prediction
- **Resident mobile app** — gate entry, guest passes, visitor log, intercom-to-phone
- **Central station integration** — place systems on/off test, create CS accounts (like FieldHub/WorkHorse)
- **Property health score** — cameras online %, open WOs, days since PM, contract status = one number per property

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
