# GateGuard Nexus — Platform Milestone & Build Changelog
> Last updated: June 2, 2026 (Session 15). Comprehensive record of every feature shipped, file created, and architectural decision made.

---

## Platform Overview

| App | Repo | URL | Status |
|-----|------|-----|--------|
| **Dealer Portal (Nexus)** | `gateguard-portal` | portal.gateguard.co | ✅ Live |
| **GateCard** | `gatecard.co` | gatecard.co | ✅ Live |
| **SOC** | `gateguard-dispatch-ui` | ggsoc.com | ✅ Live |
| **Visitor Kiosk** | (separate) | stonegate-visitor.vercel.app | ⛔ Deprecated |

**Stack:** Next.js 14.2 App Router · TypeScript · Supabase (pgvector) · Clerk auth · Resend · Stripe · Mapbox GL JS · Claude Haiku/Sonnet · OpenAI embeddings

---

## Session 1 — May 26, 2026 · Foundation & Sales Engine

### Features Shipped
- NDA template (`lib/nda-template.ts`) — Mutual NDA, 4 merge vars, 3-year term, Trade Secrets in perpetuity
- Dealer Agreement template (`lib/agreement-template.ts`) — Full Dealer & Reseller Agreement + Exhibit A, no hardcoded prices
- Dealer onboarding wizard expanded to 7 steps — Step 3: NDA + Agreement preview + send toggle
- `onboard-dealer` API — fires NDA + Agreement emails via Resend on dealer creation
- Compliance tab (dealer detail page) — live e-sign status cards, Send/Resend/Countersign/Upload
- Sidebar gradient — Gemini-style deep radial navy-to-black glow
- CRM dashboard enterprise redesign — global filter bar, KPI sparklines, pipeline funnel, forecast area chart, AI Deal Scores, activity quick-actions, lead comms icons
- Quotes page enterprise redesign — KPI sparklines, bar funnel, 2-col layout (table + Deal Velocity panel), filter tabs with live counts
- Scenario Gallery (`/quotes/new`) — 6-card intent-driven gallery, `loadTemplate()`, `SCENARIO_TEMPLATES`, `CPQ_DEPS`
- CPQ Quote Builder (`/quotes/[id]`) — dependency engine, margin engine, Internal Financial Summary sidebar (donut ring), approval gateway

### Files Created / Modified
| File | Change |
|------|--------|
| `lib/nda-template.ts` | Created — NDA v2 with 9 sections |
| `lib/agreement-template.ts` | Created — full Dealer Agreement + Exhibit A |
| `app/admin/dealers/new/page.tsx` | Modified — 7-step wizard, entity_type field |
| `app/api/admin/onboard-dealer/route.ts` | Modified — fires NDA + Agreement emails |
| `app/admin/dealers/[id]/page.tsx` | Modified — Compliance tab added |
| `components/layout/Sidebar.tsx` | Modified — sidebar gradient |
| `app/crm/page.tsx` | Rewritten — enterprise CRM dashboard |
| `app/quotes/page.tsx` | Rewritten — enterprise quotes list |
| `app/quotes/new/page.tsx` | Rewritten — Scenario Gallery + CPQ |
| `app/quotes/[id]/page.tsx` | Rewritten — CPQ builder with margin engine |

---

## Session 2 — May 27, 2026 · Dashboard + PWA + Dispatch

### Features Shipped
- Tactical Hub Dashboard (`app/page.tsx`) — full rewrite: 4 KPI card groups, EOS + Team Performance, All Accounts table, System & Alerts panel
- TopBar on Quotes page — `<TopBar>` import, `+New Quote` via `actions` prop
- PWA upgrade — `icon-192.png` + `icon-512.png`, `manifest.json` (name: GateGuard Nexus, short_name: Nexus), `layout.tsx` viewport config
- Responsive grid fixes — `lg:`/`sm:` prefixes across dashboard, CRM, quotes pages
- Mobile dashboard — compact KPI card format, `hidden lg:flex` secondary metrics
- Dispatch page enterprise redesign — TopBar, `#F8FAFC` bg, list/board toggle (localStorage), Tech Roster leaderboard (top 3 by streak), per-tech `/tech` access codes (Generate/Regen/Copy)
- `lib/tech-auth.ts` — shared `isTechAuthed()` helper checking global env var then `technicians.tech_code`
- Migration 093 — `technicians.tech_code TEXT` column + unique partial index
- ARIA page full redesign — split list+detail layout, 4-tab detail panel (Property / DM / Intel / SCOUT), pipeline animation, mobile bottom nav
- ARIA deep engine upgrade — Claude Sonnet synthesis, Apollo contacts, behavioral_profile, pitch_strategy, freshness_score, buying_trends
- Migration 094 — `show_leads.assigned_to_user_id`, `assigned_to_name`, `temp_hold_expires_at`
- ARIA import route — stamps ownership + 7-day temp hold

