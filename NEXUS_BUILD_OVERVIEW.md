# GateGuard Nexus — Build Overview & ARIA Context
> Generated June 2026 (Session 15). Full technical context for platform state and AI engine configuration.

---

## 1. PORTAL STATE — What's Built

### Navigation Tabs (all SPA, zero URL changes)
| Tab | Commander Layer | Archivist Layer | Status |
|-----|----------------|-----------------|--------|
| **My Day** | Work Orders + Tasks + Calendar (3 mini-dashboards, each with top 3 AI-scored cards) | WOExplorer (grid+sort), TaskExplorer (list/kanban), CalExplorer (timeline) | ✅ Full |
| **Recent Work** | Quote card + WO card + CRM Activity card | RecentWorkExplorer (Quotes/WOs/Activity tabs) | ✅ Full |
| **New Opps/Leads** | Action Center + Lead Intel + ARIA card | OppsLeadsExplorer (pipeline grid, stage filters) | ✅ Full |
| **Jobs** | Active Job + Create Job + Dispatch | JobsExplorer (list + kanban, job type filter) | ✅ Full |
| **Field** | Tech Onsite + Active WO + Dispatch | FieldExplorer (WOs + tech roster) | ✅ Full |
| **People** | Account + Network + Quick-Add Contact | PeopleExplorer (accounts + dealers + contacts, search) | ✅ Full |

### Key Design Principles
- **Zero-Navigation SPA**: All modal content transitions via `viewState`. No `<Link>`, no `router.push()` inside modals.
- **Commander/Archivist pattern**: 90% of interactions happen in Commander (3 AI-curated action cards). "See All" → Archivist (full data grid).
- **2036 Mission Ops aesthetic**: Glassmorphism, ambient glow halos, IBM Plex Mono data, `rgba(6,12,32,0.94)` dark navy base.
- **Contextual Command Bridge**: `ActionCommandBar` reads `ModalScopeContext` — placeholder and API call scope auto-update per active tab.

### Action Engine (16 tools)
Low-risk: auto-execute + 30s undo toast
Medium-risk: ConfirmationCard (navy gradient, pulsing dot)
High-risk: ConfirmationCard (amber, requires explicit confirm)

Tools: `create_todo`, `update_todo`, `complete_todo`, `create_work_order`, `reschedule_work_order`, `update_work_order_status`, `create_lead`, `update_lead_stage`, `assign_lead`, `create_opportunity`, `update_opportunity_stage`, `mark_opportunity_won` (HIGH), `mark_opportunity_lost` (HIGH), `log_crm_activity`, `schedule_followup`, `create_quote`, `assign_technician`

---

## 2. ARIA ENGINE v7.6 — Full Technical Context

### What ARIA Is
ARIA is GateGuard's AI lead intelligence engine. Given any natural language query (specific property name, city prospect search, criteria-based search, or contract-expiry hunt), it runs a multi-phase research pipeline and returns a complete sales intelligence brief: property details, ISP/video/proptech stack, ownership chain, decision maker contacts, behavioral profile, pitch strategy, and a 6-month outreach campaign.

### Architecture — 6 Sequential Phases

#### Phase 0: Query Rewriting (Haiku, ~0.5s)
**Tool**: Claude Haiku `claude-haiku-4-5-20251001`
**What it does**: Classifies the raw query into 4 intent types:
- `specific_property` — "Northland Wharf 7 Atlanta"
- `city_prospect` — "luxury apartments Atlanta 500+ units"
- `criteria_prospect` — "properties with LiftMaster gates expiring 2025"
- `contract_prospect` — "bulk internet contracts expiring next year"

**Output**: Structured variants for property name, city, ISP context, proptech context, size hints, geographic bounds, management company hints.

**Why it matters**: A raw query like "westwood" could mean anything. Rewriting extracts "Westwood Apartments" (property), "Atlanta" (geo), "Class A multifamily" (type). Every downstream search is more precise.

---

