# GateGuard Portal — Supabase Architecture Reference

> **Purpose:** Complete reference for the GateGuard Portal Supabase setup. Share this with new developers, contractors, or Supabase support. Last updated: May 2026.

---

## Two Environments

| Environment | Dashboard URL | Used For |
|---|---|---|
| **Beta** | supabase.com → your beta project | All new migrations run here first |
| **Production** | supabase.com → your prod project | Live at portal.gateguard.co — only after beta approval |

**Rule:** Always run migrations on Beta first, verify, then run on Prod.

---

## How the App Connects

There are two connection modes in `lib/supabase.ts`:

```typescript
// Client-side (anon key, subject to RLS)
import { supabase } from "@/lib/supabase";

// Server-side API routes (service role key, bypasses RLS)
import { createServiceClient } from "@/lib/supabase";
const supabase = createServiceClient();
```

### Required Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...         # server-only, never expose to client

# Auth (Clerk)
CLERK_SECRET_KEY=sk_...

# Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@gateguard.co
RESEND_WEBHOOK_SECRET=...

# Stripe
STRIPE_SECRET_KEY=sk_live_...

# Google OAuth (Gmail + CalDAV)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...         # exposed to browser for OAuth initiation
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
GOOGLE_CALENDAR_REDIRECT_URI=...

# Twilio (SMS)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
TWILIO_FROM_NUMBER=+1...
TWILIO_MESSAGING_SID=MG...

# Other integrations
ANTHROPIC_API_KEY=sk-ant-...
BRIVO_API_KEY=...
BRIVO_CLIENT_ID=...
BRIVO_CLIENT_SECRET=...
BRIVO_AUTH_BASIC=...
TAVILY_API_KEY=...                       # ARIA web search
TECH_ACCESS_CODE=...                     # /tech route header auth (no Clerk)
CRON_SECRET=...                          # cron endpoint protection
NEXT_PUBLIC_APP_URL=https://portal.gateguard.co
```

---

## Database Extensions

Enable these in Supabase Dashboard → Database → Extensions:

| Extension | Purpose |
|---|---|
| `uuid-ossp` | `uuid_generate_v4()` for primary keys |
| `pg_trgm` | Fast full-text / ILIKE search |
| `vector` | pgvector — 1536-dim OpenAI embeddings for KB search |

---

## Authentication Pattern

Auth uses **Clerk** (not Supabase Auth). The Clerk JWT is forwarded to Supabase. RLS policies read the user identity from the JWT:

```sql
-- Get current Clerk user ID (used in message_channels, message_threads, etc.)
auth.jwt() ->> 'sub'

-- Get the user's org (used in most business tables)
auth_org_id()   -- looks up profiles.org_id where clerk_user_id = jwt sub

-- Get the user's role
auth_role()     -- looks up profiles.role where clerk_user_id = jwt sub
```

Two helper functions are defined in migrations:

```sql
create or replace function auth_org_id() returns uuid as $$
  select org_id from profiles where clerk_user_id = auth.jwt() ->> 'sub'
$$ language sql security definer;

create or replace function auth_role() returns user_role as $$
  select role from profiles where clerk_user_id = auth.jwt() ->> 'sub'
