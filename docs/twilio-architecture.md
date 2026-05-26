# Twilio Architecture — GateGuard Portal
> Status: **Decision made, implementation pending** · Last updated: May 26, 2026

---

## Decision: Option C — Master/Sub-account Model

GateGuard holds one Twilio master account. Each dealer org gets a **Twilio sub-account** (billed to GateGuard master, dealer has their own number and identity). Messages sent by a dealer's users route through that dealer's sub-account — so the client always sees the dealer's number, not GateGuard's.

### Why not the alternatives
- **Option A (centralized)** — all clients would see GateGuard's number, dealers can't own the client relationship
- **Option B (dealer-owned Twilio)** — no oversight, dealers manage their own billing, GateGuard has zero visibility

---

## A2P 10DLC Registration — Required for All US SMS

Every business sending SMS in the US through a 10-digit number must register with The Campaign Registry (TCR). This applies to every dealer sub-account.

### Per-dealer registration flow
1. **Brand registration** — dealer's legal name, EIN, address, website → TCR via Twilio API
   - Approval: 1–5 business days
   - Cost: $4/month
   - Returns: Brand SID (`BN...`)
2. **Campaign registration** — use case type, sample messages, opt-in description
   - Must wait for brand approval first
   - Approval: 1–3 business days
   - Cost: ~$10/month (Standard use case)
   - Returns: Campaign SID
3. **Messaging Service** — create `MG...` service on sub-account, attach phone number, link to approved campaign
   - This is what the portal uses to send messages

### ISV Program (important — do this first)
Twilio has an ISV (Independent Software Vendor) program for platforms like GateGuard. Benefits:
- Register once as the ISV platform brand
- Dealers register under GateGuard's umbrella — less paperwork, faster approval
- Dramatically reduces per-dealer onboarding friction at scale

**Action required before first dealer provisioning:** Apply to Twilio's ISV program at twilio.com/en-us/trusted-activations/isv

---

## Database Schema — Migration 096

File to create: `supabase/migrations/096_twilio_subaccounts.sql`

```sql
create type twilio_provision_status as enum (
  'not_provisioned',
  'provisioning',
  'active',
  'suspended',
  'failed'
);

create type twilio_a2p_status as enum (
  'unregistered',
  'brand_pending',
  'brand_approved',
  'brand_failed',
  'campaign_pending',
  'registered',
  'campaign_failed'
);

alter table organizations
  -- Sub-account credentials
  add column if not exists twilio_subaccount_sid    text unique,
  add column if not exists twilio_subaccount_token  text,           -- treat as secret, never expose to client

  -- Provisioned phone number
  add column if not exists twilio_phone_number      text,           -- e.g. +14805550100
  add column if not exists twilio_phone_sid         text,           -- PN... SID in Twilio

  -- Messaging Service (what actually sends messages)
  add column if not exists twilio_messaging_sid     text,           -- MG... SID

  -- A2P 10DLC registration
  add column if not exists twilio_a2p_brand_sid     text,           -- BN... from TCR
  add column if not exists twilio_a2p_campaign_sid  text,
  add column if not exists twilio_a2p_brand_data    jsonb,          -- EIN, legal name, etc. collected from dealer

  -- Status tracking
  add column if not exists twilio_status            twilio_provision_status default 'not_provisioned',
  add column if not exists twilio_a2p_status        twilio_a2p_status default 'unregistered',
  add column if not exists twilio_provisioned_at    timestamptz,
  add column if not exists twilio_a2p_submitted_at  timestamptz,
  add column if not exists twilio_a2p_approved_at   timestamptz,
  add column if not exists twilio_a2p_failure_reason text;          -- TCR rejection message if failed
```

### Key column notes
- `twilio_subaccount_token` — sensitive, stored like OAuth tokens. Never return from client-facing APIs.
- `twilio_a2p_brand_data` — stores the full JSON payload collected during dealer onboarding (EIN, legal name, business type, website). Needed for TCR submissions and support tickets.
- `twilio_status` — tracks whether the sub-account and number are live
- `twilio_a2p_status` — tracks where each dealer is in the TCR registration pipeline

---

## Open Questions (must answer before building)

### 1. Who triggers provisioning?
- **Self-serve** — dealer fills out a form in their portal settings, clicks "Provision my number", API auto-creates sub-account + purchases number
- **Admin-triggered** — GateGuard corporate provisions dealers manually from an admin panel
- **Hybrid** — dealer fills out brand info form, GateGuard corporate reviews and approves before provisioning runs

Recommendation: Hybrid. Dealer submits EIN and legal info; corporate reviews (to avoid bad actors); then auto-provision runs.

### 2. Area code selection
- Let dealers pick their area code (Twilio search-before-buy flow)?
- Auto-assign based on dealer's address zip code?
- GateGuard assigns from a pool?

### 3. SMS use case scope
- **Transactional only** (work order updates, appointment reminders, site alerts) → one shared ISV campaign may cover all dealers
- **Marketing/outreach included** → each dealer needs their own campaign registration

Primary use case answer will determine whether we can use one ISV campaign umbrella or must register individually.

### 4. Dealer visibility
- Can dealers see all messages sent through their sub-account in the portal?
- Can GateGuard corporate see dealer message logs?
- Are there message logs exposed in the portal UI, or just send/receive?

---

## API Routes to Build (once questions answered)

| Route | Purpose |
|---|---|
| `POST /api/admin/twilio/provision` | Create sub-account + purchase number for an org |
| `POST /api/admin/twilio/register-a2p` | Submit brand + campaign to TCR |
| `GET /api/admin/twilio/status/[orgId]` | Check provisioning + A2P status |
| `PATCH /api/admin/twilio/suspend/[orgId]` | Suspend a dealer's sub-account |
| `POST /api/webhooks/twilio/a2p-status` | TCR webhook — updates `twilio_a2p_status` when brand/campaign approved or rejected |

---

## Cost Model Per Dealer (monthly)

| Item | Cost |
|---|---|
| Twilio phone number | ~$1.00/mo |
| A2P brand registration | $4.00/mo |
| A2P campaign (Standard) | $10.00/mo |
| SMS (outbound) | $0.0079/message |
| SMS (inbound) | $0.0075/message |
| **Base per dealer** | **~$15/mo before message volume** |

This should be factored into dealer pricing / service catalog tiers.

---

## Env Vars Required

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   # GateGuard master account SID
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx       # GateGuard master auth token
TWILIO_PHONE_NUMBER=+14805550100                        # GateGuard corporate fallback number
```

Sub-account credentials are stored **per org in the database** (`twilio_subaccount_sid` / `twilio_subaccount_token`), not in env vars.

---

## Next Session Checklist

- [ ] Answer the 3 open questions above (provisioning trigger, area code, use case scope)
- [ ] Apply to Twilio ISV program
- [ ] Write migration 096 and run on beta
- [ ] Build dealer onboarding form (collect EIN, legal name, business type, website)
- [ ] Build `POST /api/admin/twilio/provision` route
- [ ] Build `POST /api/admin/twilio/register-a2p` route
- [ ] Build A2P webhook handler
- [ ] Add Twilio status panel to dealer org detail page in portal
