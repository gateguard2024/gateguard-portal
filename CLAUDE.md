# GateGuard Portal — Agent Context

## APPLICATION LANDSCAPE (read this first — get it right every time)

GateGuard runs four distinct applications. Never confuse them.

| App | URL | Repo | Purpose |
|-----|-----|------|---------|
| SOC Operations | ggsoc.com | gateguard-dispatch-ui | Call center interface for SOC staff. Live production. Twilio, Brivo, Eagle Eye, Supabase. DO NOT BREAK. |
| Visitor Kiosk (legacy) | stonegate-visitor.vercel.app | (separate) | Single-property Brivo+Twilio kiosk. Being replaced by gatecard.co. Do not build new features here. |
| GateCard | gatecard.co | gatecard.co | Multi-tenant visitor/resident kiosk. Replaces stonegate. One deployment, N properties. |
| Dealer Portal | portal.gateguard.co | gateguard-portal (THIS REPO) | Dealer-facing ops + field tech tool. Equipment library, KB, AI diagnostic. |

---

## THIS REPO — portal.gateguard.co

**Who uses it:** GateGuard dealers and field technicians. NOT residents. NOT visitors. NOT SOC agents.

**What it does:**
- Equipment library with PDF manual upload and vector search
- AI-powered troubleshooting wizard (KB) using pgvector + Claude
- Field tech tool at `/tech` — mobile-first diagnostic instrument for on-site techs
- CRM: leads, quotes, work orders, customers
- (Future) Door trigger, camera view, callbox service during dealer site visits

**The `/tech` route:**
- Lives at `portal.gateguard.co/tech` — NOT a separate domain
- Same codebase, same auth, mobile-optimized route
- Dealers print QR codes linking techs to `/tech?product_id=<sku>`
- If it ever needs its own brand, it takes a DNS alias — not a rebuild

**Brivo and UniFi in this repo:**
- `lib/brivo.ts` — Brivo API client. Currently used for resident sync visibility; will power door triggering and callbox service during dealer visits
- `lib/unifi.ts` — UniFi Network API client. Currently used for resident network group sync; will power device inspection and network service during tech visits
- `lib/resident-sync.ts` — Syncs Brivo users → `residents` table → UniFi client groups. Runs hourly via cron.
- Resident data lives HERE because dealers need to know who is credentialed at a property they service

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
- Anthropic Claude Haiku for AI diagnostic step generation
- Brivo API (access control)
- UniFi Network API (network/VLAN management)

## Key API Routes
- `POST /api/kb/process` — upload PDF manual, chunk + embed, store in Supabase Storage
- `POST /api/kb/ask` — AI diagnostic engine (vector search + Claude step generator)
- `GET  /api/sync/residents` — Brivo → DB → UniFi resident reconciliation (cron + manual)

## Database
- `organizations` — 5-tier hierarchy (corporate → MSO → dealer → partner → client)
- `products` — equipment library (SKU, specs, manual_url, tags)
- `manual_chunks` — PDF chunks with 1536-dim embeddings
- `kb_articles` — authored troubleshoot articles with embeddings
- `troubleshoot_sessions` — diagnostic session logs
- `residents` — Brivo-sourced resident roster per org (mac_address for UniFi sync)
- `sync_log` — immutable log of every Brivo/UniFi sync run

## Cron Jobs (vercel.json)
- `GET /api/sync/residents` — every hour (Brivo → DB → UniFi reconciliation)

## Env Vars Required
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` — for PDF embedding
- `ANTHROPIC_API_KEY` — for KB diagnostic Claude calls
- `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/`
- `BRIVO_API_KEY`, `BRIVO_CLIENT_ID`, `BRIVO_CLIENT_SECRET`
- `CRON_SECRET` — shared secret Vercel injects into cron requests
- `TECH_ACCESS_CODE` — PIN code field techs use to access /tech without Clerk

## Master Asset Library (Google Drive)
All GateGuard brand assets, product photos, manuals, contracts, and company documents live at:
https://drive.google.com/drive/folders/0AMsXu78d6wafUk9PVA

This is the canonical source for:
- Product PDF manuals to upload into the KB vector pipeline
- Brand logos, photos, marketing collateral
- Legal documents (NDAs, service agreements, distributor agreements)
- Historical project files

## Manual Upload Pipeline — LIVE ✅
PDF manuals → KB vector search flow (fully working as of May 2026):
1. Products stored in Supabase `products` table with `field_service=true` for tech tool
2. Supabase Storage bucket `manuals` must exist (public) — created May 2026
3. Upload via Products page (`/products`) → Edit product → Upload PDF button
4. OR bulk upload via `scripts/bulk-upload-manuals.mjs` (see scripts/ dir)
5. Pipeline: pdf-parse → chunkText() → embedBatch() (OpenAI text-embedding-3-small) → upsert `manual_chunks`
6. After upload, manuals are searchable via `match_knowledge()` RPC in KB diagnostic engine
7. Tech tool `/tech` shows 📄 p.XX manual reference on AI step cards when a chunk is matched
8. OpenAI billing required — add credits at platform.openai.com/settings/billing

## UI Design System
- Portal: light theme, white cards, `#F8FAFC` bg, `#6B7EFF` brand blue, dark sidebar
- Tech tool `/tech`: matches portal light theme (updated May 2026) — same `#F1F5F9` bg, white cards
- Both use IBM Plex Sans + IBM Plex Mono
- Step type color semantics: blue=VERIFY, amber=ACTION, green=RESOLVED, red=ESCALATE, purple=MEASURE
