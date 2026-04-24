# GateGuard Security Ecosystem — Platform Context

## Vision
**GateGuard OS** — the all-in-one security operations platform for multifamily, HOA, and commercial properties. A fully white-labelable, channel-partner-ready SaaS that unifies cameras, access control, billing, quoting, CRM, and maintenance into a single scalable ecosystem.

Built for dealers. Sold to properties. Designed to replace every fragmented tool in the security stack.

---

## Brand
- **Company:** GateGuard, LLC
- **Site:** gateguard.co | ggsoc (Security Operations Center)
- **Email:** rfeldman@gateguard.co
- **Tagline:** Unrivaled Security. Proactive Multi-Family Security.
- **Markets:** Multi-Family Apartments, HOA Communities, Commercial Estates

---

## Brand Colors (from gateguard.co)
| Token | Hex | Usage |
|-------|-----|-------|
| `brand-primary` | `#22d3ee` (cyan-400) | CTAs, active states, links |
| `brand-dark` | `#0A192F` | Page background (dark mode) |
| `brand-darker` | `#050505` | Deepest backgrounds |
| `brand-navy` | `#0a0f1a` | Sidebar, cards |
| `zinc-300/400/500` | — | Body text, muted text |
| `red-400/500` | — | Alerts, offline, errors |
| `blue-500/600` | — | Secondary accent |

---

## Tech Stack
| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Hosting | Vercel |
| Database | Supabase (PostgreSQL + Realtime + RLS) |
| Auth | Clerk (multi-tenant, orgs) |
| SMS/Comms | Twilio |
| Styling | Tailwind CSS + shadcn/ui |
| Language | TypeScript |
| Repo | GitHub |
| Theme | Dark (default) + Light mode (next-themes) |

---

## Customer Hierarchy (5 Tiers)

```
GateGuard Corporate (Tier 0)
│
├── Master System Operator — MSO (Tier 1)
│   Large dealer groups / regional operators
│   e.g., "Southeast Security Group"
│
├── System Operator / Dealer — SO (Tier 2)
│   Individual dealers, installers
│   e.g., "Gate Guard, LLC"
│
├── Sales Channel Partner (Tier 3)
│   Resellers, agents, property management co's
│   e.g., "Columbia Residential", "Elevate Living"
│
├── Client (Tier 4)
│   Individual properties: apartment complexes, HOAs, commercial
│   e.g., "Angel Oak Properties", "Stonegate Townhomes"
│
└── Client Employees / Residents (Tier 5)
    Property managers, security staff, residents with app access
```

### What Each Tier Sees
| Tier | Portal View |
|------|-------------|
| Corporate | All MSOs, all accounts, full analytics, system config |
| MSO | Their SO network, aggregated metrics, revenue |
| SO/Dealer | Their clients, cameras, access events, quotes, billing |
| Channel Partner | Referred clients, commission tracking, co-branded portal |
| Client | Own cameras, doors, users, maintenance requests |
| Employee/Resident | Mobile app — entry, guest passes, visitor log |

---

## Platform Modules

### 1. Cameras
- **Now:** EagleEye Networks API (live feeds, video search, events, archive)
- **Roadmap:** GateGuard proprietary ONVIF-compatible bridge appliance
- **Features:** Live grid, video search (AI), motion events, forced entry clips, archive, downloads, multi-property layouts

### 2. Access Control
- **Now:** Brivo (cloud access, door management, user cards/fobs, event tracker)
- **Now:** Callbox by Ubiquiti (video intercom, remote open, visitor management)
- **Roadmap:** GateGuard proprietary access panel + GateGuard Callbox
- **Features:** Door control, user management, visitor logs, event tracker, mobile credentials

### 3. Customer Management (CRM)
- **Hierarchy management** — create/manage MSOs, SOs, Channel Partners, Clients
- **Account health** — camera online %, door status, last activity
- **Contact book** — property managers, owners, maintenance contacts
- **Activity log** — every interaction, note, call, site visit
- **Onboarding workflow** — guided setup for new clients (EagleEye + Brivo provisioning)

### 4. Quoting
- **Templates** — standard packages (Starter, Professional, Enterprise) by unit count
- **Proposals** — branded PDF + shareable link (Qwilr-style)
- **Line items** — hardware (cameras, panels, callbox), install labor, monthly SaaS
- **Digital acceptance** — e-sign, status auto-updates
- **AI assist** — generate proposals from property type + unit count

