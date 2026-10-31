# OPERATIONS VISION

> Written Oct 30, 2026 (session 18). Source for the "Coming soon" tiles on the
> Operations landing (`components/nexus/OpsComingSoon.tsx`). Keep both in step:
> when a feature ships, remove its tile and mark it ✅ here.

## The one-sentence vision

Nexus Operations runs a security integrator's service business the way the
best field-service tools do — contracts, response-time promises, parts and
payroll — **and** it can see and control the gates and cameras it services,
which none of them can.

## Where we stand

The day-to-day field work is real and saves to Supabase: work orders
(checklists, photos, parts, crew, phases, comments, call log, callbacks),
the dispatch board with map and GPS, the `/tech` app (offline queue, AI
troubleshooting, wiring guides, asset scan), purchase orders tied to work-order
parts, job costing, invoicing with QuickBooks, permits and COIs, and monitoring
that opens incidents.

What's missing is the **service contract** every competitor is built around,
and the loops that hang off it: response-time promises, renewals, recurring
billing, parts receiving and payroll.

## What we're measured against

| Tool | What it's best at | What we take from it |
| --- | --- | --- |
| D-Tools Cloud / SI | Design → BOM → purchasing → install; one record per device with QR + chain of custody | Proposal-to-install handoff; barcode receiving; per-device asset records |
| MaintainX | Procedures (checklists) attached to assets; time/meter-triggered PM | Checklist templates per job type; asset-linked PM |
| ServiceTitan | Dispatch board: capacity, best-tech matching, live tracking for the customer | SLA board colours; live "tech on the way" link |
| ServiceTrade | Deficiency → online repair quote → approval; service reports to the customer | Repair quotes from the field; automatic service report |
| Simpro | Maintenance planner with forecast + recurring invoicing; van stock; est vs actual | 12-month PM forecast; truck stock; over-budget alerts |
| SedonaOffice / SecurityTrax | Alarm-dealer RMR billing; monitoring signal → ticket | Agreements drive RMR; monitoring auto-tickets |

Full gap analysis: the "Nexus Operations — gap analysis" doc (Oct 30, 2026).

## Principles (from NEXUS_VISION)

1. A fifth grader can use it. Every feature below is described in the words a
   tech or property manager would use, and the tile copy says exactly that.
2. The system does the paperwork. An agreement **creates** the PM plan, the
   invoice and the SLA; a won proposal **creates** the parts list; a dead gate
   **creates** the work order.
3. One record, many views. No feature adds a second copy of a job, a site or a
   contract.
4. Honest screens. A feature that isn't built shows as "Coming soon" — never
   demo data passed off as real.

---

## The roadmap

Phases: **Next** (1) → **Then** (2) → **Later** (3). Each feature lists the
problem today, what it will do, the data it needs, and how we know it worked.

### Phase 1 — Next

#### 1. Service Agreements ⬜
- **Today:** no contract record. `api/invoices/generate-monthly` exists but
  nothing runs it; `/renewals` calls `/api/renewals`, which doesn't exist.
- **Will do:** one agreement per property — coverage tier, monthly amount,
  term, start/end, renewal terms, price-increase %. Saving it creates the PM
  schedules, the SLA targets and the monthly invoice. Renewals list = agreements
  ending in 90 days; one click renews.
- **Data:** new `service_agreements` (site_id, client_org_id, dealer_org_id,
  tier, monthly_amount, billing_mode resident|property, term_months, starts_on,
  ends_on, auto_renew, escalator_pct, sla_response_hours, sla_resolve_hours,
  status) + `agreement_coverage` (what's covered: gates, doors, cameras, counts).
  Created from an accepted Property Partnership proposal (its terms already
  hold term, fees and coverage). GRANT block required.
- **Wires into:** `pm_schedules.agreement_id`, `invoices.agreement_id`, a cron
  that calls `generate-monthly`, rebuilt `/renewals`.
- **Done when:** a won partnership proposal produces an active agreement, its
  first invoice goes out on the 1st without anyone touching it, and Renewals
  shows real rows.

#### 2. Response-Time Promises (SLA) ⬜
- **Today:** priority only; no due times.
- **Will do:** `respond_by` / `resolve_by` on each work order, set from the
  agreement's SLA and the priority. Board shows green / amber (75% of time
  used) / red (missed). Warning to dispatch before a miss. Monthly kept-vs-missed
  report, also shown in the property portal.
- **Data:** `work_orders.respond_by`, `resolve_by`, `responded_at`,
  `sla_met boolean`. Normalise priority values first (today "medium" vs "normal").
- **Done when:** every new work order on an agreement site has due times and the
  board sorts by time left.