$$ language sql security definer;
```

### RLS Patterns by Table Group

| Table Group | RLS Pattern |
|---|---|
| `quotes`, `work_orders`, `invoices`, `leads`, `contacts` | `org_id = auth_org_id()` |
| `message_channels`, `message_threads` | `user_id = (auth.jwt() ->> 'sub')` |
| `messages` | Subquery: `thread_id in (select id from message_threads where user_id = ...)` |
| `eos_*` tables (Rocks, Scorecard, Issues, etc.) | `service_role` only (no user-level RLS) |
| `service_catalog` | Read-only to authenticated users |
| `organizations` | Org hierarchy traversal |

**Server-side API routes** use `createServiceClient()` (service role key) and enforce ownership manually via `.eq("user_id", userId)` or `.eq("org_id", orgId)` — RLS is bypassed.

---

## Database Schema — 59 Tables

### Core Org & Auth

| Table | Purpose |
|---|---|
| `organizations` | 6-tier hierarchy: corporate → mso → dealer → partner → client. Has parent_id for tree. |
| `profiles` | One per Clerk user. Stores `clerk_user_id`, `org_id`, `role`. Bridge between Clerk and Supabase. |
| `user_permissions` | Granular permission overrides per user |
| `sensitive_fields` | Field-level sensitivity config |
| `sensitive_field_access_log` | Audit log for sensitive field reads |

### CRM

| Table | Purpose |
|---|---|
| `companies` | CRM companies (client, vendor, prospect, partner) |
| `contacts` | CRM contacts linked to companies and orgs |
| `contact_properties` / `company_properties` | Custom property key-value pairs |
| `leads` | Sales leads with stage tracking |
| `opportunities` | Sales opportunities with stage history |
| `opportunity_contacts` | Many-to-many: opportunities ↔ contacts |
| `opportunity_stage_history` | Audit log of stage changes |
| `activities` | Universal activity log (calls, emails, meetings, notes) |
| `activity_log` | System-level activity stream |
| `show_lead_assignments` | Lead assignments to reps/shows |

### Quoting & Sales

| Table | Purpose |
|---|---|
| `quotes` | Quote header — status, pricing, proposal v2 fields (migration 091) |
| `quote_line_items` | Line items with product ref, qty, unit price, optional flag |
| `attachments` | File attachments linked to quotes, WOs, contacts |

### Field Service

| Table | Purpose |
|---|---|
| `work_orders` | WO header — status, priority, linked site, linked quote |
| `sites` | Installed properties with three dealer FKs (master, install, service) |
| `site_assets` | Equipment/devices at each site |
| `site_asset_terminals` | Terminal/port-level wiring data |
| `site_events` | Events log per site |
| `pm_schedules` | Preventive maintenance schedules |
| `technicians` | Tech profiles linked to users |
| `work_order_subcontractors` | Subcontractors assigned to WOs |
| `subcontractors` | Subcontractor company records |

### Billing & Finance

| Table | Purpose |
|---|---|
| `invoices` | Invoice header |
| `invoice_line_items` | Line items (migrated from separate table) |
| `commission_config` | Commission rate config per org tier |
| `rep_commissions` | Commission payout records |
| `commission_payouts` | Aggregate payout tracking |
| `sales_reps` | Rep profiles |
| `permits` | Permit compliance tracking per site |

### Knowledge Base & AI

| Table | Purpose |
|---|---|
| `products` | Equipment library with specs |
| `manual_chunks` | PDF manual chunks with `embedding vector(1536)` for pgvector search |
| `kb_articles` | KB articles |
| `troubleshoot_sessions` | NEXUS diagnostic sessions |
| `device_suggestions` | AI-generated device wiring suggestions |

### Surveys & Design

| Table | Purpose |
|---|---|
| `surveys` | Site survey records with AI-generated SOW/BOM |
| `floor_plans` | Uploaded floor plan images |
| `floor_plan_devices` | Device pins placed on floor plans |
| `floor_plan_annotations` | Text/shape annotations |
| `floor_plan_connections` | Device-to-device cable connections |
| `esign_documents` | E-signature documents linked to quotes |

### Training & EOS

| Table | Purpose |
|---|---|
| `training_progress` | Per-user training module completion |
| `dealer_scorecards` | Weekly dealer performance scorecards |
| `eos_rocks` | EOS Rocks (quarterly goals) |
| `eos_scorecard` / `eos_scorecard_entries` | EOS Scorecard metrics |
| `eos_issues` | EOS Issues (IDS) |
| `eos_todos` | EOS To-Dos |
| `eos_vto` | Vision/Traction Organizer |
| `todos` | General to-do items linked to users/orgs |

### Messaging & Calendar

| Table | Purpose |
|---|---|
| `message_channels` | Connected channels (Gmail, SMTP, CalDAV, Twilio, phone) with OAuth tokens |
| `message_threads` | Conversation threads per channel, with WO/quote/site links |
| `messages` | Individual messages with direction, body, status |

### Other

| Table | Purpose |
|---|---|
| `customers` | QuickBooks-imported customer records |
| `properties` | Property records (legacy, predates `sites`) |
| `devices` | Network/access control devices |
| `campaign_sends` | Marketing campaign send log |
| `trinity_calls` | TRINITY voice AI call records |
| `aria_searches` | ARIA intel search log |
| `scout_campaigns` | SCOUT market campaigns |
| `service_catalog` | Service Marketplace offerings |
| `dealer_service_enrollments` | Dealer enrollments in service catalog |
| `dealer_add_ons` | Add-on product/service config per dealer |
| `gamification` (via 078) | Dealer gamification points/badges |
| `job_costing` (via 075) | Per-WO cost tracking |
| `fleet_reviews` (via 076) | Fleet/vehicle review records |

---

## Enums

```sql
org_tier:          corporate, mso, dealer, partner, client
user_role:         corporate_admin, mso_admin, dealer_admin, dealer_staff,
                   partner_admin, client_admin, client_viewer