### Files Created / Modified
| File | Change |
|------|--------|
| `app/page.tsx` | Rewritten — Tactical Hub Dashboard |
| `public/manifest.json` | Modified — PWA manifest |
| `app/layout.tsx` | Modified — PWA meta tags |
| `app/dispatch/page.tsx` | Rewritten — enterprise dispatch |
| `lib/tech-auth.ts` | Created — shared tech auth helper |
| `app/api/dispatch/technicians/route.ts` | Modified — tech_code support |
| `app/api/dispatch/technicians/[id]/route.ts` | Modified — PATCH tech_code |
| `app/aria/page.tsx` | Rewritten — split-pane + 4-tab UI |
| `app/api/aria/research/deep/route.ts` | Upgraded — Sonnet synthesis + Apollo |
| `supabase/migrations/093_tech_code.sql` | Created |
| `supabase/migrations/094_aria_ownership.sql` | Created |
| `app/api/aria/searches/[id]/import/route.ts` | Created |

---

## Session 3 — May 27, 2026 · Feature Flag System

### Features Shipped
- Migration 095 — `feature_catalog` (41 seeded features), `org_feature_flags`, `user_feature_access`
- Global Feature Settings (`/admin/settings/features`) — per-tier access selectors, paid/beta toggles, Stripe product ID, dirty tracking
- Features tab on dealer detail — per-org overrides, promo toggle, expiry date
- Platform Users page — "Role & Modules" + "Feature Access" tab switcher, `FeatureAccessSelector`
- Sidebar feature gating — fetches `/api/user-features/me`, `isFeatureVisible()`, `HREF_TO_FEATURE` map

### Files Created / Modified
| File | Change |
|------|--------|
| `supabase/migrations/095_feature_flags.sql` | Created — 3 tables + 41 seeded features |
| `app/admin/settings/features/page.tsx` | Created — global feature settings |
| `app/api/admin/features/route.ts` | Created |
| `app/api/admin/org-features/[orgId]/route.ts` | Created |
| `app/api/admin/user-features/[userId]/route.ts` | Created |
| `app/api/user-features/me/route.ts` | Created |
| `app/admin/users/page.tsx` | Modified — feature access tab |

---

## Session 4 — May 27, 2026 · Security + Document Flow

### Features Shipped
- Feature Settings page UX redesign — compact `<select>` dropdowns, expandable ⚙ rows, collapsible sections
- Migration 095b — 8 AI Army agents in `feature_catalog` (ARIA, TRINITY, SCOUT, BEACON, FORGE, ATLAS, SAGE, RELAY)
- Sidebar Access Control — Features/Dealers/Users quick-link strip, AI Army agents feature-gated
- Migration 096 — `organizations.entity_type TEXT`
- API security — org hierarchy scoping on 3 routes: `onboard-dealer GET`, `admin/users GET`, `dealers/[id] GET+PATCH`
- Migration 097 — `document_signatures.document_html TEXT`
- NDA + Agreement editable preview in wizard — effective date field, preview textarea, edited HTML stored in DB
- Sign page displays stored `document_html` inline

### Files Created / Modified
| File | Change |
|------|--------|
| `supabase/migrations/095b_ai_agent_features.sql` | Created |
| `supabase/migrations/096_org_entity_type.sql` | Created |
| `supabase/migrations/097_sig_document_html.sql` | Created |
| `app/api/signatures/send/route.ts` | Modified — RESEND check, error surfacing |
| `app/sign/[token]/page.tsx` | Modified — inline document_html display |
| `components/layout/Sidebar.tsx` | Modified — Access Control strip, AI Army gating |

---

## Session 5 — May 27, 2026 · Google Calendar + Dealer Resume Flow