#### 3. Proposal → Install Handoff ⬜
- **Today:** `OpportunityLifecycle.convert()` makes an Install work order with a
  description only. `job-costs` reads `work_orders.quote_id`, which no migration
  creates, so quoted margin is $0.
- **Will do:** on win, copy the accepted proposal's equipment into the job's
  parts list, draft purchase orders for anything short, link the job to the
  proposal, and show quoted vs actual at closeout.
- **Data:** add `work_orders.quote_id` (and `jobs.quote_id`); parts rows come
  from `quote_line_items`.
- **Done when:** a won deal's install has its parts list and draft POs with no
  retyping, and the Costs tab shows a real quoted amount.

### Phase 2 — Then

#### 4. Parts & Truck Stock ⬜
- **Today:** receiving a PO only changes its status; one shared `on_truck`
  count; supplier is free text.
- **Will do:** receive all or part of a PO into a location; stock per truck/tech
  and warehouse; transfer with a tap; low-stock alerts; vendor list with pricing.
- **Data:** `vendors`, `stock_locations` (warehouse | truck, tech_id),
  `stock_levels` (item × location), `stock_moves` (audit trail), PO line
  `received_qty`.
- **Done when:** receiving a PO raises stock, and a tech can see their own truck.

#### 5. Timecards & Payroll ⬜
- **Today:** hours typed after the fact on the office page; no approval; no
  export.
- **Will do:** clock in/out, travel and on-site time from `/tech`; weekly
  timesheet approval; payroll CSV; labor cost posts to the job.
- **Data:** reuse `work_order_time_entries` + new `timesheets` (tech, week,
  status, approved_by) and a non-job time type (shop, travel, training).
- **Done when:** payroll is run from an approved export.

#### 6. Repair Quotes from the Field ⬜
- **Today:** a tech who finds a problem has to call the office; it often never
  becomes a quote.
- **Will do:** "Flag a problem" in `/tech` with photos → office converts to a
  repair quote in one click → property approves online (reuse the proposal
  approval page) → approval creates the work order and orders the part.
- **Data:** `deficiencies` (site, asset, work_order, photos, severity, status,
  quote_id).
- **Done when:** a flagged problem can go from tech to approved work order with
  no phone call.

#### 7. Auto-Tickets from Monitoring ⬜
- **Today:** `fleet-health` opens incidents; someone clicks "Send tech". SOC
  gate alarms (`api/webhooks/gate-alarm`) write `site_events`, not `incidents`,
  so they can't be dispatched at all.
- **Will do:** device offline / gate alarm for N minutes → incident → if the
  site has an agreement, a work order with SLA times; the property manager is
  told it's already handled.
- **Data:** gate alarms also create `incidents`; per-agreement threshold.
- **Done when:** a gate going down produces a dispatched work order with no
  human click.

### Phase 3 — Later

#### 8. Customer Updates on Autopilot ⬜
- Day-before reminder (cron), live "tech on the way" link with ETA (from
  `tech_location_pings`), service report with photos emailed on close, all
  visible in the property portal. Builds on `lib/sms.ts` and
  `api/maintenance/[id]/notify-customer`.

#### 9. Smarter Maintenance Plans ⬜
- PM per asset (`pm_schedules.asset_id`), checklist templates per job type
  (`checklist_templates`) copied into each visit, 12-month visit + labor
  forecast.

#### 10. One Job, Many Visits ⬜
- An install/project (`jobs`) is the parent; each trip is a work order under
  it (`work_orders.job_id`). One timeline, parts list and profit number per job.
  **Needs a design decision** before building — it touches Projects, the Ops
  Hub and the deal conversion.

### Also on the list (not yet tiles)
- Skills-based auto-assign and drive-time routing in dispatch
- QR asset labels + per-asset service history; restore RMA tracking
- Assign subcontractors to work orders (the link table exists, nothing writes it)
- Card payment on site (`api/payments/collect` exists, no button)
- Customer signature as a signed record, not a tagged photo

## Quick fixes found (no new feature needed)
- `/renewals` → `/api/renewals` missing (fixed by #1)
- `/expenses` → `/api/expenses` missing
- `work_orders.quote_id` missing (fixed by #3)
- PO "received" doesn't add stock (fixed by #4)
- `generate-monthly` never called (fixed by #1)
- Demo data still shown: Subcontractors (fallback), As-builts (`DEMO_PLANS`),
  `/tech` Install + fault demos, `/services` catalog

## Where we're already ahead — protect this
- Live control from the job and site: Brivo open gate, Eagle Eye video, Shelly
  reboot macros, UniFi status
- AI in the field: troubleshooting, wiring diagrams, manuals, job brief,
  nameplate scan
- Monitoring built in: incidents, uptime and MTTR per site
- Sales → proposal → job → property portal in one database