#### Phase 1A: Specific Property Discovery (Tavily + Serper + Serper KG, parallel)
**Tools**: Tavily API (`TAVILY_API_KEY`), Serper.dev (`SERPER_API_KEY`)
**Searches run simultaneously**:
1. **Listing sites** (Tavily, `rawContent=true`): apartments.com, rentcafe.com, zillow.com — gets amenity pages, full unit counts, ISP/cable mentions deep in listing text
2. **Press + news** (Serper): financing announcements, ownership transactions, construction news
3. **Phone KG** (Serper Knowledge Graph): reads Google Knowledge Panel `attributes.Phone` — dedicated phone number extraction
4. **Unit count/address** (Serper): structured property data extraction

**Filters applied**:
- `filterByScore(results, 0.4)` — drops Tavily results with relevance score < 0.4
- `deduplicateByUrl()` — removes duplicate pages (same URL, different query params)
- Source authority weights (`SOURCE_AUTHORITY`) — fcc.gov=10, loopnet.com=8, reddit.com=3 — Haiku told to prefer high-authority data

**Haiku extraction** (1 call): Extracts `property_name`, `address`, `city`, `state`, `zip`, `units`, `year_built`, `property_type`, `management_company`, `phone`, `website`, `isp_providers[]`, `video_providers[]`, `bulk_agreement_detected`, `proptech[]` (direct from listing text).

**ISP/Video blocklists**: `ISP_SERVICE_DESCRIPTIONS` (25+ terms) and `VIDEO_SERVICE_DESCRIPTIONS` (20+ terms) — strips "fiber internet", "cable TV" etc. from being stored as provider names. Only actual company names pass.

---

#### Phase 1B: Prospecting Candidate List (Serper, parallel)
Only runs for `city_prospect`, `criteria_prospect`, `contract_prospect` queries.
Returns a grid of 8-12 candidate properties the sales rep can click to research further.

---

#### Phase 2: Enrichment (FCC + Serper, parallel, ~5s)
**Tools**: FCC Broadband Map API (no key, public), Serper.dev

**5 parallel searches**:
1. **FCC Broadband Map**: `POST /api/public/map/listAvailability` with lat/lng — returns ALL ISPs licensed at that address, technology type (fiber/cable/fixed wireless), max speeds. Ground truth for connectivity.
2. **Bulk ISP agreements** (Serper news): "bulk internet agreement", "MDU internet contract", "master service agreement" — detects bulk deal evidence
3. **ISP/cable ownership** (Serper): targeted ISP portfolio search using live `mdu_providers` names from DB
4. **Video providers** (Serper news): DirecTV, Comcast, Spectrum, Dish + all video names from DB
5. **ROE/Bulk agreement** (Serper): "right of entry", "ROE agreement", bulk expiry signals
6. **EDGAR/Transaction** (Serper): SEC filings, ownership entity, last sale price, cap rate

**DB injection**: `fetchMduProviders()` pulls live ISP + video provider names from `mdu_providers` table — searches use actual company names found in the DB, not hardcoded lists.

**Haiku extraction**: `isp_providers[]`, `video_providers[]`, `bulk_agreements[]` (provider + service_type + expiry_year), `roe_detected`, `roe_providers[]`, `roe_expiry_year`, `owner_entity`, `last_sale_date`, `acquisition_year`, `management_portfolio`.

**DB learning loop**: Checks `aria_properties` for existing record at query start. If found, pre-seeds Phase 2 with all existing ISP/video/ROE data — searches can enrich but never overwrite user-verified fields.

---

#### Phase 3: Intelligence (5 parallel searches + Apollo + NinjaPear)
**Tools**: Tavily (rawContent), Serper, Apollo API (`APOLLO_API_KEY`), NinjaPear API (`NINJAPEAR_API_KEY`)

**5 parallel searches**:
1. **Proptech** (Tavily, rawContent): gate operators, access control, intercoms, cameras — full page text for brand detection
2. **Management company website** (Tavily, rawContent): staff directory, ownership structure, org chart
3. **Pain signals** (Serper): resident reviews, complaints about gates/security/connectivity
4. **Social** (Serper): `site:reddit.com OR Google Reviews OR site:facebook.com` — authentic pain signals
5. **Management website fallback** (fetch with rawContent): direct website crawl if Tavily returns nothing

**Apollo (`/api/v1/people/match`)**: Given management company domain + top contact name → returns email, phone, LinkedIn, title, company size. Top 3 contacts resolved in parallel (`Promise.all`).