account_status:    active, inactive, suspended, onboarding
device_status:     online, offline, warning, unknown
quote_status:      draft, sent, viewed, accepted, declined, expired
wo_status:         open, in_progress, scheduled, completed, cancelled
wo_priority:       low, medium, high, critical
invoice_status:    draft, sent, paid, overdue, void
lead_stage:        prospect, qualified, proposal, negotiation, won, lost
opp_stage:         inquiry, site_walk, proposal, negotiation, won, lost
channel_type:      gmail, smtp, caldav, phone, twilio, internal
message_direction: inbound, outbound
message_status:    pending, sent, delivered, failed, read
message_source:    gmail, smtp, caldav, sms, twilio, internal
activity_type:     call, email, meeting, note, task, sms
contact_type:      client, vendor, employee, rep, other
contact_role:      owner, manager, regional_mgr, emergency, billing, other
company_type:      client, vendor, prospect, partner
attachment_type:   proposal, contract, photo, document, other
customer_status:   active, paused, cancelled, churned
```

---

## Triggers

All tables have an `updated_at` trigger via `update_updated_at()`. Additional business-logic triggers:

| Trigger | Table | What It Does |
|---|---|---|
| `trg_lead_converted` | `leads` | Fires on lead → won conversion |
| `trg_log_stage` | `opportunities` | Writes to `opportunity_stage_history` on stage change |
| `trg_opp_won` | `opportunities` | Fires on opportunity → won |
| `trg_messages_sync_thread` | `messages` | Updates `message_threads.last_message_at` and `unread_count` on new inbound message |

---

## Migration History (79 files)

Migrations are in `supabase/migrations/` and must be run in numeric order.

| Range | Topic |
|---|---|
| 001–009 | Initial schema, CRM phase 1, products, KB vectors, seeds |
| 010–019 | EOS tables, work orders, sites, org isolation, dealer network, permits |
| 020–029 | Email tracking, training, scorecards, todos, e-sign, document templates |
| 030–039 | CRM enhancements, opportunities, field tickets, inventory, activities |
| 040–049 | Surveys, quotes enrichment, work order crews, call logs |
| 050–059 | Billing, site billing columns, permits, Google Calendar OAuth columns |
| 060–069 | Partner docs, TRINITY calls, opportunity RLS fixes, ARIA search log |
| 070–079 | Service catalog, floor plans, org seeds, job costing, gamification, photos |
| 080–091 | Subcontractors, hardware catalog seed, Quote v2 (proposal columns) |
| 095 | Message Center (channels, threads, messages) |

### Migration Status as of May 2026

| Migration | Status | Notes |
|---|---|---|
| 001–042 | ✅ Beta + Prod | Core schema |
| 050–052 | Run before /billing goes live | Billing, site billing, permit docs |
| 053 | Run before Google Calendar OAuth | gcal columns on user_settings |
| 062 | Run before /trinity | trinity_calls table |
| 070–071 | Run before /services + /design | Service catalog, floor plans |
| 078 | Run before gamification | Dealer gamification |
| 091 | ✅ Beta + Prod | Quote v2 (whats_included, agreement_html, signed_at, etc.) |
| 095 | ✅ Beta (run manually) | Message Center |

---

## Sharing This Setup

**With a new developer:** Share this file + the `supabase/migrations/` folder. They can replay all migrations against a fresh Supabase project to get a full local copy.

**With a contractor:** Share this file. Point them to `lib/supabase.ts` for the client setup and `001_initial_schema.sql` for the full base schema. Give them anon key + URL for the beta project only.

**With Supabase support:** Share this file + paste the relevant migration file(s). Reference the project IDs from your Supabase dashboard.

**Replay all migrations on a fresh project:**
```bash
# In Supabase SQL Editor, run each file in order:
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_crm_phase1.sql
# ... through 095_message_center.sql
```

Or use the Supabase CLI:
```bash
supabase db push --db-url "postgresql://postgres:[password]@[host]:5432/postgres"
```