### Features Shipped
- Google Calendar status route fix — KV lookup bug → correct `user_settings` column query
- GCal sync route rewrite — 3 bug fixes (token read, `start_date` → `start_time`, push tracking)
- Calendar events route — GCal token fix, 3 new event types (work_order_phase, pm_schedule, crm_activity)
- Calendar page — 3 new event type colors/labels (orange, teal, violet)
- Todos API — `unscheduled=true` param, `limit` param, dual key response
- Dealer onboarding resume flow — `?resume=ORG_ID` param, pre-fills wizard state, auto-advances to incomplete step
- Dealer list page — amber "Resume →" link for incomplete dealers
- Dealer detail page — "Onboarding incomplete" banner
- NDA template v2 — added §3 Legally Compelled, §5 IT Backup Exception, §6 Non-Solicitation

### Files Created / Modified
| File | Change |
|------|--------|
| `app/api/calendar/google/status/route.ts` | Fixed |
| `app/api/calendar/google/sync/route.ts` | Rewritten |
| `app/api/calendar/events/route.ts` | Fixed + 3 new types |
| `app/calendar/page.tsx` | Modified — new event colors |
| `app/api/todos/route.ts` | Modified — unscheduled + limit params |
| `app/admin/dealers/new/page.tsx` | Modified — resume flow |
| `app/admin/dealers/page.tsx` | Modified — "Resume →" link |
| `lib/nda-template.ts` | Modified — v2 with 9 sections |

---

## Session 6 — May 27, 2026 · ARIA Intelligence DB + Single Search Mode

### Features Shipped
- ARIA page — removed Base/Deep toggle, always deep; Re-run ↺ button; Intel DB panel (Globe icon + count badge)
- `IntelDBPanel` — search/filter bar, property list with score/stage/expiry badges, detail panel with sales notes editor + stage selector + Re-research button
- Migration 098 — `aria_properties` (never deleted, upsert-on-search) + `aria_tech_providers` (50+ seeded) + `increment_*` RPCs
- `app/api/aria/properties/route.ts` — GET (paginated, filterable) + POST (batch upsert, extracts `contract_expiry_year`, auto-catalogs tech providers)
- `app/api/aria/properties/[id]/route.ts` — GET single + PATCH sales cycle fields
- CRM activities PATCH/DELETE — inline edit UI on opportunity detail
- GCal push fix — todos scoped to current user, per-item error capture, WO end time = start + 1hr

### Files Created / Modified
| File | Change |
|------|--------|
| `app/aria/page.tsx` | Modified — single search + Intel DB panel |
| `supabase/migrations/098_aria_intelligence_db.sql` | Created |
| `app/api/aria/properties/route.ts` | Created |
| `app/api/aria/properties/[id]/route.ts` | Created |
| `app/api/crm/activities/[id]/route.ts` | Created — PATCH + DELETE |

---

## Session 7 — May 29, 2026 · ARIA Engine Data Quality + API Fixes

### Features Shipped
- ARIA diagnostic test route (`/api/aria/test`) — raw API endpoint, no Haiku, ground-truth auditing
- FCC API fix — GET (405) → POST with JSON body
- Apollo API fix — deprecated `/mixed_people/search` (403) → `/api/v1/people/match`, Bearer auth
- NinjaPear migration — replaced ProxyCurl with NinjaPear Employee API (`NINJAPEAR_API_KEY`)
- 504 timeout fix — Apollo + NinjaPear + emailFormat in one `Promise.all` (was sequential, +12s)
- Phase 0 bootstrap fix — quoted property name in search query
- Phase 1 unit extraction — "N studio to" pattern for press release phrasing
- Phase 3 Reddit — switched from Tavily to Serper (better Reddit indexing)
- Phone extraction — explicit format examples added to Phase 1 Haiku prompt

### Files Created / Modified
| File | Change |
|------|--------|
| `app/api/aria/research/deep/route.ts` | Engine fixes v6.x |
| `app/api/aria/test/route.ts` | Created |

---

## Session 8 — May 29, 2026 · ARIA v7.1: Video/ROE + Learning Loop

### Features Shipped
- ARIA v7.0 — full rewrite: 4-phase sequential architecture (specific_property / city_prospect / criteria_prospect / contract_prospect)
- ARIA v7.1 — Phase 2 expanded: video provider search + ROE/bulk agreement search
- `fetchMduProviders()` — live DB provider names injected into search queries
- Learning loop — re-search enriches existing `aria_properties` record, never replaces
- `lookupExistingProperty()` — DB lookback parallel to Phase 1A
- `runPhase2` — accepts `dbProviders` param
- Smart merge upsert (`mergeVal()`, `mergeArr()`, `mergeBulkAgreements()`) — never shrinks arrays
- User-verified contact flags protect corrected DM data from AI overwrites
- Migration 100 — `aria_properties` ROE fields + `*_user_verified` boolean flags
- Candidate grid UI — `CandidateGrid` component with score circle, ISP badge, pain brief