**NinjaPear Employee API (`/api/v1/employee/profile`)**: Validates top contact is still employed at the management company (`work_experience[].end_date === null`). Prevents pitching someone who left 2 years ago.

**Haiku extraction**: Categorizes proptech into arrays: `gate_operators[]`, `access_control_systems[]`, `intercom_systems[]`, `camera_systems[]`, `smart_locks[]`, `proptech_apps[]`. Extracts pain signals, displacement targets.

---

#### Phase 4: Synthesis (Claude Sonnet, ~9s)
**Tool**: Claude Sonnet `claude-sonnet-4-6`, tool-use mode, `max_tokens: 2800`

**Input**: Everything from Phases 1-3: property data, ISP/video/proptech stacks, owner chain, contacts (Apollo-enriched), pain signals, ROE data, DB seed.

**Output** (structured via tool schema):
- `property_profile`: units, year, type, management company, owner entity, website, phone, address
- `connectivity`: ISP providers, video providers, bulk agreements, ROE status, contract urgency, contract window
- `proptech`: full gate/access/intercom/camera/app stacks, displacement targets, SARA signals
- `decision_makers`: primary + 2 additional contacts with name/title/email/phone/LinkedIn, `dm_hooks[]` per person, behavioral_profile, buying_trends
- `pitch_strategy`: primary angle, objection flags, key finding, urgency drivers, competitive displacement opportunity
- `behavioral_profile`: communication style, org culture, tech adoption pattern
- `outreach_plan`: month_1 through month_6 (theme + actions[] + goal), total_touches, primary_channel, key_milestone, expected_close_quarter
- `freshness_score`: data quality 0-100
- `key_finding`: single most important insight for the sales rep

**Post-synthesis**: Non-blocking upsert to `aria_properties` (never deletes, always enriches). Auto-catalogs new tech providers to `aria_tech_providers`.

---

### External APIs — What We Pay For + What We Get

| API | Key | Cost | What We Get |
|-----|-----|------|-------------|
| **Tavily** | `TAVILY_API_KEY` | ~$0.01/search | Deep web search with relevance scores. `rawContent=true` returns full page text (critical for amenity pages). Best for listing sites and proptech pages. |
| **Serper** | `SERPER_API_KEY` | ~$0.001/search | Google Search API. Used for news/press, Reddit, Knowledge Graph phone extraction. Cheaper than Tavily for quick lookups. |
| **Apollo** | `APOLLO_API_KEY` | ~$0.10/contact | B2B contact enrichment. Given name + company domain → returns email, phone, title, LinkedIn URL. Multi-contact parallel resolution. |
| **NinjaPear** | `NINJAPEAR_API_KEY` | ~$0.02/lookup | Employee profile validation. Confirms contact still works at the company. Prevents wasted outreach to departed decision makers. |
| **FCC Broadband Map** | None (public) | Free | Ground-truth ISP licensing data at any US address. Returns ALL licensed providers, technology type, and max speeds. Authoritative source. |
| **PDL** | `PDL_API_KEY` | Not yet active | Behavioral/psychographic enrichment — planned for DM personality scoring. |
| **Prospeo** | `PROSPEO_API_KEY` | Not yet active | Email format finder via LinkedIn — backup for Apollo misses. |

**Claude API usage per ARIA search**:
- Haiku Phase 0: ~200 tokens ($0.0001)
- Haiku Phase 1A extraction: ~1400 tokens ($0.0007)
- Haiku Phase 2 extraction: ~1200 tokens ($0.0006)
- Haiku Phase 3 extraction: ~1600 tokens ($0.0008)
- Haiku outreach plan (parallel): ~800 tokens ($0.0004)
- Sonnet Phase 4 synthesis: ~4000 tokens ($0.018)

**Total estimated cost per deep search**: ~$0.25–$0.45 depending on API hits

---

### What ARIA Puts in the DB (`aria_properties`)
Every search upserts (never deletes) a row keyed on `(lower(property_name), lower(address))`:

| Field Group | Fields |
|-------------|--------|
| **Identity** | property_name, address, city, state, zip, lat, lng, website, phone |
| **Property** | units, year_built, property_type, management_company, owner_entity |
| **Connectivity** | isp_providers[], video_providers[], bulk_agreements[], fcc_providers[], roe_detected, roe_providers[], roe_expiry_year, contract_window |
| **Proptech** | gate_operators[], access_control_systems[], intercom_systems[], camera_systems[], smart_locks[], proptech_apps[] |
| **Sales Intel** | behavioral_profile, pitch_strategy, key_finding, outreach_plan, freshness_score, times_researched |
| **Decision Makers** | dm_name, dm_title, dm_email, dm_phone, dm_linkedin, dm_hooks[], additional_contacts[], buying_trends |
| **Sales Cycle** | sales_stage, sales_notes, assigned_rep, contract_expiry_year |
| **Learning** | *_user_verified flags — protect user corrections from AI overwrites |

---

## 3. UNIVERSAL INTENT ENGINE — Vision (To Build)

**The "5th grader can run it" principle**: Any action in the portal can be triggered by natural language. The system detects intent, asks the minimum required questions, and creates the record.

### How It Works
User types: `"xyz property called about our services"`

The chat route (`/api/assistant/chat`) detects `new_lead` intent and returns:
```json
{
  "type": "intake",
  "intent": "new_lead",
  "collected": { "name": "XYZ Property" },
  "next_question": "What services are they interested in?",
  "options": ["Gate Access", "Intercoms", "Access Control", "Cameras", "All of the above"],
  "step": 1,
  "total_steps": 6
}
```

The frontend renders an **IntakeCard** (glass panel, pulsing border) with:
- Context chip: "New Lead: XYZ Property"
- The question
- Quick-tap chips for common answers
- Free text fallback
- Progress bar (1 of 6)

### Intent Types + Questions

| Intent | Trigger phrases | Fields collected |
|--------|----------------|-----------------|
| `new_lead` | "called about services", "interested in gates", "new property" | property name, services interested, units, current solution, address, phone, main contact, email, next steps |
| `log_activity` | "called", "emailed", "met with", "talked to" | contact name, activity type, outcome, next follow-up |
| `create_work_order` | "needs service", "gate is broken", "schedule a tech" | property, issue description, priority, preferred date, assigned tech |
| `create_quote` | "wants a quote", "pricing for", "proposal for" | property, services needed, units, timeline |
| `dispatch_tech` | "send [tech] to", "assign [tech]" | work order ID or property, tech name, date |
| `mark_won` | "we won", "they signed", "deal closed" | opportunity ID, close date, next steps (create job?) |
| `schedule_followup` | "remind me to", "follow up with", "check on" | contact/property, date, reason |

### Architecture
- `app/api/assistant/chat/route.ts`: Add `detectIntake()` pre-processor — scans message for intent keywords before agentic loop
- If intake detected: return `{ type: 'intake', ... }` (special response type, not a normal message)
- New component `components/nexus/IntakeCard.tsx`: Multi-step progressive form, pulsing glass aesthetic, progress indicator
- On final step: call `/api/assistant/execute` with collected data → creates the record
- On any step: user can type free-form answer instead of tapping a chip

---

## 4. PENDING — WO Detail Glass Pane
When a work order title is clicked in WOExplorer (or any explorer), a detail panel should slide open inside the same modal state showing:
- Full WO details (description, priority, status, dates, tech)
- Customer info + site info
- Notes/comments
- Quick actions: Mark Complete, Reassign, Add Note
- Deep intel links: View Site Intel (ARIA), Open Dispatch, Open Site Page

This is tracked as Task #200 in the build queue.

---

## 5. ARIA P1 Data Quality Gaps (From June 2026 Platform Review)
1. **DM Scoring 1-10**: Property phone only = 1-3; onsite contact = 3-5; senior mgmt = 5-7; ownership = 7-9; full chain = 9-10
2. **Primary phone mandatory**: Must always return property office phone or "No data found."
3. **Unit count mandatory**: Same — "No data found" beats blank
4. **Year built / occupancy / last sale**: Always attempted, always returned
5. **"No data found" policy**: Any attempted field that returned nothing = explicit "No data found" string
6. **Proptech inference with confidence %**: No brand found but camera complaints in reviews → "Camera system (suspected, ~70%)"
7. **Search filter checkboxes**: All PropTech | ISP/Internet | Cable/Video | Gate/Access | Cameras — above Launch ARIA
8. **Cold call script in PropTech tab**: Property-specific script based on actual pain signals, not generic AI advice