### 5. CRM (Sales & Service)
- **Lead pipeline** — Prospect → Qualified → Proposal Sent → Won/Lost
- **Service tickets** — reactive maintenance, trouble calls
- **RMAs** — equipment return/replacement tracking
- **Communication log** — emails, calls, SMS (Twilio), site visits
- **Channel partner attribution** — track referrals, commissions

### 6. Maintenance
- **Work orders** — create, assign to tech, track to close (MaintainX-style)
- **Preventive maintenance** — scheduled tasks per property/device
- **Asset registry** — serial numbers, install dates, warranties, firmware
- **Technician dispatch** — mobile SMS updates via Twilio
- **SLA tracking** — response time, resolution time

### 7. Billing
- **Recurring MRR** — monthly per-camera and per-door SaaS fees
- **One-time invoices** — hardware, install, service calls
- **QuickBooks sync** — automatic invoice/payment sync
- **Payment portal** — ACH, card (via QuickBooks Payments or Stripe)
- **Revenue breakdown** — MRR by MSO, SO, property tier

### 8. SOC / Monitoring (ggsoc)
- **Security Operations Center view** — multi-account camera grid
- **Live alerts** — forced entry, motion at restricted zones, offline devices
- **Incident management** — log events, attach video, escalate
- **AI monitoring** — anomaly detection (Phase 4)

### 9. Resident / Client App (Phase 5)
- Mobile: entry via QR/BT, guest pass generation, visitor log, package notifications
- Web portal: property-specific dashboard, maintenance requests

---

## Integrations Roadmap
| Integration | Purpose | Phase |
|-------------|---------|-------|
| EagleEye Networks | Cameras, live video, video search | 1 → 2 |
| Brivo | Access control, events, users | 1 → 2 |
| Ubiquiti Callbox | Video intercom, visitor management | 2 |
| QuickBooks | Billing, invoicing, payments | 3 |
| Twilio | SMS alerts, 2FA, dispatch notifications | 2 |
| Clerk | Multi-tenant auth, org hierarchy | 1 → 2 |
| Supabase | All data + realtime events | 1 → 2 |
| Stripe | Alternative payment processing | 3 |
| Salesforce | Enterprise CRM sync (MSO-tier) | 4 |

---

## Hardware Roadmap
| Product | Status | Replaces |
|---------|--------|---------|
| GateGuard Camera Bridge | In development | EagleEye bridge/CMVR |
| GateGuard Access Panel | Planned | Brivo panel |
| GateGuard Callbox | Planned | Ubiquiti Callbox |
| GateGuard ONVIF NVR | Planned | Third-party NVRs |

---

## Phase Plan
| Phase | Scope |
|-------|-------|
| **1 (Done)** | UI shell — all pages, dark mode, layout, mock data |
| **2 (Next)** | Auth (Clerk orgs), Supabase schema + RLS, EagleEye + Brivo live APIs |
| **3** | QuickBooks billing, Twilio SMS, Ubiquiti Callbox, quote builder |
| **4** | AI features (video search, event search, proposal gen), SOC view |
| **5** | Resident/client mobile app, white-label dealer portals, GateGuard hardware |
| **∞** | Own appliances replace third-party integrations |

---

## Key Files
```
gateguard-portal/
├── CONTEXT.md              ← This file (update after every phase)
├── USER_GUIDE.md           ← Setup + deployment guide
├── app/
│   ├── layout.tsx          ← Root layout, Clerk + theme providers
│   ├── page.tsx            ← Dashboard
│   ├── globals.css         ← Design tokens, CSS variables
│   ├── customers/          ← CRM + hierarchy management
│   ├── cameras/            ← EagleEye → GG Bridge
│   ├── access/             ← Brivo + Callbox → GG Panel
│   ├── quotes/             ← Quote builder + proposals
│   ├── maintenance/        ← Work orders + assets
│   ├── billing/            ← QuickBooks integration
│   ├── crm/                ← Leads + service + RMAs (Phase 2)
│   └── soc/                ← Security Ops Center (Phase 4)
├── components/
│   ├── layout/             ← Sidebar, TopBar, ThemeToggle
│   ├── ai/                 ← AISearch component
│   ├── hierarchy/          ← Org tree, role switcher (Phase 2)
│   └── ui/                 ← shadcn/ui components
└── lib/
    ├── supabase.ts
    ├── eagleeye.ts         ← EagleEye API client (Phase 2)
    ├── brivo.ts            ← Brivo API client (Phase 2)
    └── utils.ts
```

---

## Last Updated
2026-04-24 — Full platform vision confirmed. Brand colors synced from gateguard.co.
Phase 1 UI complete. Phase 2 planning in progress.