### Files Created / Modified
| File | Change |
|------|--------|
| `app/api/aria/research/deep/route.ts` | Rewritten v7.1 |
| `app/aria/page.tsx` | Modified — CandidateGrid UI |
| `app/api/aria/properties/route.ts` | Modified — smart merge upsert |
| `app/api/aria/properties/[id]/route.ts` | Modified — extended PATCH with verified flags |
| `supabase/migrations/100_aria_roe_learning_loop.sql` | Created |

---

## Session 9 — May 29, 2026 · ARIA v7.2: SCOUT 6-Month Campaign

### Features Shipped
- ARIA v7.2 — dbPhase2Seed fix (seeds ALL existing ISP/video/ROE, not just user-verified)
- 6-month outreach_plan in Sonnet tool schema — month-by-month campaign calendar
- Expanded SCOUT queue — full campaign brief: market_context, connectivity, proptech, behavioral_profile, pitch_strategy, key_finding, objection_flags, outreach_plan

### Files Modified
| File | Change |
|------|--------|
| `app/api/aria/research/deep/route.ts` | Engine v7.2 |

---

## Session 10 — May 29, 2026 · ARIA v7.3: Raw Content + Social + Maps

### Features Shipped
- ARIA v7.3 — Phase 1A amenity deep read (rawContent=true targeting listing sites)
- Phase 1A snippet cap — 600 chars standard / 4000 chars raw per page
- dbPhase2Seed fix — seeds unconditionally (root cause of GIGstreem disappearing on re-run)
- Phase 3 social search — 5th parallel search (Reddit/Google Reviews/Facebook/Yelp)
- Phase 3 proptech rawContent — 2500 chars per result
- Listing proptech distribution — Phase 1A brands distributed to correct Phase 3 category arrays
- Parallel Haiku outreach plan — runs in `Promise.all` alongside Sonnet (zero added latency)
- 504 fix — `maxDuration: 60 → 120`, Sonnet tokens 3500 → 2800
- ARIA page — address moved to Property tab bottom, Google Maps iframe embed

### Files Modified
| File | Change |
|------|--------|
| `app/api/aria/research/deep/route.ts` | Engine v7.3 |
| `app/aria/page.tsx` | Modified — maps embed |

---

## Session 11 — May 30, 2026 · ARIA SWR Cache + Inngest + Realtime

### Features Shipped
- SWR fast-path — cache check fires before full pipeline; cache hit → instant result (<200ms); stale hit → show data + fire Inngest re-enrichment
- Cache status badges — emerald/amber/brand-blue in TopBar
- `/api/aria/cache` route — fast Supabase lookup, fuzzy-match, 14-day freshness TTL
- `/api/aria/enrich` route — fires Inngest `aria/property.enrich` event
- Inngest `enrich-property` function — v4 API, 90s timeout, 2 retries
- Inngest infrastructure — `inngest/client.ts` + `app/api/inngest/route.ts`, middleware bypass, `ARIA_SERVICE_KEY` env var
- Supabase Realtime subscription — auto-updates UI when enrichment completes, 30s fallback poll, 3-minute hard timeout
- `aria_properties` added to `supabase_realtime` publication (prod)
- 2035 PipelinePanel redesign — dark radial navy HUD, grid overlay, scan line, ARIA orbital rings, phase nodes, connector beams

### Files Created / Modified
| File | Change |
|------|--------|
| `app/aria/page.tsx` | Modified — SWR, Realtime, PipelinePanel |
| `app/api/aria/cache/route.ts` | Created |
| `app/api/aria/enrich/route.ts` | Created |
| `inngest/client.ts` | Created |
| `inngest/functions/enrich-property.ts` | Created |
| `app/api/inngest/route.ts` | Created |
| `middleware.ts` | Modified — Inngest bypass |

---

## Session 12 — May 31, 2026 · ARIA v7.4: Data Quality + Provider Catalog

