# GateGuard — System & Repo Map

_Generated June 23, 2026. Purpose: one clear picture of which repo owns what, so consolidation work succeeds._

---

## The three codebases

| | Repo | Deploys to | What it is | Auth | Data |
|---|---|---|---|---|---|
| **Main website** | `gateguard2024/gateguard-web` | **gateguard.co** | Marketing site + sales/investor tools + a client portal | Clerk | Supabase (`properties`, `receivables`, `ledgers`, `core_metrics`) **+ MaintainX** |
| **Nexus (the portal)** | `gateguard2024/gateguard-portal` | **portal.gateguard.co** | "GateGuard OS — Dealer Portal." Everything operational. | Clerk | Supabase (`organizations`, `sites`, `work_orders`, `quotes`, …) |
| **GateCard** | _separate repo (not connected here)_ | **gatecard.co** | Resident/visitor app, kiosk, Brivo↔UniFi middleware | — | own |

---

## 1. Where the MAIN webpage is managed

**`gateguard-web` → gateguard.co.** This is the "Unknown" from your list. It contains:

- `/` — marketing landing page (ROI calculator)
- `/pricing/ColumbiaRes`, `/pricing/radco`, `/pricing/station` — bespoke prospect pricing pages
- `/investor` — investor pulse dashboard (Clerk-protected)
- `/sales-portal` — internal sales
- `/crespresentation` — CRE pitch deck
- `/login`, `/schedule`, `/admin`
- **`/portal`** — the **client / property-manager portal** (see overlap note below)
- `/api/maintainx`, `/api/maintainx/workorders`, `/api/book`, `/api/calendar`

## 2. Where the PORTAL in total is located

**`gateguard-portal` → portal.gateguard.co.** This is **Nexus**: ~60 sections, 305 API routes. It covers everything on your Nexus list:

- **Total dealer experience** — `crm`, `quotes`, `dispatch`, `maintenance`, `cmms`, `projects`, `survey`, `billing`, `inventory`, `playbooks`, `training`, `onboarding`, `reps`…
- **Total corporate management** — `admin`, `settings`, `analytics`, `reports`, `revenue`, `eos`, `scorecard`, `compliance`, feature-flags, org hierarchy
- **Where we build dealer sites** — dealer onboarding wizard + org tree (`admin/dealers`)
- **Where we build End-User portals** — `/portal`, `/customers/[id]`, `/sites/[id]`, `/document/[slug]` _(partially built — see overlap)_
- **Where the tech tool lives** — **`/tech`** (the field app: WHO ARE YOU picker + My Jobs) ✅ confirmed only here

## 3. GateCard

Separate repo / `gatecard.co` (not connected to this session). It's the **customer-facing layer**: resident GateCard app, visitor management, kiosk, Brivo↔UniFi middleware. In Nexus the install process references it as a step ("Activate GateCard").

---

## ⚠️ Overlaps & conflicts to resolve (these are why things feel disconnected)

### A. The End-User / client portal exists in BOTH places
- **Real one:** `gateguard-web/portal` — live, backed by MaintainX + Brivo/Eagle Eye links + the `properties` table.
- **Nexus one:** `gateguard-portal/portal` — exists but is largely demo/static data.
- Your intended architecture says **Nexus builds End-User portals**, so the real client portal should move into Nexus — but today it lives in `gateguard-web`.

### B. Two work-order systems that don't talk → this is the `/tech` problem
- **gateguard-web** "Request Service" → **MaintainX** (`api.getmaintainx.com`).
- **Nexus** Operations Hub + `/tech` → Supabase **`work_orders`**.
- No bridge. A job created in MaintainX never reaches `/tech`. Only Nexus-created jobs reach `/tech`.

### C. Two data models (possibly two Supabase projects)
- gateguard-web uses `properties`, `receivables`, `ledgers`, `core_metrics`.
- Nexus uses `sites`, `work_orders`, `organizations`, etc. (`properties` was already flagged for removal in the Nexus consolidation).
- **OPEN QUESTION (must confirm):** do both apps point at the **same** Supabase project, or two? This single fact decides whether consolidation is a code repoint or a data migration.

---

## Target state (your call: "one Supabase database as the master record")

1. **One Supabase project** is the master for everyone.
2. **gateguard-web** reads/writes the **canonical** tables (`sites`, `work_orders`, `organizations`) — not `properties` / MaintainX.
3. **MaintainX retired** from the work-order path; client "Request Service" writes a real `work_orders` row.
4. **End-User portal consolidated** into Nexus (or gateguard-web reads Nexus data) so there's one client portal.
5. `/tech` (already on `work_orders`) then shows **every** job — client-submitted or dealer-dispatched — in one place.

**Next blocking fact needed:** same Supabase project or two? (Check each app's `NEXT_PUBLIC_SUPABASE_URL` in its Vercel project.)