### Features Shipped
- ARIA v7.4 — ISP/video service-description naming guard (`ISP_SERVICE_DESCRIPTIONS` + `VIDEO_SERVICE_DESCRIPTIONS` blocklists, 25+ terms each)
- `filterProviderNames()` — strips description strings, only actual company names pass
- Dedicated phone search — `serperSearchKG()` reads Google Knowledge Graph `knowledgeGraph.attributes.Phone`
- Expanded `KNOWN_MDU_BULK_ISPS` — 40+ entries (Spectrum, AT&T, Verizon Fios, Google Fiber Webpass, DojoNetworks, Smartaira, Starry, etc.)
- Expanded `KNOWN_VIDEO_PROVIDERS` — Dish Fiber, Sling TV, Philo, FuboTV, DirecTV dealers
- Expanded `ispKeywords` — 15 terms
- Phase 3 proptech brand list — Swiftlane, Kastle, Flock Safety, Eagle Eye, Rhombus, Deep Sentinel, CellGate, Verkada
- Migration 101 — 14 new `mdu_providers` entries + `aria_tech_providers` camera/gate/ISP additions + category CHECK extended to `'isp'`
- Middleware fix — `/api/aria/` moved from `isBypassPath` into `clerkHandler`

### Files Modified
| File | Change |
|------|--------|
| `app/api/aria/research/deep/route.ts` | Engine v7.4 |
| `supabase/migrations/101_provider_catalog_expansion.sql` | Created |
| `middleware.ts` | Fixed — ARIA auth telemetry error |

---

## Session 13 — June 1, 2026 · Nexus Tracker Phase 2 + P0 Fixes

### Features Shipped
- Migration 103 — `tracker_groups.entity_type TEXT + entity_id UUID + DROP NOT NULL org_id`
- Migration 104 — `tracker_items.owner_user_id TEXT + due_date DATE`
- `TrackerBoard.tsx` — reusable board component: entityType prop, board + table views, sub-items, NL quick-add, item drawer with assignee + due date edit
- Tasks tab on Opportunity detail (`/crm/opportunities/[id]`)
- Tasks tab on Work Order detail (`/maintenance/[id]`)
- Tasks tab on Site detail (`/sites/[id]`)
- TrackerBoard embedded in Lead detail (`/crm/leads/[id]`)
- `tracker_task` event type in calendar — violet `#8B5CF6`
- P0 bugs fixed: ARIA search history scoped to user, `/business/expenses` 404 resolved, Documents "New Contract" button wired (3 paths)

### Files Created / Modified
| File | Change |
|------|--------|
| `components/tracker/TrackerBoard.tsx` | Created — reusable board |
| `app/api/tracker/groups/route.ts` | Rewritten — ENTITY_SEEDS |
| `app/api/tracker/items/route.ts` | Modified — group_ids, include_subitems, owner |
| `app/crm/opportunities/[id]/page.tsx` | Modified — Tasks tab |
| `app/maintenance/[id]/page.tsx` | Modified — Tasks tab |
| `app/sites/[id]/page.tsx` | Modified — Tasks tab |
| `app/crm/leads/[id]/page.tsx` | Modified — TrackerBoard |
| `app/api/calendar/events/route.ts` | Modified — tracker_task type |
| `app/calendar/page.tsx` | Modified — tracker_task color |
| `supabase/migrations/103_tracker_entity_embed.sql` | Created |
| `supabase/migrations/104_tracker_assignee_duedate.sql` | Created |

---

## Session 14 — June 2, 2026 · Floor Plans + PM OS + ARIA v7.6 + Nexus Action Engine

### Features Shipped
- **Floor Plan Platform** — full Fabric.js rewrite: 4 tabs (Floor Plan / Rack / Wire / BOM), 7 tool modes, 28 device types, camera FOV cones, orthogonal cable routing, RackPanelView, background import, multi-plan, export PNG
- **Project Management OS** (`/tracker`) — 7 views: Board, Table, Gantt (dependencies + critical path), Calendar, Chart, Workload, Timeline; 7 view components
- Migration 106 — `tracker_items.data JSONB + priority + tags` + `tracker_dependencies` + `tracker_automations` + `tracker_activity`
- **ARIA v7.6** — Haiku Phase 0 query rewriting (`rewriteQuery()`), `filterByScore()` (min 0.4), `deduplicateByUrl()`, `SOURCE_AUTHORITY_WEIGHTS`, multi-contact Apollo (top 3 parallel), EDGAR ownership + transaction searches
- Dashboard gradient — `linear-gradient(180deg, rgba(107,126,255,0.09)...)` on outer div
- **Nexus Action Engine** — 16 tools, risk tiers (low=auto+undo, medium=ConfirmationCard, high=amber ConfirmationCard), `reasoning` required on every tool, 30s UndoToast
- Projects page (`/projects`) — Job OS with 5 views, job types (Install/Service/Convert)
- P0 bugs: ARIA search history scoped to user, expenses 404 fixed, Documents New Contract button wired

### Files Created / Modified
| File | Change |
|------|--------|
| `app/design/floor-plans/page.tsx` | Rewritten — Fabric.js platform (1,603 lines) |
| `app/tracker/page.tsx` | Rewritten — 7-view PM OS |
| `components/tracker/views/` | Created — 7 view components |
| `app/api/aria/research/deep/route.ts` | Upgraded — v7.6 |
| `lib/assistant-executor.ts` | Created — 16 tools, RevertPayload |
| `app/api/assistant/execute/route.ts` | Created |
| `app/api/assistant/revert/route.ts` | Created |
| `app/api/assistant/chat/route.ts` | Created — agentic loop, risk tiers |
| `components/layout/NexusAssistant.tsx` | Modified — ConfirmationCard, UndoToast |
| `app/projects/page.tsx` | Created — Job OS |
| `supabase/migrations/106_tracker_pm_os.sql` | Created |

---

## Session 15 — June 2, 2026 · Nexus Dual-Pane + Anti-Chatbot + ARIA v8

### Features Shipped
- **Nexus Dual-Pane Architecture** — all 5 remaining tabs upgraded to Commander/Archivist state machine
- **RecentWorkModal** — Commander (Quote/WO/CRM Activity cards) + `RecentWorkExplorer`
- **NewOppsLeadsModal** — Commander (Action Center/Lead Intel/ARIA cards) + `OppsLeadsExplorer`
- **JobsModal** — Commander (Active Job/New Job/Dispatch cards) + `JobsExplorer`
- **FieldModal** — Commander (Tech Onsite/Active WO/Dispatch cards) + `FieldExplorer`
- **PeopleModal** — Commander (Account/Network/QuickAdd cards) + `PeopleExplorer`
- Five new Archivist explorers: `RecentWorkExplorer`, `OppsLeadsExplorer`, `JobsExplorer`, `FieldExplorer`, `PeopleExplorer`
- **NEXUS_BUILD_OVERVIEW.md** — full technical context for ARIA v7.6 and all 6 tabs
- **Anti-chatbot fix** — `detectOperationalIntent()` pre-processor in chat route, `buildActionCardsResponse()` for 6 intent types, `CardResponseView` + `ActionCardItem` glass components in `page.tsx`
- NEXUS ActionCards render instead of text bubbles for: find_opportunities, find_leads, find_work_orders, find_quotes, morning_briefing, intake_lead
- Proactive Action Cards on empty results — no dead ends
- **ARIA v8 design** — candidate preservation, evidence ledger, quality gates architecture (see below)

### Files Created / Modified
| File | Change |
|------|--------|
| `components/nexus/modals/RecentWorkModal.tsx` | Rewritten |
| `components/nexus/modals/NewOppsLeadsModal.tsx` | Rewritten |
| `components/nexus/modals/JobsModal.tsx` | Rewritten |
| `components/nexus/modals/FieldModal.tsx` | Rewritten |
| `components/nexus/modals/PeopleModal.tsx` | Rewritten |
| `components/nexus/modals/explorers/RecentWorkExplorer.tsx` | Created |
| `components/nexus/modals/explorers/OppsLeadsExplorer.tsx` | Created |
| `components/nexus/modals/explorers/JobsExplorer.tsx` | Created |
| `components/nexus/modals/explorers/FieldExplorer.tsx` | Created |
| `components/nexus/modals/explorers/PeopleExplorer.tsx` | Created |
| `NEXUS_BUILD_OVERVIEW.md` | Created |
| `app/api/assistant/chat/route.ts` | Modified — anti-chatbot pre-processor |
| `app/page.tsx` | Modified — ActionCard rendering |

---

## ARIA v8 Architecture (In Progress — Session 15)

### The Problem
ARIA collects strong evidence across phases but operates as a single-answer pipeline. When a query returns 6-12 candidate properties, only the top-ranked result is carried forward. The other 5-11 candidates — and all evidence supporting them — are discarded at synthesis time. This is a **state loss / pipeline discipline failure**, not a data quality problem.

### The Fix
Treat every search as a **case file**:

```
SearchRun
  ├── QueryRewrite (intent + structured variants)
  ├── CandidateDiscovery (all 6-12, none deleted)
  │     ├── Candidate 1 — selected — confidence 91%
  │     ├── Candidate 2 — retained — confidence 82%
  │     ├── Candidate 3 — retained — confidence 76%
  │     └── ...
  ├── EvidenceLedger (every fact, every source, every phase)
  │     ├── { fact_type: units, value: 1124, source: apartments.com, confidence: 0.92 }
  │     ├── { fact_type: gate_issue, value: complaint text, source: reddit, confidence: 0.74 }
  │     └── ...
  ├── QualityGates (required field checklist before synthesis)
  └── FinalBrief (top match + all ranked runners-up)
```

### New DB Tables (Migration 107)
- `aria_search_runs` — one record per pipeline execution
- `aria_candidates` — ALL discovered properties, `status: pending/selected/rejected_by_score/rejected_by_user`
- `aria_evidence_packets` — every found fact with source URL, authority score, confidence, phase found

### Engine Rule
> No synthesis without ledger. No deletion without human action. No selected candidate without showing the runners-up.

---

## Migration Status (Complete to Date)

| Migration | Description | Status |
|-----------|-------------|--------|
| 106 | Tracker PM OS tables | ⏳ Run on beta then prod |
| 104 | `tracker_items` owner + due_date | ✅ beta + prod |
| 103 | `tracker_groups` entity embed | ✅ beta + prod |
| 101 | mdu_providers + aria_tech_providers expansion | ✅ beta + prod |
| 100 | aria_properties ROE + user_verified flags | ✅ beta + prod |
| 098 | aria_properties + aria_tech_providers | ✅ beta + prod |
| 097 | document_signatures.document_html | ✅ beta + prod |
| 096 | organizations.entity_type | ✅ beta + prod |
| 095b | AI agent features in feature_catalog | ✅ beta + prod |
| 095 | feature_catalog + org/user feature flags | ✅ beta + prod |
| 094 | show_leads ownership fields | ✅ beta + prod |
| 093 | technicians.tech_code | ✅ beta + prod |
| 091 | Quote v2 columns | ✅ beta + prod |

---

## Current Platform State

### Fully Deployed Features
- ✅ Dealer onboarding (7-step wizard + NDA/Agreement e-sign)
- ✅ CRM (leads + opportunities + activities + pipeline)
- ✅ Quotes (CPQ builder + margin engine + client proposal + approval)
- ✅ Dispatch (work orders + tech roster + per-tech codes)
- ✅ ARIA Lead Intelligence v7.6 (6-phase pipeline + Intel DB + Inngest background enrichment)
- ✅ Calendar (GCal sync + 6 event types)
- ✅ Tracker / PM OS (7 views + Gantt dependencies + entity boards)
- ✅ Floor Plans (Fabric.js platform + Rack Diagram + Wire Schedule + BOM)
- ✅ Nexus (Commander/Archivist tabs + Action Engine + anti-chatbot ActionCards)
- ✅ Feature flags (41 features, org/user overrides, sidebar gating)
- ✅ E-sign (NDA + Dealer Agreement + countersign flow)

### Pending / In Progress
- ⏳ Migration 106 (run on beta then prod)
- ⏳ ARIA v8 (candidate preservation + evidence ledger + quality gates)
- ⏳ WO detail glass pane (Task #200)
- ⏳ Universal Intent Engine / IntakeCard (Task #198)
- ⏳ DM Scoring 1-10 display
- ⏳ CPQ Phase 2 (unit_cost column, interactive proposal)
- ⏳ Client portal at `/[site-slug]`

---

## AI Army — Agent Status

| Agent | Purpose | Status |
|-------|---------|--------|
| **ARIA** | Lead intelligence — 6-phase pipeline | ✅ v7.6, v8 in progress |
| **TRINITY** | Voice AI — inbound call handling | 🔧 DB ready, UI pending |
| **SCOUT** | Outreach campaigns — 6-month sequences | ✅ Queue wired to ARIA |
| **BEACON** | Client comms | 📋 Spec complete |
| **FORGE** | Quote builder AI | 📋 Spec complete |
| **ATLAS** | DirecTV / video contract intel | 📋 Spec complete |
| **SAGE** | Training / KB | ✅ Live at `/kb` |
| **RELAY** | Tier-1 support | 📋 Spec complete |
